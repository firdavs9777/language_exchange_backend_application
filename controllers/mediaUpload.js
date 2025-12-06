const path = require('path');
const fs = require('fs').promises;
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const {
  generateFileName,
  generateThumbnailFileName,
  generateImageThumbnail,
  compressImage,
  getImageDimensions,
  getMediaType
} = require('../utils/mediaUtils');

/**
 * @desc    Process and save media file
 * @access  Private
 */
exports.processMediaUpload = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.file) {
    return next(); // No media file, continue
  }

  const file = req.files.file;
  const userId = req.user._id;
  const uploadsDir = path.join(__dirname, '../uploads');
  
  // Ensure uploads directory exists
  await fs.mkdir(uploadsDir, { recursive: true });

  const mediaType = getMediaType(file.mimetype);
  const fileName = generateFileName(file.name, userId, mediaType);
  const filePath = path.join(uploadsDir, fileName);

  // Move file to uploads directory
  await file.mv(filePath);

  let mediaData = {
    url: fileName,
    type: mediaType,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.mimetype
  };

  // Process based on media type
  if (mediaType === 'image') {
    // Generate thumbnail
    const thumbnailFileName = generateThumbnailFileName(fileName);
    const thumbnailPath = path.join(uploadsDir, thumbnailFileName);
    
    await generateImageThumbnail(filePath, thumbnailPath);
    mediaData.thumbnail = thumbnailFileName;

    // Get dimensions
    const dimensions = await getImageDimensions(filePath);
    if (dimensions) {
      mediaData.dimensions = dimensions;
    }

    // Compress image (optional - can be done asynchronously)
    // const compressedPath = path.join(uploadsDir, `compressed-${fileName}`);
    // await compressImage(filePath, compressedPath);
  }

  // For video, thumbnail generation would require ffmpeg (future enhancement)
  // For audio, duration extraction would require audio processing library (future enhancement)

  // Attach processed media data to request
  req.processedMedia = mediaData;

  next();
});

/**
 * @desc    Delete media file
 * @access  Private
 */
exports.deleteMediaFile = async (fileName) => {
  if (!fileName) return;
  
  const filePath = path.join(__dirname, '../uploads', fileName);
  
  try {
    await fs.unlink(filePath);
    
    // Also delete thumbnail if exists
    const thumbnailPath = path.join(__dirname, '../uploads', generateThumbnailFileName(fileName));
    try {
      await fs.unlink(thumbnailPath);
    } catch (err) {
      // Thumbnail might not exist, ignore error
    }
  } catch (error) {
    console.error(`Error deleting media file ${fileName}:`, error);
  }
};

