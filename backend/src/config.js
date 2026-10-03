require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flamlink',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  useTransactions: process.env.USE_TRANSACTIONS !== 'false',
  sweepIntervalMin: Number(process.env.SWEEP_INTERVAL_MIN || 2),
};
