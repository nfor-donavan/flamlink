const mongoose = require('mongoose');

const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: 'Validation failed', details: Object.values(err.errors).map((e) => e.message) });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', details: err.keyValue });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Server error' : err.message, details: err.details });
};

module.exports = { notFound, errorHandler };
