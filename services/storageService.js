/**
 * Storage Service
 * Handles file uploads to DigitalOcean Spaces (S3-compatible)
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');

// Initialize S3 client for DigitalOcean Spaces
let s3Client = null;

const getS3Client = () => {
  if (!s3Client) {
    const endpoint = process.env.DO_SPACES_ENDPOINT;

    if (!endpoint) {
      console.warn('DigitalOcean Spaces not configured, using mock storage');
      return null;
    }

    const spacesEndpoint = new AWS.Endpoint(endpoint);
    s3Client = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      s3ForcePathStyle: false,
      signatureVersion: 'v4'
    });
  }
  return s3Client;
};

const BUCKET_NAME = process.env.DO_SPACES_BUCKET || 'bananatalk';
const CDN_ENDPOINT = process.env.DO_SPACES_CDN_ENDPOINT;

/**
 * Upload file to DigitalOcean Spaces
 * @param {Buffer} buffer - File buffer
 * @param {String} filename - Desired filename
 * @param {String} contentType - MIME type
 * @param {String} folder - Optional folder path
 * @returns {Promise<String>} Public URL of uploaded file
 */
const uploadToSpaces = async (buffer, filename, contentType, folder = 'audio') => {
  const client = getS3Client();

  // If storage not configured, return mock URL
  if (!client) {
    const mockUrl = `https://mock-storage.local/${folder}/${filename}`;
    console.log(`[Mock Storage] Would upload to: ${mockUrl}`);
    return mockUrl;
  }

  const key = folder ? `${folder}/${filename}` : filename;

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
    CacheControl: 'max-age=31536000' // 1 year cache
  };

  await client.upload(params).promise();

  // Return CDN URL if available, otherwise direct Spaces URL
  if (CDN_ENDPOINT) {
    return `https://${CDN_ENDPOINT}/${key}`;
  }

  const endpoint = process.env.DO_SPACES_ENDPOINT;
  return `https://${BUCKET_NAME}.${endpoint}/${key}`;
};

/**
 * Delete file from DigitalOcean Spaces
 * @param {String} url - File URL or key
 * @returns {Promise<Boolean>} Success status
 */
const deleteFromSpaces = async (url) => {
  const client = getS3Client();

  if (!client) {
    console.log(`[Mock Storage] Would delete: ${url}`);
    return true;
  }

  // Extract key from URL
  let key = url;
  if (url.includes('://')) {
    const urlObj = new URL(url);
    key = urlObj.pathname.slice(1); // Remove leading slash
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };

  try {
    await client.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Failed to delete from Spaces:', error.message);
    return false;
  }
};

/**
 * Generate signed URL for private file access
 * @param {String} key - File key
 * @param {Number} expiresIn - URL expiration in seconds
 * @returns {Promise<String>} Signed URL
 */
const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  const client = getS3Client();

  if (!client) {
    return `https://mock-storage.local/${key}?signed=true`;
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn
  };

  return client.getSignedUrlPromise('getObject', params);
};

/**
 * Generate unique filename with hash
 * @param {String} prefix - Filename prefix
 * @param {String} extension - File extension
 * @returns {String} Unique filename
 */
const generateUniqueFilename = (prefix, extension) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${random}.${extension}`;
};

/**
 * Get file URL (CDN or direct)
 * @param {String} key - File key
 * @returns {String} Public URL
 */
const getFileUrl = (key) => {
  if (CDN_ENDPOINT) {
    return `https://${CDN_ENDPOINT}/${key}`;
  }

  const endpoint = process.env.DO_SPACES_ENDPOINT;
  if (endpoint) {
    return `https://${BUCKET_NAME}.${endpoint}/${key}`;
  }

  return `https://mock-storage.local/${key}`;
};

module.exports = {
  uploadToSpaces,
  deleteFromSpaces,
  getSignedDownloadUrl,
  generateUniqueFilename,
  getFileUrl
};
