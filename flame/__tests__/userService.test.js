const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setupAndRegister() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken',
   '../services/authService', '../services/userService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const authService = require('../services/authService');
  const { user } = await authService.register({
    email: 'ada@x.com', password: 'Hunter2!!', name: 'Ada',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
  });
  return user.id;
}

test('getMe returns the full profile', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const me = await userService.getMe(id);
  assert.equal(me.email, 'ada@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('getById returns public profile (no email, no passwordHash)', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const other = await userService.getById(id);
  assert.equal(other.name, 'Ada');
  assert.equal(other.email, undefined);
  assert.equal(other.passwordHash, undefined);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('updateMe patches mutable fields, ignores immutable', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const updated = await userService.updateMe(id, { name: 'Ada L.', bio: 'hi', email: 'nope@x.com', passwordHash: 'pwn' });
  assert.equal(updated.name, 'Ada L.');
  assert.equal(updated.bio, 'hi');
  assert.equal(updated.email, 'ada@x.com'); // unchanged
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('getMe → NotFoundError for unknown id', async (t) => {
  await setupAndRegister();
  const userService = require('../services/userService');
  const { NotFoundError } = require('../utils/errors');
  await assert.rejects(userService.getMe('507f1f77bcf86cd799439011'), (e) => e instanceof NotFoundError);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
