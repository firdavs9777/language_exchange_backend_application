const { test } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// ROOMS_ENABLED — centralized in config/limitations.js (Task 7).
// ---------------------------------------------------------------------------

async function withRoomsEnabledEnv(value, fn) {
  const original = process.env.ROOMS_ENABLED;
  try {
    if (value === undefined) delete process.env.ROOMS_ENABLED;
    else process.env.ROOMS_ENABLED = value;
    delete require.cache[require.resolve('../config/limitations')];
    return await fn();
  } finally {
    if (original === undefined) delete process.env.ROOMS_ENABLED;
    else process.env.ROOMS_ENABLED = original;
    delete require.cache[require.resolve('../config/limitations')];
  }
}

test('config/limitations.js: ROOMS_ENABLED defaults to true when unset', async () => {
  await withRoomsEnabledEnv(undefined, () => {
    const { ROOMS_ENABLED } = require('../config/limitations');
    assert.equal(ROOMS_ENABLED, true);
  });
});

test('config/limitations.js: ROOMS_ENABLED is false when process.env.ROOMS_ENABLED=false', async () => {
  await withRoomsEnabledEnv('false', () => {
    const { ROOMS_ENABLED } = require('../config/limitations');
    assert.equal(ROOMS_ENABLED, false);
  });
});

// ---------------------------------------------------------------------------
// routes/rooms.js's kill-switch guard — extracted to
// lib/roomMembership.js:roomsEnabledGuard so it's unit testable without
// loading Express/jsonwebtoken (routes/rooms.js can't be require()'d
// standalone in this sandbox — see prior batch report).
// ---------------------------------------------------------------------------

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return res;
}

test('roomsEnabledGuard: calls next() when ROOMS_ENABLED is true (routes proceed normally)', async () => {
  await withRoomsEnabledEnv('true', () => {
    delete require.cache[require.resolve('../lib/roomMembership')];
    const { roomsEnabledGuard } = require('../lib/roomMembership');
    const res = mockRes();
    let nextCalled = false;
    roomsEnabledGuard({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });
});

test('roomsEnabledGuard: short-circuits to 404 when ROOMS_ENABLED is false', async () => {
  await withRoomsEnabledEnv('false', () => {
    delete require.cache[require.resolve('../lib/roomMembership')];
    const { roomsEnabledGuard } = require('../lib/roomMembership');
    const res = mockRes();
    let nextCalled = false;
    roomsEnabledGuard({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });
});

// ---------------------------------------------------------------------------
// controllers/appConfig.js — roomsEnabled flag in the app-config payload.
// This controller has no DB/auth dependency, so it loads and runs directly.
// ---------------------------------------------------------------------------

function mockAppConfigRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return res;
}

test('appConfig: roomsEnabled reflects true when ROOMS_ENABLED is on', async () => {
  await withRoomsEnabledEnv('true', async () => {
    delete require.cache[require.resolve('../controllers/appConfig')];
    const { getAppConfig } = require('../controllers/appConfig');
    const res = mockAppConfigRes();
    await getAppConfig({ query: {} }, res, () => {});
    assert.equal(res.body.data.roomsEnabled, true);
  });
});

test('appConfig: roomsEnabled reflects false when ROOMS_ENABLED is off (kill switch)', async () => {
  await withRoomsEnabledEnv('false', async () => {
    delete require.cache[require.resolve('../controllers/appConfig')];
    const { getAppConfig } = require('../controllers/appConfig');
    const res = mockAppConfigRes();
    await getAppConfig({ query: {} }, res, () => {});
    assert.equal(res.body.data.roomsEnabled, false);
  });
});
