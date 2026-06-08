const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('RefreshToken: unique jti + TTL index on expiresAt', async (t) => {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  delete require.cache[require.resolve('../models/RefreshToken')];
  const { connect, close } = require('../db');
  await connect();
  const RefreshToken = require('../models/RefreshToken');
  // Ensure all declared indexes (unique tokenJti, TTL on expiresAt) exist before assertions
  await RefreshToken.init();

  await RefreshToken.create({
    userId: 'u1', tokenJti: 'j1', expiresAt: new Date(Date.now() + 86400000),
  });
  await assert.rejects(
    RefreshToken.create({ userId: 'u2', tokenJti: 'j1', expiresAt: new Date(Date.now() + 1000) }),
    /duplicate/i
  );

  const idx = await RefreshToken.collection.indexes();
  const ttl = idx.find(i => i.key && i.key.expiresAt === 1);
  assert.ok(ttl, 'expected index on expiresAt');
  assert.equal(ttl.expireAfterSeconds, 0, 'expected TTL index expireAfterSeconds=0');

  t.after(async () => { await close(); await dbHelper.stop(); });
});
