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
   // matchService is listed because chatService consults it (an ended match
   // closes the conversation) — an uncleared copy keeps a Match model bound to
   // the previous test's closed connection.
   '../services/chatService', '../services/swipeService', '../services/matchService',
   '../services/visibilityService', '../services/blockService',
   '../controllers/swipeController', '../routes/swipes', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const mk = (email, name) => User.create({
    email, name, age: 30, gender: 'other', lookingFor: 'other', passwordHash: 'x',
  });
  const a = await mk('a@x.com', 'Aa');
  const b = await mk('b@x.com', 'Bb');

  const { signAccess } = require('../utils/jwt');
  const { buildApp } = require('./helpers/app');
  return {
    app: buildApp(),
    aToken: signAccess({ userId: a._id.toString() }).token,
    bToken: signAccess({ userId: b._id.toString() }).token,
    aId: a._id.toString(), bId: b._id.toString(),
    User,
  };
}

const teardown = (t) => t.after(async () => {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
});

test('POST /swipes/like keeps its response shape and reports no match', async (t) => {
  const { app, aToken, bId } = await setup();
  teardown(t);

  const res = await request(app).post(`${BASE}/swipes/like`)
    .set('Authorization', `Bearer ${aToken}`)
    .send({ user_id: bId }).expect(200);

  assert.equal(res.body.data.liked, true);
  assert.equal(res.body.data.is_match, false);
  assert.equal(res.body.data.match, null);
});

test('a reciprocal like returns is_match with the match payload', async (t) => {
  const { app, aToken, bToken, aId, bId } = await setup();
  teardown(t);

  await request(app).post(`${BASE}/swipes/like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId }).expect(200);

  const res = await request(app).post(`${BASE}/swipes/like`)
    .set('Authorization', `Bearer ${bToken}`).send({ user_id: aId }).expect(200);

  assert.equal(res.body.data.is_match, true);
  assert.equal(res.body.data.match.user.id, aId);
  assert.ok(res.body.data.match.matched_at);
});

test('super-like decrements the quota and reports the remainder', async (t) => {
  const { app, aToken, aId, bId, User } = await setup();
  teardown(t);

  const res = await request(app).post(`${BASE}/swipes/super-like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId }).expect(200);

  assert.equal(res.body.data.super_liked, true);
  assert.equal(res.body.data.remaining_super_likes, 2);

  const me = await User.findById(aId);
  assert.equal(me.superLikesRemaining, 2);
});

test('super-like is refused once the quota is spent', async (t) => {
  const { app, aToken, aId, bId, User } = await setup();
  teardown(t);

  const today = new Date().toISOString().slice(0, 10);
  await User.updateOne({ _id: aId }, { $set: { superLikesRemaining: 0, superLikesDay: today } });

  const res = await request(app).post(`${BASE}/swipes/super-like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId }).expect(422);

  assert.equal(res.body.error.code, 'VALIDATION');
});

test('the quota resets on a new day', async (t) => {
  const { app, aToken, aId, bId, User } = await setup();
  teardown(t);

  await User.updateOne({ _id: aId }, { $set: { superLikesRemaining: 0, superLikesDay: '2000-01-01' } });

  const res = await request(app).post(`${BASE}/swipes/super-like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId }).expect(200);

  assert.equal(res.body.data.remaining_super_likes, 2);
});

test('POST /swipes/undo still answers without 404-ing', async (t) => {
  const { app, aToken } = await setup();
  teardown(t);

  const res = await request(app).post(`${BASE}/swipes/undo`)
    .set('Authorization', `Bearer ${aToken}`).expect(200);
  assert.equal(res.body.data.undone, false);
});

test('a super-like refused by a block does not cost a quota unit', async (t) => {
  const { app, aToken, aId, bId, User } = await setup();
  teardown(t);

  const blockService = require('../services/blockService');
  await blockService.block(bId, aId); // b blocked a

  await request(app).post(`${BASE}/swipes/super-like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId }).expect(403);

  const me = await User.findById(aId);
  assert.equal(me.superLikesRemaining, 3, 'a rejected super-like must be refunded');
});

test('super-liking the same person twice only costs one', async (t) => {
  const { app, aToken, aId, bId, User } = await setup();
  teardown(t);

  const send = () => request(app).post(`${BASE}/swipes/super-like`)
    .set('Authorization', `Bearer ${aToken}`).send({ user_id: bId });

  await send().expect(200);
  const second = await send().expect(200);

  assert.equal(second.body.data.remaining_super_likes, 2);
  const me = await User.findById(aId);
  assert.equal(me.superLikesRemaining, 2, 'a repeat super-like on the same target is free');
});
