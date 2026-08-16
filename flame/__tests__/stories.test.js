// Stub Flame's S3 util so tests don't hit DigitalOcean.
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  [
    '../db', '../models/User', '../models/RefreshToken', '../models/Story', '../models/Swipe',
    '../services/authService', '../services/userService', '../services/storyService',
    // storyService/userService now enforce blocks through visibilityService,
    // which binds User and Swipe at load — clear all three or they keep the
    // previous test's closed connection.
    '../services/visibilityService',
    '../controllers/authController', '../controllers/userController', '../controllers/storyController',
    '../routes/auth', '../routes/users', '../routes/stories', '../index',
  ].forEach((p) => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

async function teardown() {
  const { close } = require('../db');
  await close();
  await dbHelper.stop();
}

async function registerUser(app, email) {
  const body = {
    email, password: 'Hunter2!!', name: email.split('@')[0],
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

function createStory(app, token, { caption } = {}) {
  const req = request(app)
    .post('/flamebackend/v1/stories')
    .set('Authorization', `Bearer ${token}`)
    .attach('media', Buffer.from('fake-bytes'), { filename: 's.jpg', contentType: 'image/jpeg' });
  if (caption) req.field('caption', caption);
  return req;
}

test('POST /stories → 201 creates a 24h photo story', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'author@x.com');
  const res = await createStory(app, me.token, { caption: 'sunset' }).expect(201);

  const s = res.body.data;
  assert.equal(s.user_id, me.id);
  assert.equal(s.caption, 'sunset');
  assert.equal(s.view_count, 0);
  assert.equal(s.has_viewed, false);
  assert.match(s.media_url, /^https:\/\/stub\.example\.com\/flame\/stories\//,
    'Flame shares BananaTalk\'s Spaces bucket, so everything it writes must live\n     under the flame/ prefix — see flame/services/storyService.js');
  const ttl = new Date(s.expires_at) - new Date(s.created_at);
  assert.ok(Math.abs(ttl - 24 * 3600 * 1000) < 2000, 'expires ~24h after creation');
  t.after(teardown);
});

test('POST /stories → 422 on non-image type', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  await request(app)
    .post('/flamebackend/v1/stories')
    .set('Authorization', `Bearer ${me.token}`)
    .attach('media', Buffer.from('fake'), { filename: 's.gif', contentType: 'image/gif' })
    .expect(422);
  t.after(teardown);
});

test('POST /stories → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app)
    .post('/flamebackend/v1/stories')
    .attach('media', Buffer.from('x'), { filename: 's.jpg', contentType: 'image/jpeg' })
    .expect(401);
  t.after(teardown);
});

test('GET /stories/my → own stories, null when none', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');

  const empty = await request(app)
    .get('/flamebackend/v1/stories/my')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.equal(empty.body.data, null);

  await createStory(app, me.token).expect(201);
  const mine = await request(app)
    .get('/flamebackend/v1/stories/my')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.equal(mine.body.data.user_id, me.id);
  assert.equal(mine.body.data.stories.length, 1);
  t.after(teardown);
});

test('GET /stories/feed → sees other users, excludes self', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const other = await registerUser(app, 'other@x.com');
  await createStory(app, me.token).expect(201);
  await createStory(app, other.token).expect(201);

  const feed = await request(app)
    .get('/flamebackend/v1/stories/feed')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);

  const users = feed.body.data.users;
  const ids = users.map((u) => u.user_id);
  assert.ok(ids.includes(other.id), 'feed includes other user');
  assert.ok(!ids.includes(me.id), 'feed excludes the viewer');
  t.after(teardown);
});

test('POST /stories/:id/view → counts a view; author view not counted', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const other = await registerUser(app, 'other@x.com');
  const created = await createStory(app, me.token).expect(201);
  const storyId = created.body.data.id;

  // Author viewing own story does not increment.
  const selfView = await request(app)
    .post(`/flamebackend/v1/stories/${storyId}/view`)
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.equal(selfView.body.data.view_count, 0);

  // Another user viewing increments and flips has_viewed on their feed.
  const otherView = await request(app)
    .post(`/flamebackend/v1/stories/${storyId}/view`)
    .set('Authorization', `Bearer ${other.token}`)
    .expect(200);
  assert.equal(otherView.body.data.view_count, 1);

  const feed = await request(app)
    .get('/flamebackend/v1/stories/feed')
    .set('Authorization', `Bearer ${other.token}`)
    .expect(200);
  const authorGroup = feed.body.data.users.find((u) => u.user_id === me.id);
  assert.equal(authorGroup.stories[0].has_viewed, true);
  t.after(teardown);
});

test('DELETE /stories/:id → author deletes; non-author gets 403', async (t) => {
  const app = await setup();
  const me = await registerUser(app, 'me@x.com');
  const other = await registerUser(app, 'other@x.com');
  const created = await createStory(app, me.token).expect(201);
  const storyId = created.body.data.id;

  await request(app)
    .delete(`/flamebackend/v1/stories/${storyId}`)
    .set('Authorization', `Bearer ${other.token}`)
    .expect(403);

  await request(app)
    .delete(`/flamebackend/v1/stories/${storyId}`)
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);

  const mine = await request(app)
    .get('/flamebackend/v1/stories/my')
    .set('Authorization', `Bearer ${me.token}`)
    .expect(200);
  assert.equal(mine.body.data, null);
  t.after(teardown);
});
