const router = require('express').Router();
const { z } = require('zod');
const DispatchOrder = require('../models/DispatchOrder');
const Depot = require('../models/Depot');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');
const { nearestDriver, sweepAllTenants } = require('../services/dispatch');
const { suggestedTopUp } = require('../services/depotHealth');

const managers = requireRole('owner', 'manager');
const populate = [{ path: 'depotId', select: 'shopName neighborhood ownerPhone location currentStockCount minimumSafetyStock status' }, { path: 'driverId', select: 'name' }];

router.get('/', managers, asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId };
  filter.status = req.query.status ? { $in: String(req.query.status).split(',') } : { $in: ['pending', 'accepted'] };
  res.json(await DispatchOrder.find(filter).sort({ createdAt: -1 }).limit(100).populate(populate));
}));

// Driver app polls this (and also receives a push when a new order is assigned).
router.get('/mine', requireRole('driver'), asyncHandler(async (req, res) => {
  res.json(await DispatchOrder.find({ tenantId: req.tenantId, driverId: req.user._id, status: { $in: ['pending', 'accepted'] } }).sort({ createdAt: 1 }).populate(populate));
}));

router.post('/manual', managers, asyncHandler(async (req, res) => {
  const { depotId, driverId, quantity } = parse(z.object({ depotId: z.string(), driverId: z.string().optional(), quantity: z.number().int().min(1).optional() }), req.body);
  const depot = await Depot.findOne({ _id: depotId, tenantId: req.tenantId });
  if (!depot) throw new HttpError(404, 'Depot not found');
  const pick = driverId ? null : await nearestDriver(req.tenantId, depot);
  const order = await DispatchOrder.create({
    tenantId: req.tenantId, depotId, driverId: driverId || (pick && pick.driver._id), distanceKm: pick && pick.distanceKm,
    suggestedQuantity: quantity || suggestedTopUp(depot), reason: 'manual',
  });
  res.status(201).json(await order.populate(populate));
}));

router.post('/:id/accept', requireRole('driver'), asyncHandler(async (req, res) => {
  const order = await DispatchOrder.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, driverId: req.user._id, status: 'pending' }, { status: 'accepted' }, { new: true });
  if (!order) throw new HttpError(404, 'Order not found or already handled');
  res.json(order);
}));

router.post('/:id/reassign', managers, asyncHandler(async (req, res) => {
  const { driverId } = parse(z.object({ driverId: z.string() }), req.body);
  const order = await DispatchOrder.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, status: { $in: ['pending', 'accepted'] } }, { driverId, status: 'pending' }, { new: true });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
}));

router.post('/:id/cancel', managers, asyncHandler(async (req, res) => {
  const order = await DispatchOrder.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, status: { $in: ['pending', 'accepted'] } }, { status: 'cancelled' }, { new: true });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
}));

router.post('/sweep', managers, asyncHandler(async (_req, res) => res.json({ depotsChecked: await sweepAllTenants() })));

module.exports = router;
