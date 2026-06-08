const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('User model: create + unique email + geosphere index present', async (t) => {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  delete require.cache[require.resolve('../models/User')];
  const { connect, close } = require('../db');
  await connect();
  const User = require('../models/User');

  const u = await User.create({
    email: 'a@b.com', passwordHash: 'x',
    name: 'Ada', age: 30, gender: 'female', lookingFor: 'male',
    interests: ['hiking'],
  });
  assert.ok(u._id);
  assert.equal(u.email, 'a@b.com');

  // unique email
  await assert.rejects(
    User.create({ email: 'a@b.com', passwordHash: 'y', name: 'Xy', age: 22, gender: 'male', lookingFor: 'female', interests: ['x'] }),
    /duplicate/i
  );

  // geosphere index (await init so all declared indexes are built before we query)
  await User.init();
  const indexes = await User.collection.indexes();
  const hasGeo = indexes.some(i => i.key && i.key.locationGeo === '2dsphere');
  assert.ok(hasGeo, 'expected 2dsphere index on locationGeo');

  t.after(async () => { await close(); await dbHelper.stop(); });
});
