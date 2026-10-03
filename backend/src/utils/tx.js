const mongoose = require('mongoose');
const config = require('../config');

// Runs fn(session) atomically. With USE_TRANSACTIONS=false (standalone local mongod) it runs without a session.
async function withTx(fn) {
  if (!config.useTransactions) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
module.exports = { withTx };
