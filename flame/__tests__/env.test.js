const test = require('node:test');
const assert = require('node:assert/strict');

test('env validation throws on missing FLAME_MONGO_URI', () => {
  const saved = { ...process.env };
  delete process.env.FLAME_MONGO_URI;
  delete require.cache[require.resolve('../config/env')];
  assert.throws(() => require('../config/env'), /FLAME_MONGO_URI/);
  process.env = saved;
  delete require.cache[require.resolve('../config/env')];
});

test('env loads with all required vars set', () => {
  const saved = { ...process.env };
  process.env.FLAME_MONGO_URI = 'mongodb://localhost:27017/flame-test';
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 'flame-test-bucket';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'key';
  process.env.DO_SPACES_SECRET = 'secret';
  process.env.FLAME_ALLOWED_ORIGINS = 'https://flame.example.com';

  delete require.cache[require.resolve('../config/env')];
  const env = require('../config/env');
  assert.equal(env.FLAME_MONGO_URI, 'mongodb://localhost:27017/flame-test');
  assert.equal(env.FLAME_SPACES_BUCKET, 'flame-test-bucket');

  process.env = saved;
  delete require.cache[require.resolve('../config/env')];
});
