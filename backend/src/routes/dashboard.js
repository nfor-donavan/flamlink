const router = require('express').Router();
const Depot = require('../models/Depot');
const Cylinder = require('../models/Cylinder');
const HandoverLog = require('../models/HandoverLog');
const PriceReport = require('../models/PriceReport');
const LedgerEntry = require('../models/LedgerEntry');
const DispatchOrder = require('../models/DispatchOrder');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

router.get('/overview', requireRole('owner', 'manager'), asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 6 * 86400000); weekAgo.setHours(0, 0, 0, 0);
  const [depotStatus, cylinderStatus, today, daily, violations, owed, openOrders, totalFull] = await Promise.all([
    Depot.aggregate([{ $match: { tenantId, active: true } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Cylinder.aggregate([{ $match: { tenantId } }, { $group: { _id: '$currentStatus', n: { $sum: 1 } } }]),
    HandoverLog.aggregate([{ $match: { tenantId, createdAt: { $gte: startOfDay } } }, { $group: { _id: null, handovers: { $sum: 1 }, delivered: { $sum: { $size: '$cylindersDelivered' } }, collected: { $sum: { $size: '$cylindersCollected' } }, cash: { $sum: '$cashCollectedXAF' }, deficits: { $sum: '$deficitCount' } } }]),
    HandoverLog.aggregate([{ $match: { tenantId, createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, delivered: { $sum: { $size: '$cylindersDelivered' } }, collected: { $sum: { $size: '$cylindersCollected' } }, cash: { $sum: '$cashCollectedXAF' } } }, { $sort: { _id: 1 } }]),
    PriceReport.countDocuments({ tenantId, violation: true, createdAt: { $gte: weekAgo } }),
    LedgerEntry.aggregate([{ $match: { tenantId } }, { $group: { _id: '$depotId', b: { $sum: '$amountXAF' } } }, { $group: { _id: null, total: { $sum: { $max: ['$b', 0] } } } }]),
    DispatchOrder.countDocuments({ tenantId, status: { $in: ['pending', 'accepted'] } }),
    Depot.aggregate([{ $match: { tenantId, active: true } }, { $group: { _id: null, n: { $sum: '$currentStockCount' } } }]),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000); const key = d.toISOString().slice(0, 10);
    const hit = daily.find((r) => r._id === key);
    days.push({ date: key, delivered: hit ? hit.delivered : 0, collected: hit ? hit.collected : 0, cashXAF: hit ? hit.cash : 0 });
  }
  const t = today[0] || { handovers: 0, delivered: 0, collected: 0, cash: 0, deficits: 0 };
  res.json({
    depots: toMap(depotStatus), cylinders: toMap(cylinderStatus),
    fullBottlesOnShelves: (totalFull[0] && totalFull[0].n) || 0,
    today: { handovers: t.handovers, delivered: t.delivered, collected: t.collected, cashXAF: t.cash, deficitBottles: t.deficits },
    week: days, priceViolations7d: violations, outstandingXAF: (owed[0] && owed[0].total) || 0, openDispatchOrders: openOrders,
  });
}));

module.exports = router;
