const mongoose = require('mongoose');

const ROLES = ['owner', 'manager', 'driver', 'retailer'];

const UserSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  active: { type: Boolean, default: true },
  // Drivers: live position used to pick the nearest vehicle for emergency top-ups.
  vehicle: {
    plate: String,
    lastLocation: { lat: Number, lng: Number },
    lastSeenAt: Date,
  },
  expoPushToken: String,
}, { timestamps: true });

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
UserSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

module.exports = mongoose.model('User', UserSchema);
module.exports.ROLES = ROLES;
