const s3 = require('../config/spaces');

const BUCKET_NAME = process.env.SPACES_BUCKET || 'my-projects-media';

/**
 * Extract the S3 object key from various URL formats
 * Handles:
 * - CDN URLs: https://my-projects-media.sfo3.cdn.digitaloceanspaces.com/key
 * - Direct URLs: https://my-projects-media.sfo3.digitaloceanspaces.com/key
 * - AWS URLs: https://bucket.s3.amazonaws.com/key
 *
 * @param {string} url - The full URL to the file
 * @returns {string|null} The extracted key or null if invalid
 */
function getKeyFromSpacesUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Pattern 1: CDN URL - https://bucket.region.cdn.digitaloceanspaces.com/key
  const cdnMatch = url.match(/\.cdn\.digitaloceanspaces\.com\/(.+)$/);
  if (cdnMatch) return cdnMatch[1];

  // Pattern 2: Direct Spaces URL - https://bucket.region.digitaloceanspaces.com/key
  const directMatch = url.match(/digitaloceanspaces\.com\/(.+)$/);
  if (directMatch) return directMatch[1];

  // Pattern 3: AWS S3 URL - https://bucket.s3.amazonaws.com/key
  const awsMatch = url.match(/\.amazonaws\.com\/(.+)$/);
  if (awsMatch) return awsMatch[1];

  // Pattern 4: Just a key (no URL prefix)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  return null;
}

/**
 * Delete a single file from DigitalOcean Spaces
 *
 * @param {string} url - The URL of the file to delete
 * @returns {Promise<boolean>} True if deleted successfully, false otherwise
 */
async function deleteFromSpaces(url) {
  try {
    if (!url) {
      console.log('⚠️ No file URL provided for deletion');
      return false;
    }

    const key = getKeyFromSpacesUrl(url);

    if (!key) {
      console.log('⚠️ Could not extract key from URL:', url);
      return false;
    }

    return new Promise((resolve) => {
      s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }, (err, data) => {
        if (err) {
          console.error('❌ Error deleting from Spaces:', url, err.message);
          resolve(false);
        } else {
          console.log(`✅ Deleted from Spaces: ${key}`);
          resolve(true);
        }
      });
    });

  } catch (err) {
    console.error('❌ Exception deleting from Spaces:', err.message);
    return false;
  }
}

/**
 * Delete multiple files from DigitalOcean Spaces
 *
 * @param {string[]} fileUrls - Array of file URLs to delete
 * @returns {Promise<{successful: number, failed: number}>} Deletion results
 */
async function deleteMultipleFromSpaces(fileUrls) {
  if (!fileUrls || fileUrls.length === 0) {
    return { successful: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    fileUrls.map(url => deleteFromSpaces(url))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - successful;

  console.log(`📊 Bulk deletion: ${successful} successful, ${failed} failed`);

  return { successful, failed };
}

module.exports = deleteFromSpaces;
module.exports.deleteMultipleFromSpaces = deleteMultipleFromSpaces;
module.exports.getKeyFromSpacesUrl = getKeyFromSpacesUrl;
