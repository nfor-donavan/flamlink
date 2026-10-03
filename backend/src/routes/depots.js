const router = require('express').Router();
const { z } = require('zod');
const Depot = require('../models/Depot');
const Cylinder = require('../models/Cylinder');
const CylinderEvent = require('../models/CylinderEvent');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');
const { withTx } = require('../utils/tx');
const { evaluateDepot } = require('../services/dispatch');

const managers = requireRole('owner', 'manager');
const loc = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

router.get('/', asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId, active: true };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.neighborhood) filter.neighborhood = req.query.neighborhood;
  if (req.user.role === 'retailer') filter.ownerUserId = req.user._id;
  res.json(await Depot.find(filter).sort({ neighborhood: 1, shopName: 1 }));
}));

router.post('/', managers, asyncHandler(async (req, res) => {
  const body = parse(z.object({
    shopName: z.string().min(2), neighborhood: z.string().min(2), ownerName: z.string().optional(), ownerPhone: z.string().min(8),
    ownerUserId: z.string().optional(), location: loc.optional(), minimumSafetyStock: z.number().int().min(0).optional(),
  }), req.body);
  const depot = await Depot.create({ ...body, tenantId: req.tenantId });
  await evaluateDepot(depot._id);
  res.status(201).json(await Depot.findById(depot._id));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const depot = await Depot.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!depot) throw new HttpError(404, 'Depot not found');
  const holdings = await Cylinder.aggregate([
    { $match: { tenantId: req.tenantId, currentDepotId: depot._id } },
    { $group: { _id: '$currentStatus', n: { $sum: 1 } } },
  ]);
  res.json({ depot, holdings: Object.fromEntries(holdings.map((h) => [h._id, h.n])) });
}));

router.patch('/:id', managers, asyncHandler(async (req, res) => {
  const body = parse(z.object({
    shopName: z.string().min(2).optional(), neighborhood: z.string().min(2).optional(), ownerName: z.string().optional(),
    ownerPhone: z.string().min(8).optional(), location: loc.optional(), minimumSafetyStock: z.number().int().min(0).optional(), active: z.boolean().optional(),
  }), req.body);
  const depot = await Depot.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, body, { new: true });
  if (!depot) throw new HttpError(404, 'Depot not found');
  await evaluateDepot(depot._id);
  res.json(await Depot.findById(depot._id));
}));

// A depot sold `quantity` full bottles to households. The oldest full bottles there become empties, which makes
// "where are my empty shells?" answerable, and the sale rate feeds the stock-out forecast.
router.post('/:id/sales', asyncHandler(async (req, res) => {
  const { quantity } = parse(z.object({ quantity: z.number().int().min(1).max(200) }), req.body);
  const depot = await Depot.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!depot) throw new HttpError(404, 'Depot not found');
  if (req.user.role === 'retailer' && String(depot.ownerUserId) !== String(req.user._id)) throw new HttpError(403, 'Not your depot');
  if (quantity > depot.currentStockCount) throw new HttpError(422, `Only ${depot.currentStockCount} full bottles in stock`);
  await withTx(async (session) => {
    const full = await Cylinder.find({ tenantId: req.tenantId, currentDepotId: depot._id, currentStatus: 'At_Retailer_Full' }).sort({ lastMovedAt: 1 }).limit(quantity).session(session);
    if (full.length) {
      await Cylinder.updateMany({ _id: { $in: full.map((c) => c._id) } }, { $set: { currentStatus: 'At_Retailer_Empty', isFull: false, lastMovedAt: new Date() } }, { session });
      await CylinderEvent.insertMany(full.map((c) => ({ tenantId: req.tenantId, cylinderId: c._id, barcodeSerial: c.barcodeSerial, fromStatus: 'At_Retailer_Full', toStatus: 'At_Retailer_Empty', action: 'sale', actorId: req.user._id, depotId: depot._id })), { session });
    }
    depot.currentStockCount -= quantity;
    await depot.save({ session });
  });
  res.json(await evaluateDepot(depot._id));
}));

module.exports = router;
