const Cylinder = require('../models/Cylinder');
const CylinderEvent = require('../models/CylinderEvent');
const Depot = require('../models/Depot');
const HandoverLog = require('../models/HandoverLog');
const LedgerEntry = require('../models/LedgerEntry');
const DispatchOrder = require('../models/DispatchOrder');
const { HttpError } = require('../utils/http');
const { priceFor } = require('../utils/pricing');
const { withTx } = require('../utils/tx');
const { evaluateDepot } = require('./dispatch');

const norm = (list) => [...new Set((list || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];

// The "Full-for-Empty" twin scanning engine. Everything below happens in ONE transaction, and a retried request
// carrying the same idempotencyKey returns the original result instead of double-booking.
async function processHandover({ tenant, driver, input }) {
  const delivered = norm(input.cylindersDelivered);
  const collected = norm(input.cylindersCollected);
  const overlap = delivered.filter((s) => collected.includes(s));
  if (overlap.length) throw new HttpError(422, 'A bottle cannot be both delivered and collected', { serials: overlap });
  if (!delivered.length && !collected.length) throw new HttpError(422, 'Scan at least one bottle');

  const run = async (session) => {
    const existing = await HandoverLog.findOne({ tenantId: tenant._id, idempotencyKey: input.idempotencyKey }).session(session);
    if (existing) return { log: existing, duplicate: true };

    const depot = await Depot.findOne({ _id: input.depotId, tenantId: tenant._id, active: true }).session(session);
    if (!depot) throw new HttpError(404, 'Depot not found');

    const [deliveredDocs, collectedDocs] = await Promise.all([
      Cylinder.find({ tenantId: tenant._id, barcodeSerial: { $in: delivered } }).session(session),
      Cylinder.find({ tenantId: tenant._id, barcodeSerial: { $in: collected } }).session(session),
    ]);

    // ---- Validate both batches and report every problem at once so the driver can fix them in one go.
    const problems = [];
    const known = (docs) => new Set(docs.map((c) => c.barcodeSerial));
    delivered.filter((s) => !known(deliveredDocs).has(s)).forEach((s) => problems.push({ serial: s, side: 'delivered', reason: 'Unknown bottle for this distributor' }));
    collected.filter((s) => !known(collectedDocs).has(s)).forEach((s) => problems.push({ serial: s, side: 'collected', reason: 'Unknown bottle for this distributor' }));
    for (const c of deliveredDocs) {
      const onMyTruck = c.currentStatus === 'In_Transit' && c.isFull && String(c.currentHolderId) === String(driver._id);
      if (!(onMyTruck || c.currentStatus === 'At_Plant_Filled')) {
        problems.push({ serial: c.barcodeSerial, side: 'delivered', reason: `Not a full bottle on your truck (status: ${c.currentStatus}${c.isFull ? '' : ', empty'})` });
      }
    }
    for (const c of collectedDocs) {
      if (!['At_Retailer_Empty', 'At_Retailer_Full'].includes(c.currentStatus)) {
        problems.push({ serial: c.barcodeSerial, side: 'collected', reason: `Bottle is not at a retailer (status: ${c.currentStatus})` });
      }
    }
    if (problems.length) throw new HttpError(422, 'Some scanned bottles are not valid for this handover', problems);

    // ---- Accounting
    const expectedCashXAF = deliveredDocs.reduce((sum, c) => sum + priceFor(tenant, c.sizeKg).wholesaleXAF, 0);
    const cashShortfallXAF = Math.max(0, expectedCashXAF - input.cashCollectedXAF);
    const avgDeposit = deliveredDocs.length
      ? Math.round(deliveredDocs.reduce((s, c) => s + priceFor(tenant, c.sizeKg).depositXAF, 0) / deliveredDocs.length)
      : Math.round(collectedDocs.reduce((s, c) => s + priceFor(tenant, c.sizeKg).depositXAF, 0) / Math.max(collectedDocs.length, 1));
    const deficitCount = Math.max(0, delivered.length - collected.length);
    const surplusCount = Math.max(0, collected.length - delivered.length);
    const deficitChargeXAF = deficitCount * avgDeposit;

    const [log] = await HandoverLog.create([{
      tenantId: tenant._id,
      idempotencyKey: input.idempotencyKey,
      driverId: driver._id,
      depotId: depot._id,
      cylindersDelivered: delivered,
      cylindersCollected: collected,
      cashCollectedXAF: input.cashCollectedXAF,
      paymentMethod: input.paymentMethod,
      expectedCashXAF,
      cashShortfallXAF,
      deficitCount,
      deficitChargeXAF,
      balanced: deficitCount === 0,
      clientCreatedAt: input.clientCreatedAt,
    }], { session });

    // ---- Asset movement
    if (delivered.length) {
      await Cylinder.updateMany(
        { tenantId: tenant._id, barcodeSerial: { $in: delivered } },
        { $set: { currentStatus: 'At_Retailer_Full', isFull: true, currentDepotId: depot._id, lastMovedAt: new Date() }, $unset: { currentHolderId: '' } },
        { session },
      );
    }
    if (collected.length) {
      await Cylinder.updateMany(
        { tenantId: tenant._id, barcodeSerial: { $in: collected } },
        { $set: { currentStatus: 'In_Transit', isFull: false, currentHolderId: driver._id, lastMovedAt: new Date() }, $unset: { currentDepotId: '' } },
        { session },
      );
    }
    const events = [
      ...deliveredDocs.map((c) => ({ cylinderId: c._id, barcodeSerial: c.barcodeSerial, fromStatus: c.currentStatus, toStatus: 'At_Retailer_Full', action: 'deliver' })),
      ...collectedDocs.map((c) => ({ cylinderId: c._id, barcodeSerial: c.barcodeSerial, fromStatus: c.currentStatus, toStatus: 'In_Transit', action: 'collect' })),
    ].map((e) => ({ ...e, tenantId: tenant._id, actorId: driver._id, depotId: depot._id, handoverId: log._id }));
    if (events.length) await CylinderEvent.insertMany(events, { session });

    // ---- Depot stock: + delivered, and - any collected bottle that was still counted as full somewhere
    const deltas = new Map([[String(depot._id), delivered.length]]);
    for (const c of collectedDocs) {
      if (c.currentStatus === 'At_Retailer_Full' && c.currentDepotId) {
        const k = String(c.currentDepotId);
        deltas.set(k, (deltas.get(k) || 0) - 1);
      }
    }
    for (const [depotId, delta] of deltas) {
      if (!delta) continue;
      await Depot.updateOne({ _id: depotId, tenantId: tenant._id }, [{ $set: { currentStockCount: { $max: [0, { $add: ['$currentStockCount', delta] }] } } }], { session });
    }

    // ---- Ledger
    const entries = [];
    if (deficitChargeXAF > 0) entries.push({ type: 'deficit_charge', amountXAF: deficitChargeXAF, note: `${deficitCount} empty bottle(s) missing` });
    if (cashShortfallXAF > 0) entries.push({ type: 'cash_shortfall', amountXAF: cashShortfallXAF, note: `Collected ${input.cashCollectedXAF} of ${expectedCashXAF} XAF` });
    if (surplusCount > 0) {
      const agg = await LedgerEntry.aggregate([{ $match: { tenantId: tenant._id, depotId: depot._id } }, { $group: { _id: null, total: { $sum: '$amountXAF' } } }]).session(session);
      const owed = Math.max(0, (agg[0] && agg[0].total) || 0);
      const credit = Math.min(owed, surplusCount * avgDeposit);
      if (credit > 0) entries.push({ type: 'empty_credit', amountXAF: -credit, note: `${surplusCount} extra empty bottle(s) returned` });
    }
    if (entries.length) {
      await LedgerEntry.insertMany(entries.map((e) => ({ ...e, tenantId: tenant._id, depotId: depot._id, handoverId: log._id, createdBy: driver._id })), { session });
    }

    // ---- Close any open shortage order for this depot if gas was delivered
    if (delivered.length) {
      await DispatchOrder.updateMany(
        { tenantId: tenant._id, depotId: depot._id, status: { $in: ['pending', 'accepted'] } },
        { $set: { status: 'completed', completedByHandoverId: log._id } },
        { session },
      );
    }
    return { log, duplicate: false, depotId: depot._id };
  };

  let result;
  try {
    result = await withTx(run);
  } catch (err) {
    // Two identical requests racing each other: the loser hits the unique index, so return the winner's result.
    if (err.code === 11000 && err.keyPattern && err.keyPattern.idempotencyKey) {
      const log = await HandoverLog.findOne({ tenantId: tenant._id, idempotencyKey: input.idempotencyKey });
      return { log, duplicate: true };
    }
    throw err;
  }
  if (!result.duplicate) await evaluateDepot(result.depotId, { tenant }); // re-check health after commit
  return result;
}

module.exports = { processHandover };
