// Demo data for Yaoundé: `npm run seed`. WARNING: wipes the collections it fills.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const Tenant = require('./models/Tenant');
const User = require('./models/User');
const Depot = require('./models/Depot');
const Cylinder = require('./models/Cylinder');
const CylinderEvent = require('./models/CylinderEvent');
const HandoverLog = require('./models/HandoverLog');
const LedgerEntry = require('./models/LedgerEntry');
const PriceReport = require('./models/PriceReport');
const DispatchOrder = require('./models/DispatchOrder');
const { evaluateDepot } = require('./services/dispatch');

const PASSWORD = 'Flamlink123!';
const BRANDS = ['SCTM', 'Tradex', 'Total', 'Afrigaz'];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const jitter = (v) => v + (Math.random() - 0.5) * 0.006;

const DEPOTS = [
  ['Boutique Chez Amadou', 'Bastos', 3.890, 11.510, 5, 18], ['Épicerie La Paix', 'Bastos', 3.893, 11.514, 5, 2],
  ['Dépôt Nlongkak Centre', 'Nlongkak', 3.880, 11.517, 6, 14], ['Chez Mama Rose', 'Mvog-Ada', 3.865, 11.523, 5, 0],
  ['Quincaillerie Mvog-Ada', 'Mvog-Ada', 3.867, 11.526, 5, 9], ['Boutique Le Bon Prix', 'Mimboman', 3.878, 11.545, 6, 3],
  ['Dépôt Mimboman Carrefour', 'Mimboman', 3.881, 11.542, 6, 16], ['Chez Pa Joseph', 'Essos', 3.873, 11.535, 5, 7],
  ['Gaz Express Essos', 'Essos', 3.871, 11.532, 5, 12], ['Biyem-Assi Gaz Shop', 'Biyem-Assi', 3.830, 11.480, 8, 4],
  ['Boutique Nouvelle Étoile', 'Biyem-Assi', 3.833, 11.484, 6, 15], ['Dépôt Melen Marché', 'Melen', 3.864, 11.500, 5, 8],
  ['Chez Tonton Paul', 'Mokolo', 3.870, 11.510, 5, 1], ['Dépôt Ngousso', 'Ngousso', 3.900, 11.540, 5, 11],
  ['Épicerie Odza Village', 'Odza', 3.800, 11.540, 5, 6], ['Dépôt Emana', 'Emana', 3.930, 11.520, 5, 13],
];

