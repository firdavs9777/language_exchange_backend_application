const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

const BASE = '/flamebackend/v1';

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  ['../db', '../models/User', '../models/Swipe', '../models/Match',
   '../models/Conversation', '../models/RefreshToken', '../utils/jwt',
   '../services/chatService', '../services/swipeService', '../services/matchService',
   '../services/visibilityService', '../services/blockService',
   '../controllers/matchController', '../routes/matches', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });
  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');

  const swipeService = require('../services/swipeService');
  await swipeService.record(a._id.toString(), b._id.toString(), 'like');
  const res = await swipeService.record(b._id.toString(), a._id.toString(), 'like');

  const { signAccess } = require('../utils/jwt');
  const { buildApp } = require('./helpers/app');
  return {
    app: buildApp(),
    aToken: signAccess({ userId: a._id.toString() }).token,
    aId: a._id.toString(), bId: b._id.toString(),
    matchId: res.match.id,
    blockService: require('../services/blockService'),
    Match: require('../models/Match'),
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('GET /matches returns the other participant, not yourself', async (t) => {
  const { app, aToken, bId } = await setup();
  teardown(t);

  const res = await request(app).get(`${BASE}/matches`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);

  assert.equal(res.body.data.matches.length, 1);
  assert.equal(res.body.data.matches[0].user.id, bId);
  assert.equal(res.body.data.matches[0].user.name, 'Bb');
  assert.ok(res.body.data.matches[0].matched_at);
  assert.equal(res.body.data.pagination.total, 1);
});

test('DELETE /matches/:id ends the match and hides it', async (t) => {
  const { app, aToken, matchId, Match } = await setup();
  teardown(t);

  await request(app).delete(`${BASE}/matches/${matchId}`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);

  const res = await request(app).get(`${BASE}/matches`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);
  assert.equal(res.body.data.matches.length, 0);

  const row = await Match.findById(matchId);
  assert.ok(row, 'the row is kept, not deleted');
  assert.ok(row.endedBy, 'endedBy records who ended it');
});

test('you cannot unmatch a match you are not part of', async (t) => {
  const { app, matchId } = await setup();
  teardown(t);

  const User = require('../models/User');
  const stranger = await User.create({
    email: 's@x.com', name: 'Ss', age: 30, gender: 'other',
    lookingFor: 'other', passwordHash: 'x',
  });
  const { signAccess } = require('../utils/jwt');
  const token = signAccess({ userId: stranger._id.toString() }).token;

  await request(app).delete(`${BASE}/matches/${matchId}`)
    .set('Authorization', `Bearer ${token}`).expect(404);
});

test('blocking hides the match from the list', async (t) => {
  const { app, aToken, aId, bId, blockService } = await setup();
  teardown(t);

  await blockService.block(aId, bId);

  const res = await request(app).get(`${BASE}/matches`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);
  assert.equal(res.body.data.matches.length, 0);
});

// --- pagination bounds ------------------------------------------------------
//
// Unclamped, `?limit=100000` loads that many matches plus a $in of that many
// user ids, and `?offset=-1` reaches the driver and comes back as a 500. The
// clamp mirrors GET /discover's.

test('GET /matches clamps an oversized limit to 50', async (t) => {
  const { app, aToken } = await setup();
  teardown(t);

  const res = await request(app).get(`${BASE}/matches?limit=100000`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);

  assert.equal(res.body.data.pagination.limit, 50);
});

test('GET /matches rejects a negative offset by clamping it to 0, not 500ing', async (t) => {
  const { app, aToken, bId } = await setup();
  teardown(t);

  const res = await request(app).get(`${BASE}/matches?offset=-1`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);

  assert.equal(res.body.data.pagination.offset, 0);
  assert.equal(res.body.data.matches.length, 1);
  assert.equal(res.body.data.matches[0].user.id, bId);
});

test('GET /matches falls back to the defaults for junk and out-of-range values', async (t) => {
  const { app, aToken } = await setup();
  teardown(t);

  const junk = await request(app).get(`${BASE}/matches?limit=abc&offset=abc`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);
  assert.equal(junk.body.data.pagination.limit, 20);
  assert.equal(junk.body.data.pagination.offset, 0);

  const negative = await request(app).get(`${BASE}/matches?limit=-5`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);
  assert.equal(negative.body.data.pagination.limit, 1, 'a negative limit is floored, not passed on');
});

test('listed matches are never reported as new', async (t) => {
  const { app, aToken } = await setup();
  teardown(t);

  const res = await request(app).get(`${BASE}/matches`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);

  assert.equal(res.body.data.matches.length, 1);
  assert.equal(
    res.body.data.matches[0].is_new,
    false,
    'a listing must not re-fire the app match-celebration UI',
  );
});
