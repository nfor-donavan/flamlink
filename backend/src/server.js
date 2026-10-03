const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { sweepAllTenants } = require('./services/dispatch');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'flamlink-api', db: mongoose.connection.readyState === 1 }));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), require('./routes/auth'));
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/cylinders', requireAuth, require('./routes/cylinders'));
app.use('/api/depots', requireAuth, require('./routes/depots'));
app.use('/api/handovers', requireAuth, require('./routes/handovers'));
app.use('/api/inventory', requireAuth, require('./routes/inventory'));
app.use('/api/dispatch', requireAuth, require('./routes/dispatch'));
app.use('/api/ledger', requireAuth, require('./routes/ledger'));
app.use('/api/prices', requireAuth, require('./routes/prices'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));

app.use(notFound);
app.use(errorHandler);

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
  app.listen(config.port, () => console.log(`Flamlink API listening on :${config.port}`));
  // Safety net so a shortage is caught even if nobody triggers a stock movement.
  setInterval(() => sweepAllTenants().catch((e) => console.error('Sweep failed', e)), config.sweepIntervalMin * 60 * 1000);
}

if (require.main === module) start().catch((err) => { console.error(err); process.exit(1); });
module.exports = app;
