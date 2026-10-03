const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/http');

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), tenantId: String(user.tenantId), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Authenticates the request and pins it to ONE tenant. Every query downstream must filter on req.tenantId.
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Missing access token');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findOne({ _id: payload.sub, tenantId: payload.tenantId, active: true });
  if (!user) throw new HttpError(401, 'Account not found or disabled');
  req.user = user;
  req.tenantId = user.tenantId;
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this action'));
  next();
};

module.exports = { signToken, requireAuth, requireRole };
