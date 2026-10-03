const mongoose = require('mongoose');

const STATUSES = ['At_Plant_Empty', 'At_Plant_Filled', 'In_Transit', 'At_Retailer_Full', 'At_Retailer_Empty', 'Scrapped'];

// 1. CYLINDER ASSET (the individual metal bottle)
const CylinderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  barcodeSerial: { type: String, required: true, trim: true, uppercase: true }, // stamped on the steel neck ring
  brand: { type: String, enum: ['SCTM', 'Tradex', 'Total', 'Afrigaz', 'Camgaz'], required: true },
  sizeKg: { type: Number, enum: [12.5, 6, 28, 50], default: 12.5 },
  currentStatus: { type: String, enum: STATUSES, default: 'At_Plant_Empty' },
  // True while the bottle contains gas. A truck carries both full (outbound) and empty (inbound) bottles in In_Transit.
  isFull: { type: Boolean, default: false },
  currentHolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // driver holding the asset
  currentDepotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' }, // depot holding the asset
  lastMovedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Serials are unique inside a tenant, so competing distributors never collide or see each other's assets.
CylinderSchema.index({ tenantId: 1, barcodeSerial: 1 }, { unique: true });
CylinderSchema.index({ tenantId: 1, currentStatus: 1 });
CylinderSchema.index({ tenantId: 1, currentDepotId: 1, currentStatus: 1 });

module.exports = mongoose.model('Cylinder', CylinderSchema);
module.exports.STATUSES = STATUSES;
