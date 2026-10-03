const mongoose = require('mongoose');

// Append-only audit trail: every state change of every bottle.
const CylinderEventSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cylinderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cylinder', required: true },
  barcodeSerial: { type: String, required: true },
  fromStatus: String,
  toStatus: { type: String, required: true },
  action: { type: String, required: true }, // register | fill | load | deliver | collect | return | sale | scrap
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  depotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  handoverId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandoverLog' },
}, { timestamps: { createdAt: true, updatedAt: false } });

CylinderEventSchema.index({ tenantId: 1, barcodeSerial: 1, createdAt: -1 });

module.exports = mongoose.model('CylinderEvent', CylinderEventSchema);
