// Stub Flame's S3 util so tests don't hit DigitalOcean, and so the returned
// URL is deterministic enough to assert against (contains the conversation id).
process.env.FLAME_SPACES_BUCKET = 't';
process.env.SPACES_ENDPOINT = 'e';
process.env.DO_SPACES_KEY = 'k';
process.env.DO_SPACES_SECRET = 's';

const S3_PATH = require.resolve('../utils/s3');
require.cache[S3_PATH] = {
  id: S3_PATH, filename: S3_PATH, loaded: true,
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
  [
    '../db', '../models/User', '../models/RefreshToken', '../models/Story',
    '../models/Conversation', '../models/Message', '../models/Swipe',
    '../models/Match',
    // chatService/userService/storyService enforce blocks through
    // visibilityService, which binds User and Swipe at load — clear all three
    // or they keep the previous test's closed connection. chatService also
    // consults matchService (ended matches close the conversation) and this
    // suite exercises both a block and an ended match directly, so
    // blockService/swipeService/matchService/Match all go in the list too.
    '../services/visibilityService', '../services/chatService',
    '../services/matchService', '../services/swipeService', '../services/blockService',
    '../services/mediaService',
    '../services/authService', '../services/userService', '../services/storyService',
    '../controllers/authController', '../controllers/userController', '../controllers/storyController',
    '../controllers/chatController', '../controllers/blockController',
    '../routes/auth', '../routes/users', '../routes/stories', '../routes/conversations',
    '../routes/blocks', '../index',
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
    // padEnd guards against short local-parts (e.g. 'a@x.com' -> 'a'), which would
    // otherwise fail the auth route's `name: z.string().min(2)` validation.
    email, password: 'Hunter2!!', name: email.split('@')[0].padEnd(2, 'x'),
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  };
  const r = await request(app).post('/flamebackend/v1/auth/register').send(body).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

const authH = (token) => ({ Authorization: `Bearer ${token}` });

async function openConv(app, from, toId) {
  const r = await request(app).post('/flamebackend/v1/conversations')
    .set(authH(from.token)).send({ user_id: toId }).expect(201);
  return r.body.data.id;
}

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
const audioBytes = () => Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);

test('1: POST .../messages/image with a jpeg stores an image message', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(201);

  assert.equal(res.body.data.message_type, 'image');
  assert.ok(res.body.data.image_url, 'image_url must be set');
  assert.ok(res.body.data.image_url.includes(convId), 'the stored key should be scoped to the conversation');
  assert.equal(res.body.data.video_url, null);
  assert.equal(res.body.data.audio_url, null);
  assert.equal(res.body.data.sender_id, a.id);
  assert.equal(res.body.data.receiver_id, b.id);

  // Confirm it is really persisted, not just echoed back.
  const thread = await request(app)
    .get(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(b.token))
    .expect(200);
  assert.equal(thread.body.data.messages.length, 1);
  assert.equal(thread.body.data.messages[0].message_type, 'image');
  assert.equal(thread.body.data.messages[0].image_url, res.body.data.image_url);

  // The conversation list must reflect the media send like any other message.
  const listB = await request(app).get('/flamebackend/v1/conversations')
    .set(authH(b.token)).expect(200);
  assert.equal(listB.body.data.conversations[0].unread_count, 1);
  assert.equal(listB.body.data.conversations[0].last_message.message_type, 'image');
});

test('2: a blocked pair is rejected on the media path with 403', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const blockService = require('../services/blockService');
  await blockService.block(a.id, b.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(403);

  // No message should have been created.
  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convId });
  assert.equal(count, 0, 'a rejected send must not persist a message');
});

test('3: an ended match is rejected on the media path with 403', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const swipeService = require('../services/swipeService');
  const matchService = require('../services/matchService');
  await swipeService.record(a.id, b.id, 'like');
  const swipe = await swipeService.record(b.id, a.id, 'like');
  assert.ok(swipe.match, 'mutual likes must produce a match');
  await matchService.unmatch(a.id, swipe.match.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(b.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(403);

  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convId });
  assert.equal(count, 0, 'a rejected send must not persist a message');
});

