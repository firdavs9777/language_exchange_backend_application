const mongoose = require('mongoose');
const logger = require('./utils/logger');

let flameConn = null;

// Set by close() so a retry that is mid-flight does not reopen the connection
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

function options() {
  return {
    maxPoolSize: 10,
    // Overridable so tests can fail fast instead of waiting out a real timeout.
    serverSelectionTimeoutMS:
      Number(process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };
}

/// Returns the one connection object Flame will ever use.
//
// Created WITHOUT a URI on purpose. `mongoose.createConnection(uri)` starts
// connecting immediately and gives no way to retry that first handshake on the
// same object; `createConnection()` returns an unopened connection that models
// can bind to and that connect() then opens, and reopens, as many times as it
// takes.
//
// That distinction is load-bearing. server.js requires ./flame (and through it
// every model) BEFORE calling connect(), and each model file ends with
// `getConn().model('Name', schema)` — so the models bind to whatever this
// returns, once, at module-load time. If connect() ever swapped this object for
// a fresh one, every model would still point at the old one and their queries
// would buffer until mongoose gave up, which is exactly the
// `Operation \`users.findOne()\` buffering timed out` that took Flame down.
function ensureConn() {
  if (flameConn) return flameConn;

  flameConn = mongoose.createConnection();

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  return flameConn;
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
 * restart brought it back.
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
  const conn = ensureConn();

  for (let attempt = 1; ; attempt += 1) {
    try {
      if (conn.readyState === 1) return conn;
      // readyState 2 means a previous openUri is still in flight; calling
      // openUri again on an active connection throws, so wait that one out.
      if (conn.readyState === 2) {
        await conn.asPromise();
      } else {
        // Re-read the URI each attempt: an operator can fix config and restart
        // nothing, and a test can repair it between retries.
        await conn.openUri(process.env.FLAME_MONGO_URI, options());
      }
      return conn;
    } catch (err) {
      // close() was called while this attempt was in flight — during a graceful
      // shutdown, say. Reopening now would fight the teardown.
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
