const s3 = require('../config/spaces');

// Helper to extract the S3 object key from Spaces URL
function getKeyFromSpacesUrl(url) {
  // Example: https://my-projects-media.sfo3.digitaloceanspaces.com/bananatalk/profiles/123-abc.jpg
  // Returns: bananatalk/profiles/123-abc.jpg
  const match = url.match(/\.amazonaws\.com\/(.+)$/) || url.match(/digitaloceanspaces.com\/(.+)$/);
  return match ? match[1] : url;
}

async function deleteFromSpaces(url) {
  const Key = getKeyFromSpacesUrl(url);
  const Bucket = 'my-projects-media';
  return new Promise(resolve => {
    s3.deleteObject({ Bucket, Key }, (err, data) => {
      if (err) {
        console.error('Error deleting from Spaces:', url, err);
      }
      resolve();
    });
  });
}

module.exports = deleteFromSpaces;
