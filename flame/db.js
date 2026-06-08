const mongoose = require('mongoose');
const logger = require('./utils/logger');

let flameConn = null;

async function connect() {
  if (flameConn && flameConn.readyState === 1) return flameConn;

  const uri = process.env.FLAME_MONGO_URI;
  if (!uri) throw new Error('FLAME_MONGO_URI not set');

  flameConn = mongoose.createConnection(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await flameConn.asPromise();
  return flameConn;
}

function getConn() {
  if (!flameConn) throw new Error('Flame DB not initialized — call connect() first');
  return flameConn;
}

async function close() {
  if (flameConn) {
    await flameConn.close();
    flameConn = null;
  }
}

module.exports = { connect, getConn, close };
