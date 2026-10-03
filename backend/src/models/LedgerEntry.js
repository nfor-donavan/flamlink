const mongoose = require('mongoose');

// Retailer accounting file. Positive amountXAF = retailer owes the distributor. Negative = credit / payment.
const LedgerEntrySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  depotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot', required: true },
  type: { type: String, enum: ['deficit_charge', 'cash_shortfall', 'empty_credit', 'payment', 'adjustment'], required: true },
  amountXAF: { type: Number, required: true },
  note: String,
  handoverId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandoverLog' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });

LedgerEntrySchema.index({ tenantId: 1, depotId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
