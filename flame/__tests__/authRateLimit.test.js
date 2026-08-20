// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

// One database for the whole file, and a fresh app per test.
//
// The per-test setup()/teardown() pattern used elsewhere spins a new in-memory
// Mongo for every test; by the sixth, model bindings from a stopped server
// surface as MongoNotConnectedError on an unrelated route. These tests need
// isolated *limiter counters*, not isolated data — and a limiter's state lives
// in the app instance, so rebuilding just the app gives exactly that, in a
// fraction of the time.
const MODULES = [
  '../db', '../models/User', '../models/RefreshToken', '../models/Story',
  '../models/Conversation', '../models/Message', '../models/Swipe',
  '../models/Match',
  '../services/authService', '../services/userService', '../services/storyService',
  '../services/visibilityService', '../services/chatService',
  '../services/matchService',
  '../controllers/authController', '../controllers/userController',
  '../controllers/storyController', '../controllers/chatController',
  '../controllers/socialAuthController',
  '../routes/auth', '../routes/users', '../routes/stories',
  '../routes/conversations', '../index',
];

async function startDb() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  MODULES.forEach((m) => { try { delete require.cache[require.resolve(m)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

async function stopDb() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

// Rebuilds only the route layer, so every test starts with empty rate-limit
// counters while keeping the one live connection.
function freshApp() {
  ['../routes/auth', '../index'].forEach((m) => {
    try { delete require.cache[require.resolve(m)]; } catch {}
  });
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

before(startDb);
after(stopDb);

const P = '/flamebackend/v1';

const validRegistration = (email) => ({
  email,
  password: 'Hunter2!!',
  name: email.split('@')[0].slice(0, 20).padEnd(2, 'x'),
  age: 25,
  gender: 'female',
  lookingFor: 'male',
  interests: ['x'],
});

// Not async: callers chain .expect(), which lives on the supertest request, not
// on a Promise wrapping it.
function register(app, email) {
  return request(app).post(`${P}/auth/register`).send(validRegistration(email));
}

// Every request in a test shares one source address, which is the point: these
// assert what an attacker hammering a single origin runs into.
test('repeated wrong passwords for one account stop being answered', async (t) => {
  const app = freshApp();
  await register(app, 'victim@x.com').expect(201);

  const attempt = () => request(app)
    .post(`${P}/auth/login`)
    .send({ email: 'victim@x.com', password: 'wrong-guess' });

  let sawLimit = false;
  for (let i = 0; i < 12; i++) {
    const res = await attempt();
    if (res.status === 429) { sawLimit = true; break; }
    assert.equal(res.status, 401, `attempt ${i} should be a plain auth failure`);
  }

  assert.ok(sawLimit, 'a dozen wrong passwords must not all be answered');
});

test('the limiter reports itself as a rate limit, not a generic failure', async (t) => {
  const app = freshApp();
  await register(app, 'shape@x.com').expect(201);

  let res;
  for (let i = 0; i < 12; i++) {
    res = await request(app).post(`${P}/auth/login`)
      .send({ email: 'shape@x.com', password: 'nope' });
    if (res.status === 429) break;
  }

  assert.equal(res.status, 429);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'RATE_LIMITED');
  // The client shows this string, so it has to say something true.
  assert.match(res.body.error.message, /too many/i);
});

test('a correct password is not spent by the limiter', async (t) => {
  const app = freshApp();
  await register(app, 'good@x.com').expect(201);

  // Far more successful logins than the failure budget allows. Brute force is
  // made of failures, so successes must not consume the allowance — otherwise a
  // shared device locks out the person using it correctly.
  for (let i = 0; i < 15; i++) {
    await request(app).post(`${P}/auth/login`)
      .send({ email: 'good@x.com', password: 'Hunter2!!' })
      .expect(200);
  }
});

test('guessing one account does not lock a different account out', async (t) => {
  const app = freshApp();
  await register(app, 'target@x.com').expect(201);
  await register(app, 'bystander@x.com').expect(201);

  // Burn the target's budget from this address.
  for (let i = 0; i < 12; i++) {
    const res = await request(app).post(`${P}/auth/login`)
      .send({ email: 'target@x.com', password: 'nope' });
    if (res.status === 429) break;
  }

  // Several users share one carrier NAT, so a per-address-only limiter would
  // make the app look broken for everyone on that network.
  await request(app).post(`${P}/auth/login`)
    .send({ email: 'bystander@x.com', password: 'Hunter2!!' })
    .expect(200);
});

test('account creation from one address is bounded', async (t) => {
  const app = freshApp();

  let sawLimit = false;
  for (let i = 0; i < 14; i++) {
    const res = await register(app, `spam${i}@x.com`);
    if (res.status === 429) { sawLimit = true; break; }
    assert.equal(res.status, 201, `registration ${i} should have succeeded`);
  }

  assert.ok(sawLimit, 'an address must not be able to mint unlimited accounts');
});

test('the email-availability oracle is bounded', async (t) => {
  const app = freshApp();

  // check-email answers "does this account exist", so left open it enumerates
  // the user base at whatever rate the network allows.
  let sawLimit = false;
  for (let i = 0; i < 26; i++) {
    const res = await request(app).post(`${P}/auth/check-email`)
      .send({ email: `probe${i}@x.com` });
    if (res.status === 429) { sawLimit = true; break; }
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }

  assert.ok(sawLimit, 'enumeration must not be free');
});

test('refresh is bounded but generous enough for real clients', async (t) => {
  const app = freshApp();

  // A 15-minute access token means a long-lived session refreshes often, so this
  // ceiling only exists to stop absurd volume.
  for (let i = 0; i < 30; i++) {
    const res = await request(app).post(`${P}/auth/refresh`)
      .send({ refreshToken: 'not-a-real-token' });
    assert.notEqual(res.status, 429, `a real client would hit this at ${i}`);
  }
});
