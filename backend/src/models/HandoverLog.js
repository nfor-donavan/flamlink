const mongoose = require('mongoose');

// 3. LOGISTICS TRANSACTION (handover tracking)
const HandoverLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  idempotencyKey: { type: String, required: true }, // generated on the phone; makes retries over flaky networks safe
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  depotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot', required: true },
  cylindersDelivered: [{ type: String }], // serials of full bottles dropped off
  cylindersCollected: [{ type: String }], // serials of empty bottles reclaimed
  cashCollectedXAF: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['Cash', 'MoMo', 'Orange_Money'], default: 'Cash' },
  // Computed by the server
  expectedCashXAF: { type: Number, default: 0 },
  cashShortfallXAF: { type: Number, default: 0 },
  deficitCount: { type: Number, default: 0 }, // empties missing (delivered - collected, when positive)
  deficitChargeXAF: { type: Number, default: 0 },
  balanced: { type: Boolean, default: true },
  clientCreatedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

HandoverLogSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
HandoverLogSchema.index({ tenantId: 1, createdAt: -1 });
HandoverLogSchema.index({ tenantId: 1, depotId: 1, createdAt: -1 });

module.exports = mongoose.model('HandoverLog', HandoverLogSchema);
