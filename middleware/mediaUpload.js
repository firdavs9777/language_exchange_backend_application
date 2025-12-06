const ErrorResponse = require('../utils/errorResponse');
const { validateFileType, validateFileSize, getMediaType, getFileSizeLimits } = require('../utils/mediaUtils');

/**
 * Middleware to validate media uploads
 */
exports.validateMediaUpload = (allowedTypes = ['image', 'audio', 'video', 'document']) => {
  return (req, res, next) => {
    if (!req.files || !req.files.file) {
      // Media is optional, so if no file, just continue
      return next();
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const fileSize = file.size;
    const mediaType = getMediaType(mimeType);

    // Check if file type is allowed
    if (!mediaType || !allowedTypes.includes(mediaType)) {
      return next(new ErrorResponse(
        `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        400
      ));
    }

    // Validate MIME type
    if (!validateFileType(mimeType, allowedTypes)) {
      return next(new ErrorResponse('Invalid file type', 400));
    }

    // Validate file size
    const sizeLimits = getFileSizeLimits();
    const maxSize = sizeLimits[mediaType];
    
    if (!validateFileSize(fileSize, maxSize)) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      return next(new ErrorResponse(
        `File size exceeds limit. Maximum size for ${mediaType}: ${maxSizeMB}MB`,
        400
      ));
    }

    // Attach media info to request
    req.mediaInfo = {
      type: mediaType,
      mimeType: mimeType,
      fileSize: fileSize,
      originalName: file.name
    };

    next();
  };
};

