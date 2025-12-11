
// config/spaces.js
const AWS = require('aws-sdk');

// Configure DigitalOcean Spaces endpoint
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com');

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  // Do NOT set region for DigitalOcean Spaces with AWS SDK v2
});

module.exports = s3;