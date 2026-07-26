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

// Resilient connect. The old version awaited a single asPromise() and gave up
// on the first serverSelectionTimeout — so a transient failure right after a
// deploy (the app boots before Atlas is reachable for the new process) left the
// connection stuck buffering forever, needing a manual `pm2 restart`. The driver
// keeps monitoring the topology in the background, so instead of giving up we
// poll readyState until it connects (self-heal) or a generous timeout elapses.
async function connect({ timeoutMs = 90000, retryDelayMs = 2000 } = {}) {
  ensureConn();
  const start = Date.now();

  // Kick the initial connection; tolerate a first-attempt failure.
  try {
    if (flameConn.readyState !== 1) await flameConn.asPromise();
  } catch (err) {
    logger.warn(`initial MongoDB connect failed, will keep polling: ${err.message}`);
  }

  // Poll live readyState — the background monitor reconnects on its own.
  while (flameConn.readyState !== 1) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `FLAME MongoDB not connected after ${timeoutMs}ms (readyState=${flameConn.readyState})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
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
