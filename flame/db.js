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
    // Give the INITIAL connection a generous window. The driver force-closes the
    // topology (killing all background monitors) once server-selection is
    // exhausted on a failed first connect — after which only a process restart
    // can recover. A larger window lets a transient right after a deploy (the new
    // process booting before Atlas is reachable) clear during the initial connect
    // instead of hard-failing and needing a manual `pm2 restart`.
    // Tradeoff: this option is driver-global, so during a live outage after a
    // successful connect, operations also wait up to 30s (was 5s) before failing.
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
  });

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  return flameConn;
}

// Await the initial connection. The resilience against deploy-time transients
// comes from the generous serverSelectionTimeoutMS above (the driver retries
// server selection internally within that window); once it's exhausted the
// topology is force-closed and only a process restart recovers, so there is no
// point polling a dead connection here. On failure we surface a clear error.
async function connect() {
  ensureConn();
  if (flameConn.readyState !== 1) {
    try {
      await flameConn.asPromise();
    } catch (err) {
      logger.error(`FLAME MongoDB initial connect failed: ${err.message}`);
      throw err;
    }
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
