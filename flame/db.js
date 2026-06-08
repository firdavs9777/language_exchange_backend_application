const mongoose = require('mongoose');
const logger = require('./utils/logger');

let flameConn = null;

// Lazily create the connection object so model files can call getConn() at
// module-load time without first awaiting connect(). mongoose.createConnection()
// returns synchronously; models can bind to a connection that is still opening.
function ensureConn() {
  if (flameConn) return flameConn;

  const uri = process.env.FLAME_MONGO_URI;
  if (!uri) throw new Error('FLAME_MONGO_URI not set — check config/config.env');

  flameConn = mongoose.createConnection(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  return flameConn;
}

async function connect() {
  ensureConn();
  if (flameConn.readyState !== 1) await flameConn.asPromise();
  return flameConn;
}

function getConn() {
  return ensureConn();
}

async function close() {
  if (flameConn) {
    await flameConn.close();
    flameConn = null;
  }
}

module.exports = { connect, getConn, close };
