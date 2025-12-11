const AWS = require('aws-sdk');

// Configure DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint('sfo3.digitaloceanspaces.com');

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: 'sfo3'
});

module.exports = s3;