(async () => {
  await mongoose.connect(config.mongoUri);
  await Promise.all([Tenant, User, Depot, Cylinder, CylinderEvent, HandoverLog, LedgerEntry, PriceReport, DispatchOrder].map((m) => m.deleteMany({})));
  const hash = await bcrypt.hash(PASSWORD, 10);

  const tenant = await Tenant.create({ name: 'Gaz Capitale Distribution', slug: 'gaz-capitale', city: 'Yaoundé' });
  const tid = tenant._id;
  const owner = await User.create({ tenantId: tid, name: 'Donovan (Owner)', email: 'owner@gazcapitale.cm', role: 'owner', passwordHash: hash });
  await User.create({ tenantId: tid, name: 'Aïcha Manager', email: 'manager@gazcapitale.cm', role: 'manager', passwordHash: hash });
  const now = new Date();
  const drivers = await User.insertMany([
    ['Samuel Ndzana', '670000001', 'LT-482-CE', 3.885, 11.515], ['Hervé Mbarga', '670000002', 'CE-913-LT', 3.835, 11.490],
    ['Brice Tchoua', '670000003', 'CE-227-AB', 3.875, 11.540],
  ].map(([name, phone, plate, lat, lng]) => ({ tenantId: tid, name, phone, role: 'driver', passwordHash: hash, vehicle: { plate, lastLocation: { lat, lng }, lastSeenAt: now } })));

  let serialCounter = 1;
  const mk = (brand, patch) => ({ tenantId: tid, brand, sizeKg: 12.5, barcodeSerial: `${brand.slice(0, 3).toUpperCase()}-${String(serialCounter++).padStart(6, '0')}`, ...patch });
  const cylinders = [];

  const depots = [];
  for (const [shopName, neighborhood, lat, lng, minimumSafetyStock, stock] of DEPOTS) {
    const brand = BRANDS[rnd(0, 3)];
    const d = await Depot.create({ tenantId: tid, shopName, neighborhood, ownerName: shopName.split(' ').pop(), ownerPhone: `69${rnd(1000000, 9999999)}`, location: { lat: jitter(lat), lng: jitter(lng) }, minimumSafetyStock, currentStockCount: stock });
    depots.push(d);
    for (let i = 0; i < stock; i += 1) cylinders.push(mk(brand, { currentStatus: 'At_Retailer_Full', isFull: true, currentDepotId: d._id, lastMovedAt: new Date(Date.now() - rnd(0, 4) * 86400000) }));
    const empties = rnd(2, 14);
    for (let i = 0; i < empties; i += 1) cylinders.push(mk(brand, { currentStatus: 'At_Retailer_Empty', isFull: false, currentDepotId: d._id, lastMovedAt: new Date(Date.now() - rnd(0, 9) * 86400000) }));
  }
  // Plant stock and trucks
  for (let i = 0; i < 120; i += 1) cylinders.push(mk(BRANDS[rnd(0, 3)], { currentStatus: 'At_Plant_Filled', isFull: true }));
  for (let i = 0; i < 60; i += 1) cylinders.push(mk(BRANDS[rnd(0, 3)], { currentStatus: 'At_Plant_Empty' }));
  drivers.forEach((drv) => {
    for (let i = 0; i < 30; i += 1) cylinders.push(mk(BRANDS[rnd(0, 3)], { currentStatus: 'In_Transit', isFull: true, currentHolderId: drv._id }));
    for (let i = 0; i < 8; i += 1) cylinders.push(mk(BRANDS[rnd(0, 3)], { currentStatus: 'In_Transit', isFull: false, currentHolderId: drv._id }));
  });
  await Cylinder.insertMany(cylinders);

  // 7 days of sales history so the stock-out forecast has a curve to work with
  const events = [];
  const sample = cylinders.filter((c) => c.currentDepotId).slice(0, 400);
  for (const c of sample) {
    if (Math.random() < 0.6) events.push({ tenantId: tid, cylinderId: new mongoose.Types.ObjectId(), barcodeSerial: c.barcodeSerial, fromStatus: 'At_Retailer_Full', toStatus: 'At_Retailer_Empty', action: 'sale', depotId: c.currentDepotId, createdAt: new Date(Date.now() - rnd(0, 6) * 86400000) });
  }
  await CylinderEvent.insertMany(events);

  // Handover history
  const logs = [];
  for (let day = 6; day >= 0; day -= 1) {
    for (let k = 0; k < rnd(4, 9); k += 1) {
      const d = depots[rnd(0, depots.length - 1)]; const drv = drivers[rnd(0, 2)]; const n = rnd(6, 24); const miss = Math.random() < 0.15 ? rnd(1, 3) : 0;
      logs.push({ tenantId: tid, idempotencyKey: `seed-${day}-${k}-${Math.random().toString(36).slice(2)}`, driverId: drv._id, depotId: d._id,
        cylindersDelivered: Array.from({ length: n }, (_, i) => `SEED-D-${day}-${k}-${i}`), cylindersCollected: Array.from({ length: n - miss }, (_, i) => `SEED-C-${day}-${k}-${i}`),
        cashCollectedXAF: n * 5800, expectedCashXAF: n * 5800, deficitCount: miss, deficitChargeXAF: miss * 15000, balanced: miss === 0, paymentMethod: ['Cash', 'MoMo', 'Orange_Money'][rnd(0, 2)],
        createdAt: new Date(Date.now() - day * 86400000 - rnd(0, 10) * 3600000) });
    }
  }
  const saved = await HandoverLog.insertMany(logs);
  await LedgerEntry.insertMany(saved.filter((l) => l.deficitChargeXAF > 0).map((l) => ({ tenantId: tid, depotId: l.depotId, type: 'deficit_charge', amountXAF: l.deficitChargeXAF, note: `${l.deficitCount} empty bottle(s) missing`, handoverId: l._id, createdBy: l.driverId })));

  // Gouging and hoarding reports
  const bad = [depots[1], depots[3], depots[5]];
  await PriceReport.insertMany([
    { tenantId: tid, depotId: bad[0]._id, kind: 'price', brand: 'Total', sizeKg: 12.5, priceXAF: 9000, maxRetailXAF: 6500, violation: true, source: 'customer' },
    { tenantId: tid, depotId: bad[1]._id, kind: 'price', brand: 'SCTM', sizeKg: 12.5, priceXAF: 8500, maxRetailXAF: 6500, violation: true, source: 'driver', reporterId: drivers[0]._id },
    { tenantId: tid, depotId: bad[2]._id, kind: 'price', brand: 'Tradex', sizeKg: 12.5, priceXAF: 7500, maxRetailXAF: 6500, violation: true, source: 'customer' },
    { tenantId: tid, depotId: depots[0]._id, kind: 'price', brand: 'Afrigaz', sizeKg: 12.5, priceXAF: 6500, maxRetailXAF: 6500, violation: false, source: 'driver', reporterId: drivers[1]._id },
  ]);

  for (const d of depots) await evaluateDepot(d._id, { tenant });
  console.log(`Seeded ${depots.length} depots, ${cylinders.length} cylinders, ${logs.length} handovers.`);
  console.log(`Company code: ${tenant.slug}\nOwner:   owner@gazcapitale.cm / ${PASSWORD}\nManager: manager@gazcapitale.cm / ${PASSWORD}\nDrivers: 670000001, 670000002, 670000003 / ${PASSWORD}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
