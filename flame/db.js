const mongoose = require('mongoose');
const logger = require('./utils/logger');

let flameConn = null;

// Set by close() so a retry that is mid-flight does not recreate the connection
// the process is shutting down.
let closing = false;

// Backoff bounds for reconnection. One second is short enough that a brief blip
// costs almost nothing, and one minute is long enough that a genuinely dead
// database is not hammered — while still recovering within a minute of it
// coming back, without anyone having to notice and restart the process.
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 60000;

// Exposed so the retry schedule is testable without waiting on real timers.
function backoffMs(attempt) {
  return Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
}

const sleepFor = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Lazily create the connection object so model files can call getConn() at
// module-load time without first awaiting connect(). mongoose.createConnection()
// returns synchronously; models can bind to a connection that is still opening.
function ensureConn() {
  if (flameConn) return flameConn;

  const uri = process.env.FLAME_MONGO_URI;
  if (!uri) throw new Error('FLAME_MONGO_URI not set — check config/config.env');

  flameConn = mongoose.createConnection(uri, {
    maxPoolSize: 10,
    // Overridable so tests can fail fast instead of waiting out a real timeout.
    serverSelectionTimeoutMS:
      Number(process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  return flameConn;
}

// Throws away a connection whose initial handshake never completed.
//
// This matters more than it looks. Mongoose does not reliably transition such a
// connection to 'connected' later, so reusing it means every model bound to it
// keeps buffering until mongoose's 10s bufferTimeoutMS and then throws
// `Operation \`users.findOne()\` buffering timed out` — forever, on a database
// that may have been reachable again for hours.
async function discard() {
  const dead = flameConn;
  flameConn = null;
  if (!dead) return;
  try {
    await dead.close();
  } catch {
    // A connection that never opened may refuse to close. Dropping the
    // reference is what actually matters.
  }
}

/**
 * Opens the Flame connection, retrying with exponential backoff.
 *
 * server.js calls this fire-and-forget — `flameDb.connect().catch(...)` — so a
 * Flame failure can never take BananaTalk down. That isolation is deliberate
 * and stays. What it used to hide was that a single failed attempt was final:
 * one unreachable-Atlas moment (an IP-allowlist lapse) left Flame dead for the
 * life of the process, 500ing every request with a buffering timeout while the
 * same credentials worked fine from a shell on the same box. Only a manual
 * restart brought it back. Retrying here is what makes that self-healing.
 *
 * `retries` defaults to Infinity: for the server's startup call, giving up is
 * never the right answer — the database coming back an hour later should heal
 * Flame on its own. Callers that need a bounded wait (tests, scripts) pass one.
 *
 * @param {object}   [opts]
 * @param {number}   [opts.retries=Infinity] retries after the first attempt.
 * @param {function} [opts.sleep]            delay function, injectable for tests.
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connect({ retries = Infinity, sleep = sleepFor } = {}) {
  // A missing URI is a configuration error, not a transient one. Retrying it
  // forever would turn a loud startup failure into a silent hang.
  if (!process.env.FLAME_MONGO_URI) {
    throw new Error('FLAME_MONGO_URI not set — check config/config.env');
  }

  closing = false;

  for (let attempt = 1; ; attempt += 1) {
    try {
      ensureConn();
      if (flameConn.readyState !== 1) await flameConn.asPromise();
      return flameConn;
    } catch (err) {
      await discard();

      // close() was called while this attempt was in flight — during a graceful
      // shutdown, say. Recreating the connection now would resurrect what the
      // process is trying to tear down.
      if (closing) throw err;

      if (attempt > retries) {
        logger.error(`MongoDB connect failed after ${attempt} attempt(s): ${err.message}`);
        throw err;
      }

      const wait = backoffMs(attempt);
      logger.warn(
        `MongoDB connect attempt ${attempt} failed (${err.message}) — retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
}

function getConn() {
  return ensureConn();
}

async function close() {
  closing = true;
  if (flameConn) {
    await flameConn.close();
    flameConn = null;
  }
}

module.exports = { connect, getConn, close, backoffMs };
