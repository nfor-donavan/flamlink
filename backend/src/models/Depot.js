const mongoose = require('mongoose');

// 2. RETAIL DEPOT (neighbourhood shop)
const DepotSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  shopName: { type: String, required: true, trim: true },
  neighborhood: { type: String, required: true, trim: true },
  ownerName: { type: String, trim: true },
  ownerPhone: { type: String, required: true, trim: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: { lat: Number, lng: Number },
  currentStockCount: { type: Number, default: 0, min: 0 }, // full bottles on the shelf
  minimumSafetyStock: { type: Number, default: 5, min: 0 },
  status: { type: String, enum: ['HEALTHY', 'LOW', 'CRITICAL', 'OUT'], default: 'HEALTHY' },
  statusChangedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
}, { timestamps: true });

DepotSchema.index({ tenantId: 1, status: 1 });
DepotSchema.index({ tenantId: 1, neighborhood: 1 });

module.exports = mongoose.model('Depot', DepotSchema);
