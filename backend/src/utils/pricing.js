// Default price table (XAF). Tenants can override every value in Tenant.settings.pricing.
const DEFAULT_PRICING = {
  kg6:    { depositXAF: 8000,  wholesaleXAF: 3200,  maxRetailXAF: 3500 },
  kg12_5: { depositXAF: 15000, wholesaleXAF: 5800,  maxRetailXAF: 6500 },
  kg28:   { depositXAF: 30000, wholesaleXAF: 12500, maxRetailXAF: 14000 },
  kg50:   { depositXAF: 45000, wholesaleXAF: 22000, maxRetailXAF: 25000 },
};
const sizeKey = (sizeKg) => `kg${String(sizeKg).replace('.', '_')}`;
const priceFor = (tenant, sizeKg) => {
  const custom = tenant && tenant.settings && tenant.settings.pricing && tenant.settings.pricing[sizeKey(sizeKg)];
  return { ...DEFAULT_PRICING[sizeKey(sizeKg)], ...(custom || {}) };
};
module.exports = { DEFAULT_PRICING, sizeKey, priceFor };
