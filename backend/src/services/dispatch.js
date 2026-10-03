const Depot = require('../models/Depot');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const DispatchOrder = require('../models/DispatchOrder');
const { computeStatus, suggestedTopUp } = require('./depotHealth');
const { haversineKm } = require('../utils/geo');
const { sendPush } = require('./push');

const FRESH_LOCATION_MS = 30 * 60 * 1000; // ignore drivers not seen in the last 30 minutes

async function nearestDriver(tenantId, depot) {
  const since = new Date(Date.now() - FRESH_LOCATION_MS);
  const drivers = await User.find({ tenantId, role: 'driver', active: true, 'vehicle.lastSeenAt': { $gte: since } });
  if (!drivers.length) return null;
  const openCounts = await DispatchOrder.aggregate([
    { $match: { tenantId, status: { $in: ['pending', 'accepted'] }, driverId: { $in: drivers.map((d) => d._id) } } },
    { $group: { _id: '$driverId', n: { $sum: 1 } } },
  ]);
  const load = new Map(openCounts.map((r) => [String(r._id), r.n]));
  const ranked = drivers
    .filter((d) => d.vehicle && d.vehicle.lastLocation && depot.location && depot.location.lat != null)
    .map((d) => ({ driver: d, km: haversineKm(d.vehicle.lastLocation, depot.location) + (load.get(String(d._id)) || 0) * 2 })) // 2km penalty per open order
    .sort((a, b) => a.km - b.km);
  if (!ranked.length) return null;
  return { driver: ranked[0].driver, distanceKm: Math.round(haversineKm(ranked[0].driver.vehicle.lastLocation, depot.location) * 10) / 10 };
}

// Re-evaluates one depot after any stock movement. Updates its status, opens a dispatch order when it turns
// CRITICAL/OUT (and alerts the nearest vehicle), and closes open orders once stock is restored.
async function evaluateDepot(depotId, { session, tenant } = {}) {
  const depot = await Depot.findById(depotId).session(session || null);
  if (!depot) return null;
  const t = tenant || (await Tenant.findById(depot.tenantId).session(session || null));
  const status = computeStatus(depot, t && t.settings.lowStockWarnFactor);
  if (status !== depot.status) {
    depot.status = status;
    depot.statusChangedAt = new Date();
    await depot.save({ session });
  }
  const needsTopUp = status === 'CRITICAL' || status === 'OUT';
  const open = await DispatchOrder.findOne({ depotId: depot._id, status: { $in: ['pending', 'accepted'] } }).session(session || null);

  if (!needsTopUp && open && status === 'HEALTHY') {
    open.status = 'cancelled'; // restocked by other means
    await open.save({ session });
    return depot;
  }
  if (needsTopUp && !open) {
    const pick = await nearestDriver(depot.tenantId, depot);
    const order = await DispatchOrder.create([{
      tenantId: depot.tenantId,
      depotId: depot._id,
      driverId: pick ? pick.driver._id : undefined,
      distanceKm: pick ? pick.distanceKm : undefined,
      suggestedQuantity: suggestedTopUp(depot),
      reason: status === 'OUT' ? 'out_of_stock' : 'critical_stock',
    }], { session });
    if (pick) {
      // Fire-and-forget: the driver app also polls /api/dispatch/mine, so a missed push is harmless.
      sendPush(pick.driver.expoPushToken, {
        title: status === 'OUT' ? 'Depot out of gas' : 'Depot running low',
        body: `${depot.shopName}, ${depot.neighborhood}: take ${order[0].suggestedQuantity} full bottles (${pick.distanceKm} km away)`,
        data: { type: 'dispatch', orderId: String(order[0]._id), depotId: String(depot._id) },
      });
    }
  }
  return depot;
}

// Periodic safety net: re-check every active depot so shortages never depend on someone calling an endpoint.
async function sweepAllTenants() {
  const tenants = await Tenant.find({ active: true });
  let checked = 0;
  for (const tenant of tenants) {
    const depots = await Depot.find({ tenantId: tenant._id, active: true }).select('_id');
    for (const d of depots) {
      await evaluateDepot(d._id, { tenant });
      checked += 1;
    }
  }
  return checked;
}

module.exports = { evaluateDepot, sweepAllTenants, nearestDriver };
