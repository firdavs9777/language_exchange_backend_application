// config/spaces.js
const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  endpoint: `https://${process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com'}`,
  region: 'sfo3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET
  }
});

module.exports = s3Client;