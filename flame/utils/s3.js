const AWS = require('aws-sdk');
const logger = require('./logger');

// Warn loudly at boot if Spaces isn't fully configured. Missing/blank env here
// is the usual cause of prod photo/story uploads failing with a generic
// INTERNAL — this makes the real cause visible in the logs.
for (const k of ['SPACES_ENDPOINT', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'FLAME_SPACES_BUCKET']) {
  if (!process.env[k]) logger.warn(`Spaces env ${k} is not set — uploads will fail`);
}

const endpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);

const s3 = new AWS.S3({
  endpoint,
  accessKeyId:     process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
});

const BUCKET = process.env.FLAME_SPACES_BUCKET;

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
  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (err) {
    // Surface the real S3 error (code + message) so a prod misconfig is
    // diagnosable — e.g. InvalidAccessKeyId, SignatureDoesNotMatch, NoSuchBucket,
    // or a bad endpoint. Never logs the secret.
    logger.error(
      `Spaces upload failed key=${key} bucket=${BUCKET} endpoint=${process.env.SPACES_ENDPOINT}: ${err.code || ''} ${err.message}`,
    );
    throw err;
  }
}

async function deleteObject(key) {
  try {
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
  } catch (err) {
    logger.error(`Spaces delete failed key=${key} bucket=${BUCKET}: ${err.code || ''} ${err.message}`);
    throw err;
  }
}

module.exports = { uploadBuffer, deleteObject, bucket: BUCKET };
