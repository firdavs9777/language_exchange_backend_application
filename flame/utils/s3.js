const AWS = require('aws-sdk');

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
  const result = await s3.upload(params).promise();
  return result.Location;
}

async function deleteObject(key) {
  await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
}

module.exports = { uploadBuffer, deleteObject, bucket: BUCKET };
