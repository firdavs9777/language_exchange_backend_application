const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('connects to Flame DB and reports readyState=1', async (t) => {
  await dbHelper.start();
  // Set the rest of the required env so config/env loads cleanly
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 'test';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  const { connect, getConn } = require('../db');

  const conn = await connect();
  assert.equal(conn.readyState, 1);
  assert.equal(getConn(), conn);

  t.after(async () => {
    await conn.close();
    await dbHelper.stop();
  });
});
