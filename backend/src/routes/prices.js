const router = require('express').Router();
const { z } = require('zod');
const Tenant = require('../models/Tenant');
const Depot = require('../models/Depot');
const PriceReport = require('../models/PriceReport');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');
const { priceFor } = require('../utils/pricing');

router.get('/pricing', asyncHandler(async (req, res) => {
  const t = await Tenant.findById(req.tenantId);
  res.json({ kg6: priceFor(t, 6), kg12_5: priceFor(t, 12.5), kg28: priceFor(t, 28), kg50: priceFor(t, 50) });
}));

router.put('/pricing', requireRole('owner'), asyncHandler(async (req, res) => {
  const row = z.object({ depositXAF: z.number().min(0), wholesaleXAF: z.number().min(0), maxRetailXAF: z.number().min(0) });
  const body = parse(z.object({ kg6: row.optional(), kg12_5: row.optional(), kg28: row.optional(), kg50: row.optional() }), req.body);
  const t = await Tenant.findById(req.tenantId);
  for (const [k, v] of Object.entries(body)) t.settings.pricing[k] = v;
  await t.save();
  res.json(t.settings.pricing);
}));

// Price check or "they said they have none". Drivers log it during visits; customers/managers can too.
router.post('/reports', asyncHandler(async (req, res) => {
  const body = parse(z.object({
    depotId: z.string(), kind: z.enum(['price', 'no_stock']).default('price'),
    brand: z.string().optional(), sizeKg: z.number().default(12.5), priceXAF: z.number().min(0).optional(),
  }).refine((v) => v.kind !== 'price' || v.priceXAF != null, 'priceXAF is required for a price report'), req.body);
  const depot = await Depot.findOne({ _id: body.depotId, tenantId: req.tenantId });
  if (!depot) throw new HttpError(404, 'Depot not found');
  const t = await Tenant.findById(req.tenantId);
  const maxRetailXAF = priceFor(t, body.sizeKg).maxRetailXAF;
  const violation = body.kind === 'price' && body.priceXAF > maxRetailXAF;
  // A depot that claims "no stock" while our own count says it has full bottles is suspected hoarding.
  const hoarding = body.kind === 'no_stock' && depot.currentStockCount > 0;
  const source = { driver: 'driver', retailer: 'customer' }[req.user.role] || 'manager';
  const report = await PriceReport.create({ ...body, tenantId: req.tenantId, maxRetailXAF, violation: violation || hoarding, source, reporterId: req.user._id });
  res.status(201).json({ report, flagged: violation || hoarding, reason: violation ? `Above the legal ceiling of ${maxRetailXAF} XAF` : hoarding ? `Depot says no stock but our count shows ${depot.currentStockCount} full bottles` : null });
}));

router.get('/violations', requireRole('owner', 'manager'), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - (Number(req.query.days) || 14) * 86400000);
  const rows = await PriceReport.aggregate([
    { $match: { tenantId: req.tenantId, violation: true, createdAt: { $gte: since } } },
    { $group: { _id: '$depotId', reports: { $sum: 1 }, maxPriceXAF: { $max: '$priceXAF' }, noStockClaims: { $sum: { $cond: [{ $eq: ['$kind', 'no_stock'] }, 1, 0] } }, lastAt: { $max: '$createdAt' } } },
    { $lookup: { from: 'depots', localField: '_id', foreignField: '_id', as: 'depot' } }, { $unwind: '$depot' },
    { $project: { depotId: '$_id', shopName: '$depot.shopName', neighborhood: '$depot.neighborhood', ownerPhone: '$depot.ownerPhone', reports: 1, maxPriceXAF: 1, noStockClaims: 1, lastAt: 1 } },
    { $sort: { reports: -1 } },
  ]);
  res.json(rows);
}));

module.exports = router;
