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

  ['../db', '../models/User', '../models/Report', '../models/RefreshToken',
   '../services/authService', '../utils/jwt', '../controllers/reportController',
   '../routes/reports', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();

  const User = require('../models/User');
  const reporter = await User.create({
    email: 'r@x.com', name: 'Reporter', age: 30, gender: 'female',
    lookingFor: 'male', passwordHash: 'x',
  });
  const target = await User.create({
    email: 't@x.com', name: 'Target', age: 30, gender: 'male',
    lookingFor: 'female', passwordHash: 'x',
  });

  const { signAccess } = require('../utils/jwt');
  const token = signAccess({ userId: reporter._id.toString() }).token;

  const { buildApp } = require('./helpers/app');
  return { app: buildApp(), token, reporterId: reporter._id.toString(), targetId: target._id.toString() };
}

test('POST /reports stores a report', async (t) => {
  const { app, token, reporterId, targetId } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  const res = await request(app)
    .post(`${BASE}/reports`)
    .set('Authorization', `Bearer ${token}`)
    .send({ user_id: targetId, reason: 'harassment', details: 'was rude' })
    .expect(201);

  assert.equal(res.body.success, true);

  const Report = require('../models/Report');
  const saved = await Report.findOne({ reportedUser: targetId });
  assert.equal(saved.reportedBy, reporterId);
  assert.equal(saved.reason, 'harassment');
  assert.equal(saved.description, 'was rude');
  assert.equal(saved.status, 'pending');
});

test('POST /reports rejects an unknown reason', async (t) => {
  const { app, token, targetId } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  const res = await request(app)
    .post(`${BASE}/reports`)
    .set('Authorization', `Bearer ${token}`)
    .send({ user_id: targetId, reason: 'i_just_dont_like_them' })
    .expect(422);

  assert.equal(res.body.error.code, 'VALIDATION');
});

test('POST /reports rejects reporting yourself', async (t) => {
  const { app, token, reporterId } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  const res = await request(app)
    .post(`${BASE}/reports`)
    .set('Authorization', `Bearer ${token}`)
    .send({ user_id: reporterId, reason: 'spam' })
    .expect(422);

  assert.equal(res.body.error.code, 'VALIDATION');
});
