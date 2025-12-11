// utils/deleteFromSpaces.js
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/spaces');

const deleteFromSpaces = async (fileUrl) => {
  try {
    if (!fileUrl) {
      console.log('⚠️ No file URL provided for deletion');
      return false;
    }

    const cdnDomain = process.env.SPACES_CDN_URL || 'https://my-projects-media.sfo3.cdn.digitaloceanspaces.com';
    
    let key = fileUrl.replace(cdnDomain + '/', '');
    
    const endpointUrl = `https://${process.env.SPACES_BUCKET || 'my-projects-media'}.${process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com'}`;
    key = key.replace(endpointUrl + '/', '');
    
    if (!key || key === fileUrl) {
      console.log('⚠️ Could not extract key from URL:', fileUrl);
      return false;
    }

    console.log(`🗑️ Deleting from Spaces: ${key}`);

    const command = new DeleteObjectCommand({
      Bucket: process.env.SPACES_BUCKET || 'my-projects-media',
      Key: key
    });

    await s3Client.send(command);
    console.log(`✅ Successfully deleted: ${key}`);
    return true;

  } catch (err) {
    console.error('❌ Error deleting from Spaces:', err.message);
    console.error('File URL:', fileUrl);
    return false;
  }
};

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