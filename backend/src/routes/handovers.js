const router = require('express').Router();
const { z } = require('zod');
const HandoverLog = require('../models/HandoverLog');
const Tenant = require('../models/Tenant');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, parse } = require('../utils/http');
const { processHandover } = require('../services/handover');

const serialList = z.array(z.string().min(1).max(40)).max(300).default([]);

// POST /api/handovers : one payload for the whole drop-off (e.g. 30 full bottles in, 30 empties out).
router.post('/', requireRole('driver', 'manager', 'owner'), asyncHandler(async (req, res) => {
  const input = parse(z.object({
    idempotencyKey: z.string().min(8).max(80),
    depotId: z.string().min(12),
    cylindersDelivered: serialList,
    cylindersCollected: serialList,
    cashCollectedXAF: z.number().min(0),
    paymentMethod: z.enum(['Cash', 'MoMo', 'Orange_Money']).default('Cash'),
    clientCreatedAt: z.coerce.date().optional(),
  }), req.body);
  const tenant = await Tenant.findById(req.tenantId);
  const { log, duplicate } = await processHandover({ tenant, driver: req.user, input });
  res.status(duplicate ? 200 : 201).json({
    duplicate,
    handover: log,
    summary: {
      delivered: log.cylindersDelivered.length, collected: log.cylindersCollected.length, balanced: log.balanced,
      deficitCount: log.deficitCount, deficitChargeXAF: log.deficitChargeXAF,
      expectedCashXAF: log.expectedCashXAF, cashShortfallXAF: log.cashShortfallXAF,
    },
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenantId };
  if (req.user.role === 'driver') filter.driverId = req.user._id;
  else if (req.query.driverId) filter.driverId = req.query.driverId;
  if (req.query.depotId) filter.depotId = req.query.depotId;
  if (req.query.unbalanced === 'true') filter.balanced = false;
  const limit = Math.min(100, Number(req.query.limit) || 30);
  res.json(await HandoverLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('depotId', 'shopName neighborhood').populate('driverId', 'name'));
}));

module.exports = router;
