// utils/deleteFromSpaces.js
const s3 = require('../config/spaces');

/**
 * Delete a file from DigitalOcean Spaces
 * @param {string} fileUrl - Full CDN URL of the file
 * @returns {Promise<boolean>} - Success status
 */
const deleteFromSpaces = async (fileUrl) => {
  try {
    if (!fileUrl) {
      console.log('⚠️ No file URL provided for deletion');
      return false;
    }

    // Extract the key (path) from the full CDN URL
    // URL format: https://my-projects-media.sfo3.cdn.digitaloceanspaces.com/bananatalk/moments/123456-image.jpg
    // Key should be: bananatalk/moments/123456-image.jpg
    
    const cdnDomain = process.env.SPACES_CDN_URL || 'https://my-projects-media.sfo3.cdn.digitaloceanspaces.com';
    
    // Remove the CDN domain from URL to get the key
    let key = fileUrl.replace(cdnDomain + '/', '');
    
    // Also handle endpoint URL format (without CDN)
    const endpointUrl = `https://${process.env.SPACES_BUCKET || 'my-projects-media'}.${process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com'}`;
    key = key.replace(endpointUrl + '/', '');
    
    if (!key || key === fileUrl) {
      console.log('⚠️ Could not extract key from URL:', fileUrl);
      return false;
    }

    console.log(`🗑️ Deleting from Spaces: ${key}`);

    const params = {
      Bucket: process.env.SPACES_BUCKET || 'my-projects-media',
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log(`✅ Successfully deleted: ${key}`);
    return true;

  } catch (err) {
    console.error('❌ Error deleting from Spaces:', err.message);
    console.error('File URL:', fileUrl);
    return false;
  }
};

/**
 * Delete multiple files from Spaces
 * @param {Array<string>} fileUrls - Array of CDN URLs
 * @returns {Promise<Object>} - { successful: number, failed: number }
 */
const deleteMultipleFromSpaces = async (fileUrls) => {
  if (!fileUrls || fileUrls.length === 0) {
    return { successful: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    fileUrls.map(url => deleteFromSpaces(url))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - successful;

  console.log(`📊 Deletion results: ${successful} successful, ${failed} failed`);
  
  return { successful, failed };
};

module.exports = deleteFromSpaces;
module.exports.deleteMultipleFromSpaces = deleteMultipleFromSpaces;