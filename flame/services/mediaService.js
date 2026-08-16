const crypto = require('crypto');
const s3 = require('../utils/s3');
const { ValidationError } = require('../utils/errors');

// Per-kind limits rather than one global cap: an image is not a video, and a
// single 50MB ceiling would let someone upload a 50MB "avatar".
const LIMITS = {
  image: { types: new Set(['image/jpeg', 'image/png', 'image/webp']), maxBytes: 10 * 1024 * 1024 },
  video: { types: new Set(['video/mp4', 'video/quicktime']), maxBytes: 50 * 1024 * 1024 },
  audio: { types: new Set(['audio/mpeg', 'audio/mp4', 'audio/aac']), maxBytes: 20 * 1024 * 1024 },
  voice: { types: new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg']), maxBytes: 10 * 1024 * 1024 },
};

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg',
};

// Stores one message attachment and returns its public URL plus the S3 key.
//
// The key is returned alongside the URL so a later delete does not have to
// reverse-engineer the path out of the URL, which userService.deletePhoto is
// currently forced to do.
async function storeMessageMedia(conversationId, kind, file) {
  const limit = LIMITS[kind];
  if (!limit) throw new ValidationError(`unsupported media kind: ${kind}`);
  if (!file) throw new ValidationError(`${kind} file is required`);

  if (!limit.types.has(file.mimetype)) {
    throw new ValidationError(
      `${kind} must be one of: ${[...limit.types].join(', ')}`,
    );
  }
  if (file.size > limit.maxBytes) {
    throw new ValidationError(
      `${kind} must be under ${Math.floor(limit.maxBytes / (1024 * 1024))}MB`,
    );
  }

  const id = crypto.randomUUID();
  const ext = EXT[file.mimetype] || 'bin';
  const key = `conversations/${conversationId}/${kind}/${id}.${ext}`;
  const url = await s3.uploadBuffer(file.buffer, key, file.mimetype);

  return { url, key };
}

module.exports = { storeMessageMedia, LIMITS };
