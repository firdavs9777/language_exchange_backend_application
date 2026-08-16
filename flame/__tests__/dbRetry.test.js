const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

// Flame's connection is deliberately fire-and-forget from server.js:32 —
// `flameDb.connect().catch(...)` — so a Flame failure can never take BananaTalk
// down. But with a single attempt behind that catch, one unreachable-Atlas
// moment (an IP-allowlist lapse) left the connection at readyState !== 1 for the
// life of the process. Every Flame query then buffered for mongoose's default
// 10s and threw `Operation \`users.findOne()\` buffering timed out`, producing
// 500s on a box where the same credentials worked fine from a shell. Only a
// manual pm2 restart recovered it. Twice.
//
// These tests pin the retry that makes that self-healing.

function freshDb() {
  delete require.cache[require.resolve('../db')];
  return require('../db');
}

// An unroutable address: port 1 is closed, so server selection fails fast
// rather than hanging for the full timeout.
const DEAD_URI = 'mongodb://127.0.0.1:1/flame_retry_test';

test('backoff grows exponentially and is capped', () => {
  const { backoffMs } = freshDb();

  assert.equal(backoffMs(1), 1000);
  assert.equal(backoffMs(2), 2000);
  assert.equal(backoffMs(3), 4000);
  assert.ok(
    backoffMs(20) <= 60000,
    'an unbounded backoff would stop retrying in any useful window',
  );
  assert.equal(backoffMs(20), 60000, 'and it should sit at the cap, not below it');
});

test('connect retries a failing connection instead of giving up after one attempt', async () => {
  process.env.FLAME_MONGO_URI = DEAD_URI;
  process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS = '50';
  const { connect, close } = freshDb();

  const waits = [];
  await assert.rejects(
    () => connect({ retries: 2, sleep: async (ms) => { waits.push(ms); } }),
    /flame_retry_test|ECONNREFUSED|connect/i,
  );

  assert.equal(waits.length, 2, 'two retries means two waits before the final throw');
  assert.deepEqual(waits, [1000, 2000], 'and they back off rather than hammering');

  await close();
});

test('connect succeeds once the database becomes reachable', async (t) => {
  process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS = '50';
  const { connect, close } = freshDb();

  // start() sets FLAME_MONGO_URI itself, so point it at the dead address
  // afterwards — otherwise the first attempt succeeds and nothing is tested.
  const uri = await dbHelper.start();
  process.env.FLAME_MONGO_URI = DEAD_URI;
  t.after(async () => {
    await close();
    await dbHelper.stop();
  });

  // The URI is repaired between attempt 1 and attempt 2, standing in for Atlas
  // becoming reachable again. A single-attempt connect would have thrown and
  // stayed dead; this must pick the recovery up on its own.
  let attempt = 0;
  const conn = await connect({
    retries: 5,
    sleep: async () => { process.env.FLAME_MONGO_URI = uri; attempt += 1; },
  });

  assert.equal(conn.readyState, 1, 'the retry must reach a genuinely connected state');
  assert.equal(attempt, 1, 'and it should stop retrying the moment it succeeds');
});

test('a missing FLAME_MONGO_URI fails immediately instead of retrying forever', async () => {
  const saved = process.env.FLAME_MONGO_URI;
  delete process.env.FLAME_MONGO_URI;
  const { connect } = freshDb();

  let slept = false;
  try {
    // Retrying a configuration error would turn a loud startup failure into a
    // silent hang — the process would look healthy and never serve Flame.
    await assert.rejects(
      () => connect({ retries: 3, sleep: async () => { slept = true; } }),
      /FLAME_MONGO_URI not set/,
    );
    assert.equal(slept, false, 'it must not back off and try again');
  } finally {
    if (saved) process.env.FLAME_MONGO_URI = saved;
  }
});

test('close() stops a retry loop that is mid-flight', async () => {
  process.env.FLAME_MONGO_URI = DEAD_URI;
  process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS = '50';
  const { connect, close } = freshDb();

  // Stand in for a graceful shutdown landing between two attempts. Without the
  // guard, the next iteration recreates the connection the process is tearing
  // down, and shutdown never completes.
  let waits = 0;
  await assert.rejects(
    () => connect({
      retries: Infinity,
      sleep: async () => { waits += 1; await close(); },
    }),
  );

  assert.equal(waits, 1, 'one wait, then close() ends the loop rather than it running forever');
});

test('a failed attempt does not poison the next one', async (t) => {
  process.env.FLAME_MONGO_SERVER_SELECTION_TIMEOUT_MS = '50';
  const { connect, getConn, close } = freshDb();

  const uri = await dbHelper.start();
  process.env.FLAME_MONGO_URI = DEAD_URI;
  t.after(async () => {
    await close();
    await dbHelper.stop();
  });

  // Bind a connection to the dead address the way a model file would at
  // module-load time, before connect() has ever run.
  const dead = getConn();

  process.env.FLAME_MONGO_URI = uri;
  const live = await connect({ retries: 3, sleep: async () => {} });

  assert.notEqual(live.readyState, 0);
  assert.ok(
    !Object.is(dead, live),
    'the connection object that never completed its handshake must be discarded, '
      + 'not reused — mongoose does not reliably transition one out of that state, '
      + 'and every model bound to it would keep buffering',
  );
  assert.equal(getConn(), live, 'and getConn must hand out the live one afterwards');
});