// NOTE: this expectation changed from 404 to 403 after the coordinator's
// review of this task. sendMediaMessage originally hand-rolled its own
// non-participant check that threw NotFoundError, diverging from sendMessage's
// shared _assertParticipant (FlameError 403 'not your conversation'). Both
// send paths now call the same _assertCanSendInto helper, so a non-participant
// gets the same 403 on the media path as on the text path.
test('4: a non-participant gets 403 on the media path', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const convId = await openConv(app, a, b.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(c.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(403);
});

test('reply_to on the media path is rejected if it points at another conversation (422)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const c = await registerUser(app, 'c@x.com');
  const convAB = await openConv(app, a, b.id);
  const convAC = await openConv(app, a, c.id);

  const msgInAC = await request(app)
    .post(`/flamebackend/v1/conversations/${convAC}/messages`)
    .set(authH(a.token))
    .send({ text: 'in AC' })
    .expect(201);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convAB}/messages/image`)
    .set(authH(a.token))
    .field('reply_to_id', msgInAC.body.data.id)
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(422);

  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convAB });
  assert.equal(count, 0, 'a rejected reply_to must not persist a media message');
});

test('5: a wrong-MIME upload is rejected with 422 and stores nothing', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', Buffer.from('PK\x03\x04not-really-a-zip'), { filename: 'file.zip', contentType: 'application/zip' })
    .expect(422);

  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convId });
  assert.equal(count, 0, 'a rejected upload must not persist a message');
});

test('5b: a file over the per-kind mediaService limit (but under the multer ceiling) is rejected with 422', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  // Pins the two limits apart: this must be caught by mediaService's per-kind
  // cap (image: 10MB), not by multer's 50MB backstop, so it stays true even if
  // the two ceilings are ever changed independently.
  const mediaService = require('../services/mediaService');
  const oversizeForImage = Buffer.alloc(mediaService.LIMITS.image.maxBytes + 1024);
  assert.ok(oversizeForImage.length < 50 * 1024 * 1024, 'must stay under the multer ceiling to isolate mediaService\'s own limit');

  await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', oversizeForImage, { filename: 'big.jpg', contentType: 'image/jpeg' })
    .expect(422);

  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convId });
  assert.equal(count, 0, 'a rejected upload must not persist a message');
});

// This is the case the router's own comment claimed was already handled and
// wasn't: a MulterError is not a FlameError, so without handleUpload wrapping
// the upload middleware, this fell through to the generic error handler as a
// 500 instead of the 422 promised by the comment. A real buffer over the
// production ceiling is used (rather than shrinking the fileSize limit for the
// test) so the assertion exercises the actual multer LIMIT_FILE_SIZE path, not
// a stand-in for it. The ceiling used to be a shared 50MB and needed a 51MB
// buffer; it is now per-kind (image: its own 10MB cap plus 1MB of headroom),
// so 12MB clears it and the test costs a quarter of the memory it did.
test('5c: a file over the route\'s multer ceiling is rejected with 422, not a 500', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const overMulterCeiling = Buffer.alloc(12 * 1024 * 1024);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', overMulterCeiling, { filename: 'huge.jpg', contentType: 'image/jpeg' })
    .expect(422);
  assert.equal(res.body.success, false);

  const Message = require('../models/Message');
  const count = await Message.countDocuments({ conversationId: convId });
  assert.equal(count, 0, 'a rejected upload must not persist a message');
});

// Every route used to share ONE multer instance ceilinged at 50MB, and multer
// buffers the whole body into process memory before the controller — and
// therefore before any participant/block check — runs. So a voice note could
// hold 50MB of RAM per concurrent request no matter that its own cap is 10MB.
// Each route now has a ceiling just above its own kind's cap, which is exactly
// what this asserts: at 12MB the voice route stops reading, and the answer is
// multer's blunter message rather than mediaService's kind-specific one. That
// trade is deliberate — refusing after ~11MB beats a nicer sentence produced
// after buffering 50MB.
test('5d: the voice route stops reading a 12MB upload at its own ceiling, not at 50MB', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const mediaService = require('../services/mediaService');
  assert.equal(mediaService.LIMITS.voice.maxBytes, 10 * 1024 * 1024);
  const twelveMB = Buffer.alloc(12 * 1024 * 1024);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/voice`)
    .set(authH(a.token))
    .attach('voice', twelveMB, { filename: 'note.m4a', contentType: 'audio/mp4' })
    .expect(422);
  assert.match(
    res.body.error.message,
    /file is too large/,
    'this must be multer refusing at the voice route\'s own ceiling; the '
    + 'kind-specific message would mean the whole 12MB was buffered first',
  );

  const Message = require('../models/Message');
  assert.equal(await Message.countDocuments({ conversationId: convId }), 0);
});

