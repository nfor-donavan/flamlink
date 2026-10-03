const mongoose = require('mongoose');
const { DEFAULT_PRICING } = require('../utils/pricing');

const priceRow = { depositXAF: Number, wholesaleXAF: Number, maxRetailXAF: Number };

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  city: { type: String, default: 'Yaoundé' },
  active: { type: Boolean, default: true },
  settings: {
    // Price table per cylinder size: deposit for a missing metal shell, wholesale gas price, legal retail ceiling.
    pricing: {
      kg6: { type: priceRow, default: () => ({ ...DEFAULT_PRICING.kg6 }) },
      kg12_5: { type: priceRow, default: () => ({ ...DEFAULT_PRICING.kg12_5 }) },
      kg28: { type: priceRow, default: () => ({ ...DEFAULT_PRICING.kg28 }) },
      kg50: { type: priceRow, default: () => ({ ...DEFAULT_PRICING.kg50 }) },
    },
    // Stock < safety stock => CRITICAL. Stock < safety * warnFactor => LOW.
    lowStockWarnFactor: { type: Number, default: 1.5 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Tenant', TenantSchema);
