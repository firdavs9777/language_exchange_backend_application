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

  // '../models/Match' is listed because blockService now ends any live match:
  // an uncleared model keeps a handle on the previous test's closed connection.
  ['../db', '../models/User', '../models/RefreshToken', '../models/Match', '../utils/jwt',
   '../services/blockService', '../controllers/blockController',
   '../routes/blocks', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const me = await User.create({
    email: 'me@x.com', name: 'Me', age: 30, gender: 'female',
    lookingFor: 'male', passwordHash: 'x',
  });
  const them = await User.create({
    email: 'them@x.com', name: 'Them', age: 30, gender: 'male',
    lookingFor: 'female', passwordHash: 'x',
  });

  const { signAccess } = require('../utils/jwt');
  const token = signAccess({ userId: me._id.toString() }).token;

  const { buildApp } = require('./helpers/app');
  return {
    app: buildApp(), token,
    meId: me._id.toString(), themId: them._id.toString(),
    User,
  };
}

test('POST /blocks records the block on BOTH sides', async (t) => {
  const { app, token, meId, themId, User } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  await request(app).post(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`)
    .send({ user_id: themId })
    .expect(201);

  const me = await User.findById(meId);
  const them = await User.findById(themId);

  assert.equal(me.blockedUsers.length, 1);
  assert.equal(me.blockedUsers[0].user, themId);
  assert.equal(them.blockedBy.length, 1, 'the target must record who blocked them');
  assert.equal(them.blockedBy[0].user, meId);
});

test('blocking twice is idempotent', async (t) => {
  const { app, token, meId, themId, User } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  const send = () => request(app).post(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`).send({ user_id: themId });

  await send();
  await send();

  const me = await User.findById(meId);
  assert.equal(me.blockedUsers.length, 1);
});

test('GET /blocks lists blocked users in the app\'s shape', async (t) => {
  const { app, token, themId } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  await request(app).post(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`).send({ user_id: themId }).expect(201);

  const res = await request(app).get(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`).expect(200);

  const list = res.body.data.blocked_users;
  assert.equal(list.length, 1);
  assert.equal(list[0].id, themId);
  assert.equal(list[0].name, 'Them');
  assert.ok('blocked_at' in list[0]);
});

test('DELETE /blocks/:userId clears both sides', async (t) => {
  const { app, token, meId, themId, User } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  await request(app).post(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`).send({ user_id: themId }).expect(201);

  await request(app).delete(`${BASE}/blocks/${themId}`)
    .set('Authorization', `Bearer ${token}`).expect(200);

  const me = await User.findById(meId);
  const them = await User.findById(themId);
  assert.equal(me.blockedUsers.length, 0);
  assert.equal(them.blockedBy.length, 0);
});

test('cannot block yourself', async (t) => {
  const { app, token, meId } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  const res = await request(app).post(`${BASE}/blocks`)
    .set('Authorization', `Bearer ${token}`).send({ user_id: meId }).expect(422);
  assert.equal(res.body.error.code, 'VALIDATION');
});
