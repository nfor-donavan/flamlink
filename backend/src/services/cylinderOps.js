const Cylinder = require('../models/Cylinder');
const CylinderEvent = require('../models/CylinderEvent');
const { HttpError } = require('../utils/http');
const { withTx } = require('../utils/tx');

const norm = (list) => [...new Set((list || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];

// Plant-side lifecycle actions, each only legal from specific states.
const ACTIONS = {
  fill:   { from: (c) => c.currentStatus === 'At_Plant_Empty', to: { currentStatus: 'At_Plant_Filled', isFull: true }, unset: ['currentHolderId', 'currentDepotId'] },
  load:   { from: (c) => c.currentStatus === 'At_Plant_Filled', to: { currentStatus: 'In_Transit', isFull: true }, needsDriver: true, unset: ['currentDepotId'] },
  return: { from: (c) => c.currentStatus === 'In_Transit' && !c.isFull, to: { currentStatus: 'At_Plant_Empty', isFull: false }, unset: ['currentHolderId', 'currentDepotId'] },
  scrap:  { from: (c) => c.currentStatus !== 'Scrapped', to: { currentStatus: 'Scrapped', isFull: false }, unset: ['currentHolderId', 'currentDepotId'] },
};
const TO_STATUS = { fill: 'At_Plant_Filled', load: 'In_Transit', return: 'At_Plant_Empty', scrap: 'Scrapped' };

async function transition({ tenantId, actorId, action, serials, driverId }) {
  const rule = ACTIONS[action];
  if (!rule) throw new HttpError(400, 'Unknown action');
  const list = norm(serials);
  if (!list.length) throw new HttpError(400, 'No serials provided');
  if (rule.needsDriver && !driverId) throw new HttpError(400, 'driverId is required to load a truck');

  return withTx(async (session) => {
    const docs = await Cylinder.find({ tenantId, barcodeSerial: { $in: list } }).session(session);
    const found = new Set(docs.map((c) => c.barcodeSerial));
    const problems = [
      ...list.filter((s) => !found.has(s)).map((s) => ({ serial: s, reason: 'Unknown bottle' })),
      ...docs.filter((c) => !rule.from(c)).map((c) => ({ serial: c.barcodeSerial, reason: `Cannot ${action} a bottle that is ${c.currentStatus}${c.isFull ? ' (full)' : ''}` })),
    ];
    if (problems.length) throw new HttpError(422, 'Some bottles cannot be moved', problems);

    const $set = { ...rule.to, lastMovedAt: new Date() };
    if (rule.needsDriver) $set.currentHolderId = driverId;
    const update = { $set };
    if (rule.unset.length) update.$unset = Object.fromEntries(rule.unset.map((k) => [k, '']));
    await Cylinder.updateMany({ tenantId, barcodeSerial: { $in: list } }, update, { session });
    await CylinderEvent.insertMany(docs.map((c) => ({
      tenantId, cylinderId: c._id, barcodeSerial: c.barcodeSerial, fromStatus: c.currentStatus, toStatus: TO_STATUS[action], action, actorId,
    })), { session });
    return { moved: list.length };
  });
}

module.exports = { transition, norm };
