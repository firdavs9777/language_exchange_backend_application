const AWS = require('aws-sdk');
const logger = require('./logger');

// Default to the same region BananaTalk's own config/spaces.js defaults to.
// Without it, an unset SPACES_ENDPOINT built `new AWS.Endpoint(undefined)` here
// while BananaTalk carried on working off its default — which is why Flame
// uploads could fail with NoSuchBucket on a box where BananaTalk's succeeded.
const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(SPACES_ENDPOINT),
  accessKeyId:     process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  // Do NOT set region for DigitalOcean Spaces with AWS SDK v2 — same note as
  // config/spaces.js.
});

const BUCKET = process.env.FLAME_SPACES_BUCKET;

// Say out loud, once at boot, what this module will actually talk to.
//
// A wrong or missing bucket used to surface only when a user tried to send a
// photo, as a 500 with NoSuchBucket buried in a stack trace — and it stayed
// invisible for as long as nobody exercised an upload path. Flame has three of
// them (profile photos, stories, chat media) and all three were broken this way
// for weeks. One line at startup makes the misconfiguration obvious before a
// user finds it.
if (!BUCKET) {
  logger.error(
    'FLAME_SPACES_BUCKET is not set — every upload (profile photos, stories, '
    + 'chat media) will fail. Set it in config/config.env and restart.',
  );
} else {
  logger.info(`Spaces: bucket=${BUCKET} endpoint=${SPACES_ENDPOINT}`);
}

/**
 * Upload a buffer to Flame's Spaces bucket.
 * @param {Buffer} buffer
 * @param {string} key — object key (path inside the bucket)
 * @param {string} contentType
 * @returns {Promise<string>} public URL
 */
async function uploadBuffer(buffer, key, contentType) {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  };
  const result = await s3.upload(params).promise();
  return result.Location;
}

async function deleteObject(key) {
  await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
}

module.exports = { uploadBuffer, deleteObject, bucket: BUCKET };
