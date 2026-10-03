const router = require('express').Router();
const Depot = require('../models/Depot');
const Cylinder = require('../models/Cylinder');
const CylinderEvent = require('../models/CylinderEvent');
const DispatchOrder = require('../models/DispatchOrder');
const { asyncHandler } = require('../utils/http');

const DAY = 24 * 3600 * 1000;

// Average full bottles sold per day over the last 7 days, per depot.
async function salesVelocity(tenantId) {
  const rows = await CylinderEvent.aggregate([
    { $match: { tenantId, action: 'sale', createdAt: { $gte: new Date(Date.now() - 7 * DAY) } } },
    { $group: { _id: '$depotId', sold: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.sold / 7]));
}

// GET /api/inventory/critical-zones : depots at or near depletion, grouped by neighbourhood.
// riskLevel: CRITICAL/OUT come from stock vs safety stock; AT_RISK is predicted from the sales curve (< 2 days of cover).
router.get('/critical-zones', asyncHandler(async (req, res) => {
  const [depots, velocity, orders] = await Promise.all([
    Depot.find({ tenantId: req.tenantId, active: true }),
    salesVelocity(req.tenantId),
    DispatchOrder.find({ tenantId: req.tenantId, status: { $in: ['pending', 'accepted'] } }).populate('driverId', 'name'),
  ]);
  const orderByDepot = new Map(orders.map((o) => [String(o.depotId), o]));
  const rows = depots.map((d) => {
    const perDay = velocity.get(String(d._id)) || 0;
    const daysOfCover = perDay > 0 ? Math.round((d.currentStockCount / perDay) * 10) / 10 : null;
    const predicted = d.status === 'HEALTHY' || d.status === 'LOW' ? (daysOfCover !== null && daysOfCover < 2 ? 'AT_RISK' : d.status) : d.status;
    const order = orderByDepot.get(String(d._id));
    return {
      depotId: d._id, shopName: d.shopName, neighborhood: d.neighborhood, ownerPhone: d.ownerPhone, location: d.location,
      currentStockCount: d.currentStockCount, minimumSafetyStock: d.minimumSafetyStock, status: d.status, riskLevel: predicted,
      salesPerDay: Math.round(perDay * 10) / 10, daysOfCover, statusChangedAt: d.statusChangedAt,
      dispatch: order ? { id: order._id, status: order.status, driver: order.driverId && order.driverId.name, suggestedQuantity: order.suggestedQuantity, distanceKm: order.distanceKm } : null,
    };
  });
  const flagged = rows.filter((r) => ['OUT', 'CRITICAL', 'AT_RISK'].includes(r.riskLevel))
    .sort((a, b) => ['OUT', 'CRITICAL', 'AT_RISK'].indexOf(a.riskLevel) - ['OUT', 'CRITICAL', 'AT_RISK'].indexOf(b.riskLevel) || (a.daysOfCover ?? 99) - (b.daysOfCover ?? 99));
  const byNeighborhood = {};
  for (const r of rows) {
    const n = (byNeighborhood[r.neighborhood] ||= { neighborhood: r.neighborhood, depots: 0, stock: 0, OUT: 0, CRITICAL: 0, AT_RISK: 0, LOW: 0, HEALTHY: 0 });
    n.depots += 1; n.stock += r.currentStockCount; n[r.riskLevel] += 1;
  }
  res.json({
    generatedAt: new Date(),
    totals: { depots: rows.length, flagged: flagged.length, out: rows.filter((r) => r.status === 'OUT').length, critical: rows.filter((r) => r.status === 'CRITICAL').length },
    flagged,
    depots: req.query.all === 'true' ? rows : undefined,
    neighborhoods: Object.values(byNeighborhood).sort((a, b) => (b.OUT + b.CRITICAL) - (a.OUT + a.CRITICAL)),
  });
}));

// GET /api/inventory/empties : where the metal shells are (capital assets) and how long they have been sitting.
router.get('/empties', asyncHandler(async (req, res) => {
  const stale = new Date(Date.now() - 3 * DAY);
  const [byDepot, byHolder, totals] = await Promise.all([
    Cylinder.aggregate([
      { $match: { tenantId: req.tenantId, currentStatus: 'At_Retailer_Empty' } },
      { $group: { _id: '$currentDepotId', empties: { $sum: 1 }, oldest: { $min: '$lastMovedAt' }, stale: { $sum: { $cond: [{ $lt: ['$lastMovedAt', stale] }, 1, 0] } } } },
      { $lookup: { from: 'depots', localField: '_id', foreignField: '_id', as: 'depot' } }, { $unwind: '$depot' },
      { $project: { depotId: '$_id', shopName: '$depot.shopName', neighborhood: '$depot.neighborhood', location: '$depot.location', empties: 1, oldest: 1, stale: 1 } },
      { $sort: { empties: -1 } },
    ]),
    Cylinder.aggregate([
      { $match: { tenantId: req.tenantId, currentStatus: 'In_Transit' } },
      { $group: { _id: '$currentHolderId', full: { $sum: { $cond: ['$isFull', 1, 0] } }, empty: { $sum: { $cond: ['$isFull', 0, 1] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driver' } }, { $unwind: '$driver' },
      { $project: { driverId: '$_id', name: '$driver.name', full: 1, empty: 1 } },
    ]),
    Cylinder.aggregate([{ $match: { tenantId: req.tenantId } }, { $group: { _id: '$currentStatus', n: { $sum: 1 } } }]),
  ]);
  res.json({ byDepot, byDriver: byHolder, statusTotals: Object.fromEntries(totals.map((t) => [t._id, t.n])) });
}));

module.exports = router;
