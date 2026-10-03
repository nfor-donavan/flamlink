const mongoose = require('mongoose');

// Retail price / availability observations. They power anti-gouging and anti-hoarding detection.
const PriceReportSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  depotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot', required: true },
  kind: { type: String, enum: ['price', 'no_stock'], default: 'price' },
  brand: String,
  sizeKg: { type: Number, enum: [12.5, 6, 28, 50], default: 12.5 },
  priceXAF: Number,
  maxRetailXAF: Number, // ceiling at the time of the report
  violation: { type: Boolean, default: false },
  source: { type: String, enum: ['driver', 'customer', 'manager'], default: 'customer' },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });

PriceReportSchema.index({ tenantId: 1, depotId: 1, createdAt: -1 });
PriceReportSchema.index({ tenantId: 1, violation: 1, createdAt: -1 });

module.exports = mongoose.model('PriceReport', PriceReportSchema);