// The mirror image of 5d: video's cap and the old shared multer ceiling were
// both exactly 50MB, so the per-kind cap could never fire and an oversized
// video only ever got the generic message. With the ceiling above the cap,
// mediaService answers first and names the real limit.
test('5e: an oversized video gets mediaService\'s message, not multer\'s', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const mediaService = require('../services/mediaService');
  const overVideoCap = Buffer.alloc(mediaService.LIMITS.video.maxBytes + 1024);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/video`)
    .set(authH(a.token))
    .attach('video', overVideoCap, { filename: 'clip.mp4', contentType: 'video/mp4' })
    .expect(422);
  assert.match(res.body.error.message, /video must be under 50MB/);

  const Message = require('../models/Message');
  assert.equal(await Message.countDocuments({ conversationId: convId }), 0);
});

// /flamebackend/v1 is invisible to the root server's generalLimiter (scoped to
// /api/v1/), so before this the upload routes had no rate limit at all: a
// handful of concurrent POSTs from one account could hold arbitrary memory.
test('5f: media uploads are rate limited per user', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const post = () => request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/image`)
    .set(authH(a.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' });

  const statuses = [];
  for (let i = 0; i < 21; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    statuses.push((await post()).status);
  }

  assert.equal(statuses.filter((s) => s === 201).length, 20, 'the limit is 20 uploads per minute');
  assert.equal(statuses[20], 429, 'the 21st upload in the window must be refused');

  // The other participant is unaffected — the limiter keys on the user, not the IP.
  const convForB = await openConv(app, b, a.id);
  await request(app)
    .post(`/flamebackend/v1/conversations/${convForB}/messages/image`)
    .set(authH(b.token))
    .attach('image', jpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    .expect(201);
});

test('6: POST .../messages/voice with duration=12 sets messageType voice and media_info.duration', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/voice`)
    .set(authH(a.token))
    .field('duration', '12')
    .attach('voice', audioBytes(), { filename: 'note.m4a', contentType: 'audio/mp4' })
    .expect(201);

  assert.equal(res.body.data.message_type, 'voice');
  assert.ok(res.body.data.audio_url, 'audio_url must be set for a voice message');
  assert.equal(res.body.data.media_info.duration, 12);
});

test('7: a voice note sent without duration still succeeds, with a null duration', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/voice`)
    .set(authH(a.token))
    .attach('voice', audioBytes(), { filename: 'note.m4a', contentType: 'audio/mp4' })
    .expect(201);

  assert.equal(res.body.data.message_type, 'voice');
  assert.ok(res.body.data.audio_url);
  assert.equal(res.body.data.media_info.duration, null);
});

test('8: a garbage duration stores null rather than failing with a CastError', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const res = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/voice`)
    .set(authH(a.token))
    .field('duration', 'abc')
    .attach('voice', audioBytes(), { filename: 'note.m4a', contentType: 'audio/mp4' })
    .expect(201);

  assert.equal(res.body.data.message_type, 'voice');
  assert.equal(res.body.data.media_info.duration, null);
});

test('9: video and audio routes also work, and carry the reply_to/width/height fields', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const b = await registerUser(app, 'b@x.com');
  const convId = await openConv(app, a, b.id);

  const first = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages`)
    .set(authH(a.token))
    .send({ text: 'original' })
    .expect(201);

  const video = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/video`)
    .set(authH(a.token))
    .field('duration', '30')
    .field('width', '1920')
    .field('height', '1080')
    .field('reply_to_id', first.body.data.id)
    .attach('video', Buffer.from([0x00, 0x00, 0x00, 0x18]), { filename: 'clip.mp4', contentType: 'video/mp4' })
    .expect(201);
  assert.equal(video.body.data.message_type, 'video');
  assert.ok(video.body.data.video_url);
  assert.equal(video.body.data.media_info.duration, 30);
  assert.equal(video.body.data.media_info.width, 1920);
  assert.equal(video.body.data.media_info.height, 1080);
  assert.equal(video.body.data.reply_to, first.body.data.id);

  const audio = await request(app)
    .post(`/flamebackend/v1/conversations/${convId}/messages/audio`)
    .set(authH(a.token))
    .attach('audio', audioBytes(), { filename: 'clip.m4a', contentType: 'audio/mp4' })
    .expect(201);
  assert.equal(audio.body.data.message_type, 'audio');
  assert.ok(audio.body.data.audio_url);
});

test('every media route validates the :id param shape (422, not a crash)', async (t) => {
  const app = await setup();
  t.after(teardown);
  const a = await registerUser(app, 'a@x.com');
  const kinds = ['image', 'video', 'audio', 'voice'];
  for (const kind of kinds) {
    // eslint-disable-next-line no-await-in-loop
    await request(app)
      .post(`/flamebackend/v1/conversations/not-a-valid-id/messages/${kind}`)
      .set(authH(a.token))
      .attach(kind, audioBytes(), { filename: 'x', contentType: 'application/octet-stream' })
      .expect(422);
  }
});
