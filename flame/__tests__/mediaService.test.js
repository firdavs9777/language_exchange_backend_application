const test = require('node:test');
const assert = require('node:assert/strict');

// The s3 module throws at load without these, and reads them at import time.
process.env.FLAME_SPACES_BUCKET = 'test-bucket';
process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
process.env.DO_SPACES_KEY = 'k';
process.env.DO_SPACES_SECRET = 's';

const S3 = require.resolve('../utils/s3');
const SVC = require.resolve('../services/mediaService');

function loadWithStubbedS3(onUpload) {
  const real = require.cache[S3];
  require.cache[S3] = {
    id: S3, filename: S3, loaded: true,
    exports: {
      uploadBuffer: async (buffer, key, contentType) => {
        onUpload({ buffer, key, contentType });
        return `https://cdn.example.com/${key}`;
      },
      deleteObject: async () => {},
      bucket: 'test-bucket',
    },
  };
  delete require.cache[SVC];
  const svc = require(SVC);
  return {
    svc,
    restore() {
      if (real) require.cache[S3] = real; else delete require.cache[S3];
      delete require.cache[SVC];
    },
  };
}

const file = (mimetype, size = 1024) => ({
  mimetype, size, buffer: Buffer.alloc(size), originalname: 'x',
});

test('stores an image and returns both the url and the key', async () => {
  let seen;
  const { svc, restore } = loadWithStubbedS3((u) => { seen = u; });
  try {
    const out = await svc.storeMessageMedia('c1', 'image', file('image/jpeg'));
    assert.ok(out.url.startsWith('https://'));
    assert.ok(out.key.includes('c1'), 'the key should be scoped to the conversation');
    // Flame shares BananaTalk's Spaces bucket (my-projects-media), so
    // everything it writes lives under one prefix. Without it, Flame's objects
    // would sit beside BananaTalk's at the bucket root with nothing marking
    // which app owns them.
    assert.ok(
      out.key.startsWith('flame/conversations/'),
      `expected a flame/ prefixed key, got: ${out.key}`,
    );
    assert.equal(seen.contentType, 'image/jpeg');
  } finally { restore(); }
});

test('rejects a MIME type the kind does not allow', async () => {
  const { svc, restore } = loadWithStubbedS3(() => {});
  try {
    await assert.rejects(
      () => svc.storeMessageMedia('c1', 'image', file('application/zip')),
      (e) => e.status === 422,
    );
  } finally { restore(); }
});

test('rejects a file over the kind limit', async () => {
  const { svc, restore } = loadWithStubbedS3(() => {});
  try {
    const tooBig = file('image/jpeg', svc.LIMITS.image.maxBytes + 1);
    await assert.rejects(
      () => svc.storeMessageMedia('c1', 'image', tooBig),
      (e) => e.status === 422,
    );
  } finally { restore(); }
});

test('video is allowed to be larger than an image', async () => {
  const { svc, restore } = loadWithStubbedS3(() => {});
  try {
    assert.ok(svc.LIMITS.video.maxBytes > svc.LIMITS.image.maxBytes);
  } finally { restore(); }
});

test('a missing file is a validation error, not a crash', async () => {
  const { svc, restore } = loadWithStubbedS3(() => {});
  try {
    await assert.rejects(
      () => svc.storeMessageMedia('c1', 'image', null),
      (e) => e.status === 422,
    );
  } finally { restore(); }
});
