const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, tenantId: u.tenantId });

// Creates a new distributor workspace and its owner account.
router.post('/register-tenant', asyncHandler(async (req, res) => {
  const body = parse(z.object({
    companyName: z.string().min(2), city: z.string().optional(),
    name: z.string().min(2), email: z.string().email(), password: z.string().min(8),
  }), req.body);
  const slug = `${slugify(body.companyName)}-${Math.random().toString(36).slice(2, 6)}`;
  const tenant = await Tenant.create({ name: body.companyName, slug, city: body.city });
  const user = await User.create({ tenantId: tenant._id, name: body.name, email: body.email, role: 'owner', passwordHash: await bcrypt.hash(body.password, 10) });
  res.status(201).json({ token: signToken(user), user: publicUser(user), tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug } });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = parse(z.object({ identifier: z.string().min(3), password: z.string().min(1), tenantSlug: z.string().optional() }), req.body);
  const filter = { $or: [{ email: body.identifier.toLowerCase() }, { phone: body.identifier }], active: true };
  if (body.tenantSlug) {
    const t = await Tenant.findOne({ slug: body.tenantSlug });
    if (!t) throw new HttpError(401, 'Wrong login details');
    filter.tenantId = t._id;
  }
  const users = await User.find(filter).select('+passwordHash');
  if (users.length > 1) throw new HttpError(409, 'This login exists in several companies. Add your company code (tenantSlug).');
  const user = users[0];
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Wrong login details');
  const tenant = await Tenant.findById(user.tenantId);
  if (!tenant || !tenant.active) throw new HttpError(403, 'This company account is disabled');
  res.json({ token: signToken(user), user: publicUser(user), tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  res.json({ user: publicUser(req.user), tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, city: tenant.city } });
}));

router.put('/me/push-token', requireAuth, asyncHandler(async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10) }), req.body);
  req.user.expoPushToken = token;
  await req.user.save();
  res.json({ ok: true });
}));

// Drivers post their position every minute or so; the shortage engine uses it to pick the nearest vehicle.
router.post('/me/location', requireAuth, asyncHandler(async (req, res) => {
  const { lat, lng } = parse(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), req.body);
  req.user.vehicle = { ...(req.user.vehicle && req.user.vehicle.toObject ? req.user.vehicle.toObject() : {}), lastLocation: { lat, lng }, lastSeenAt: new Date() };
  await req.user.save();
  res.json({ ok: true });
}));

module.exports = router;
