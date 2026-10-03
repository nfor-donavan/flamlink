const router = require('express').Router();
const { z } = require('zod');
const Cylinder = require('../models/Cylinder');
const CylinderEvent = require('../models/CylinderEvent');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, parse } = require('../utils/http');
const { transition, norm } = require('../services/cylinderOps');

const BRANDS = ['SCTM', 'Tradex', 'Total', 'Afrigaz', 'Camgaz'];
const SIZES = [6, 12.5, 28, 50];
const managers = requireRole('owner', 'manager');

router.get('/', asyncHandler(async (req, res) => {
  const { status, brand, depotId, holderId, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const filter = { tenantId: req.tenantId };
  if (status) filter.currentStatus = { $in: String(status).split(',') };
  if (brand) filter.brand = brand;
  if (depotId) filter.currentDepotId = depotId;
  if (holderId) filter.currentHolderId = holderId;
  if (q) filter.barcodeSerial = { $regex: `^${String(q).toUpperCase().replace(/[^A-Z0-9-]/g, '')}` };
  const [items, total] = await Promise.all([
    Cylinder.find(filter).sort({ lastMovedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('currentDepotId', 'shopName neighborhood').populate('currentHolderId', 'name'),
    Cylinder.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

// Register new bottles: either an explicit list of serials or a numeric range (prefix + start + count).
router.post('/register', managers, asyncHandler(async (req, res) => {
  const body = parse(z.object({
    brand: z.enum(BRANDS), sizeKg: z.number().refine((n) => SIZES.includes(n), 'Unsupported size').default(12.5),
    serials: z.array(z.string()).optional(),
    range: z.object({ prefix: z.string().min(1), start: z.number().int().min(0), count: z.number().int().min(1).max(5000), pad: z.number().int().min(1).max(10).default(6) }).optional(),
  }).refine((v) => v.serials || v.range, 'Provide serials or a range'), req.body);
  const serials = body.serials ? norm(body.serials)
    : Array.from({ length: body.range.count }, (_, i) => `${body.range.prefix.toUpperCase()}${String(body.range.start + i).padStart(body.range.pad, '0')}`);
  const existing = await Cylinder.find({ tenantId: req.tenantId, barcodeSerial: { $in: serials } }).select('barcodeSerial');
  const taken = new Set(existing.map((c) => c.barcodeSerial));
  const fresh = serials.filter((s) => !taken.has(s));
  const docs = await Cylinder.insertMany(fresh.map((s) => ({ tenantId: req.tenantId, barcodeSerial: s, brand: body.brand, sizeKg: body.sizeKg })));
  await CylinderEvent.insertMany(docs.map((c) => ({ tenantId: req.tenantId, cylinderId: c._id, barcodeSerial: c.barcodeSerial, toStatus: c.currentStatus, action: 'register', actorId: req.user._id })));
  res.status(201).json({ created: docs.length, skippedExisting: [...taken] });
}));

// Plant operations: fill, load onto a truck, return empties to the plant, scrap.
router.post('/transition', managers, asyncHandler(async (req, res) => {
  const body = parse(z.object({ action: z.enum(['fill', 'load', 'return', 'scrap']), serials: z.array(z.string()).min(1).max(500), driverId: z.string().optional() }), req.body);
  res.json(await transition({ tenantId: req.tenantId, actorId: req.user._id, ...body }));
}));

// Scan-to-check: works for drivers too.
router.get('/lookup/:serial', asyncHandler(async (req, res) => {
  const serial = String(req.params.serial).trim().toUpperCase();
  const cylinder = await Cylinder.findOne({ tenantId: req.tenantId, barcodeSerial: serial }).populate('currentDepotId', 'shopName neighborhood').populate('currentHolderId', 'name');
  if (!cylinder) throw new HttpError(404, 'Unknown bottle for this distributor');
  const history = await CylinderEvent.find({ tenantId: req.tenantId, barcodeSerial: serial }).sort({ createdAt: -1 }).limit(25).populate('actorId', 'name').populate('depotId', 'shopName');
  res.json({ cylinder, history });
}));

module.exports = router;
