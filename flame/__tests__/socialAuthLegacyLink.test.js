const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

// Social login links a provider to an existing account matched by verified
// email. Mongoose validates the ENTIRE document on save(), so an account
// created before the dating fields became required — or any partially
// migrated record — blows up on link with:
//
//   User validation failed: lookingFor: Path `lookingFor` is required.
//
// Observed in production on POST /auth/google (500 INTERNAL). It is not
// Google-specific: Apple and Facebook take the same path.

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';

  ['../db', '../models/User', '../models/RefreshToken', '../services/authService',
   '../services/socialAuthService', '../utils/jwt']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });

  const { connect } = require('../db');
  await connect();
  return {
    User: require('../models/User'),
    socialAuthService: require('../services/socialAuthService'),
  };
}

test('links a legacy account that is missing required dating fields', async (t) => {
  const { User, socialAuthService } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  // Insert straight through the driver so schema validation is bypassed —
  // this is what a pre-migration document actually looks like on disk.
  await User.collection.insertOne({
    email: 'legacy@x.com',
    name: 'Legacy User',
    passwordHash: null,
    // age / gender / lookingFor deliberately absent
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const res = await socialAuthService.findOrCreate('google', {
    providerId: 'g-legacy-1',
    email: 'legacy@x.com',
    name: 'Legacy User',
    emailVerified: true,
    photo: null,
  });

  assert.equal(res.isNew, false, 'must link, not create a duplicate');
  assert.ok(res.tokens.accessToken, 'must mint tokens');

  const saved = await User.findOne({ email: 'legacy@x.com' });
  assert.equal(saved.googleId, 'g-legacy-1', 'provider id must be linked');
  assert.ok(saved.lookingFor, 'missing required field must be backfilled');
  assert.ok(saved.gender, 'missing required field must be backfilled');
  assert.ok(saved.age, 'missing required field must be backfilled');
});

test('linking never overwrites values the user already set', async (t) => {
  const { User, socialAuthService } = await setup();
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });

  await User.collection.insertOne({
    email: 'complete@x.com',
    name: 'Complete User',
    passwordHash: null,
    age: 31,
    gender: 'female',
    lookingFor: 'male',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await socialAuthService.findOrCreate('google', {
    providerId: 'g-complete-1',
    email: 'complete@x.com',
    name: 'Ignored Name',
    emailVerified: true,
    photo: null,
  });

  const saved = await User.findOne({ email: 'complete@x.com' });
  assert.equal(saved.age, 31, 'backfill must not clobber a real age');
  assert.equal(saved.gender, 'female');
  assert.equal(saved.lookingFor, 'male');
  assert.equal(saved.name, 'Complete User', 'provider name must not overwrite');
});
