const router = require('express').Router();
const { z } = require('zod');
const LedgerEntry = require('../models/LedgerEntry');
const Depot = require('../models/Depot');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');

const managers = requireRole('owner', 'manager');

// Outstanding balance per retailer (positive = the retailer owes money).
router.get('/balances', managers, asyncHandler(async (req, res) => {
  const rows = await LedgerEntry.aggregate([
    { $match: { tenantId: req.tenantId } },
    { $group: { _id: '$depotId', balanceXAF: { $sum: '$amountXAF' }, entries: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
    { $lookup: { from: 'depots', localField: '_id', foreignField: '_id', as: 'depot' } }, { $unwind: '$depot' },
    { $project: { depotId: '$_id', shopName: '$depot.shopName', neighborhood: '$depot.neighborhood', ownerPhone: '$depot.ownerPhone', balanceXAF: 1, entries: 1, lastAt: 1 } },
    { $sort: { balanceXAF: -1 } },
  ]);
  res.json({ totalOutstandingXAF: rows.reduce((s, r) => s + Math.max(0, r.balanceXAF), 0), rows });
}));

router.get('/:depotId', managers, asyncHandler(async (req, res) => {
  const entries = await LedgerEntry.find({ tenantId: req.tenantId, depotId: req.params.depotId }).sort({ createdAt: -1 }).limit(100);
  res.json({ balanceXAF: entries.reduce((s, e) => s + e.amountXAF, 0), entries });
}));

router.post('/:depotId/payment', managers, asyncHandler(async (req, res) => {
  const { amountXAF, note } = parse(z.object({ amountXAF: z.number().positive(), note: z.string().max(200).optional() }), req.body);
  const depot = await Depot.findOne({ _id: req.params.depotId, tenantId: req.tenantId });
  if (!depot) throw new HttpError(404, 'Depot not found');
  const entry = await LedgerEntry.create({ tenantId: req.tenantId, depotId: depot._id, type: 'payment', amountXAF: -amountXAF, note, createdBy: req.user._id });
  res.status(201).json(entry);
}));

module.exports = router;
