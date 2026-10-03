const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');

router.use(requireRole('owner', 'manager'));

router.get('/', asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId };
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).sort({ role: 1, name: 1 });
  res.json(users.map((u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, vehicle: u.vehicle })));
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parse(z.object({
    name: z.string().min(2), email: z.string().email().optional(), phone: z.string().min(8).optional(),
    password: z.string().min(8), role: z.enum(['manager', 'driver', 'retailer']), plate: z.string().optional(),
  }).refine((v) => v.email || v.phone, 'Provide an email or a phone number'), req.body);
  if (body.role === 'manager' && req.user.role !== 'owner') throw new HttpError(403, 'Only the owner can add managers');
  const user = await User.create({
    tenantId: req.tenantId, name: body.name, email: body.email, phone: body.phone, role: body.role,
    passwordHash: await bcrypt.hash(body.password, 10), vehicle: body.plate ? { plate: body.plate } : undefined,
  });
  res.status(201).json({ id: user._id, name: user.name, role: user.role });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = parse(z.object({ active: z.boolean().optional(), name: z.string().min(2).optional() }), req.body);
  const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, role: { $ne: 'owner' } }, body, { new: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ id: user._id, name: user.name, active: user.active });
}));

module.exports = router;
