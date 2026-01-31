const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

/**
 * Validate file type based on MIME type
 */
exports.validateFileType = (mimeType, allowedTypes) => {
  if (!mimeType) return false;
  
  const typeMap = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/x-aac', 'audio/mp4', 'audio/x-m4a'],  // MP3, AAC, M4A
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  };

  const allowedMimeTypes = allowedTypes.flatMap(type => typeMap[type] || []);
  return allowedMimeTypes.includes(mimeType);
};

/**
 * Get media type from MIME type
 */
exports.getMediaType = (mimeType) => {
  if (!mimeType) return null;
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/')) return 'document';
  
  return null;
};

/**
 * Generate thumbnail for image
 */
exports.generateImageThumbnail = async (filePath, outputPath, width = 300, height = 300) => {
  try {
    await sharp(filePath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return false;
  }
};

/**
 * Compress image
 */
exports.compressImage = async (filePath, outputPath, quality = 85) => {
  try {
    await sharp(filePath)
      .jpeg({ quality })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Error compressing image:', error);
    return false;
  }
};

/**
 * Get image dimensions
 */
exports.getImageDimensions = async (filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return null;
  }
};

/**
 * Validate file size
 */
exports.validateFileSize = (fileSize, maxSize) => {
  return fileSize <= maxSize;
};

/**
 * Get file size limits
 */
exports.getFileSizeLimits = () => {
  return {
    image: 10 * 1024 * 1024, // 10MB
    audio: 25 * 1024 * 1024, // 25MB
    video: 100 * 1024 * 1024, // 100MB
    document: 50 * 1024 * 1024 // 50MB
  };
};

/**
 * Generate unique filename
 */
exports.generateFileName = (originalName, userId, type) => {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `message-${userId}-${timestamp}-${random}${ext}`;
};

/**
 * Generate thumbnail filename
 */
exports.generateThumbnailFileName = (originalFileName) => {
  const ext = path.extname(originalFileName);
  const nameWithoutExt = path.basename(originalFileName, ext);
  return `${nameWithoutExt}-thumb.jpg`;
};

