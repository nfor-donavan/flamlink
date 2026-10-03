const mongoose = require('mongoose');

// Auto-generated instruction: "go top up this depot". Created when a depot turns CRITICAL.
const DispatchOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  depotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suggestedQuantity: { type: Number, required: true },
  distanceKm: Number,
  reason: { type: String, enum: ['critical_stock', 'out_of_stock', 'manual'], default: 'critical_stock' },
  status: { type: String, enum: ['pending', 'accepted', 'completed', 'cancelled'], default: 'pending' },
  completedByHandoverId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandoverLog' },
}, { timestamps: true });

DispatchOrderSchema.index({ tenantId: 1, depotId: 1, status: 1 });
DispatchOrderSchema.index({ tenantId: 1, driverId: 1, status: 1 });

module.exports = mongoose.model('DispatchOrder', DispatchOrderSchema);
