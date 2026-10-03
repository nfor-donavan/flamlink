// Computes a depot's health label from stock vs its safety threshold.
function computeStatus(depot, warnFactor = 1.5) {
  const stock = depot.currentStockCount;
  const min = depot.minimumSafetyStock;
  if (stock <= 0) return 'OUT';
  if (stock < min) return 'CRITICAL';
  if (stock < min * warnFactor) return 'LOW';
  return 'HEALTHY';
}

// Bottles to request so the depot lands comfortably above safety stock (3x the threshold).
function suggestedTopUp(depot) {
  return Math.max(depot.minimumSafetyStock * 3 - depot.currentStockCount, depot.minimumSafetyStock);
}

module.exports = { computeStatus, suggestedTopUp };
