// middleware/uploadVideoToSpaces.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/spaces');
const path = require('path');
const {
  getVideoMetadata,
  isValidDuration,
  generateVideoThumbnail,
  generateVideoFileName,
  MAX_VIDEO_DURATION,
  MAX_VIDEO_SIZE,
  ALLOWED_VIDEO_TYPES,
  isValidVideoType
} = require('../utils/videoUtils');
const deleteFromSpaces = require('../utils/deleteFromSpaces');
const os = require('os');
const fs = require('fs').promises;

/**
 * Multer configuration for streaming video uploads to Spaces
 * Memory-efficient: streams directly to S3 without loading entire file into memory
 */
const videoUploader = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'my-projects-media',
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const folder = req.uploadFolder || 'bananatalk/moments/videos';
      const fileName = generateVideoFileName(file.originalname, 'moment');
      cb(null, `${folder}/${fileName}`);
    }
  }),
  limits: {
    fileSize: MAX_VIDEO_SIZE, // 1GB max - YouTube-style video uploads
    files: 1 // Only 1 video per upload
  },
  fileFilter: (req, file, cb) => {
    // Validate video MIME type
    if (!isValidVideoType(file.mimetype)) {
      return cb(
        new Error(`Invalid video format. Allowed: MP4, MOV, AVI, WebM, 3GP, M4V`),
        false
      );
    }
    cb(null, true);
  }
});

/**
 * Upload single video with validation
 * Streams directly to S3, then validates duration
 *
 * @param {string} fieldName - Form field name for the video
 * @param {string} folder - S3 folder path
 */
const uploadSingleVideo = (fieldName, folder = 'bananatalk/moments/videos') => {
  return (req, res, next) => {
    req.uploadFolder = folder;

    // First, upload the video to S3 (streamed, memory-efficient)
    videoUploader.single(fieldName)(req, res, async (err) => {
      if (err) {
        // Handle multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: `Video size exceeds maximum limit of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`
            });
          }
          return res.status(400).json({
            success: false,
            error: `Upload error: ${err.message}`
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      // No file uploaded
      if (!req.file) {
        return next(); // Let controller handle missing file
      }

      // Video uploaded to S3, now validate duration
      try {
        // Ensure URL has correct format (https://bucket.region.digitaloceanspaces.com/key)
        let videoUrl = req.file.location;
        if (!videoUrl.startsWith('https://')) {
          // Fix malformed URL from multer-s3
          videoUrl = `https://my-projects-media.sfo3.digitaloceanspaces.com/${req.file.key}`;
        }

        console.log(`📹 Video uploaded to S3: ${videoUrl}`);
        console.log(`📊 Validating video duration...`);

        // Get video metadata from the S3 URL (ffprobe can read URLs)
        const metadata = await getVideoMetadata(videoUrl);

        console.log(`📏 Video duration: ${metadata.duration}s (max: ${MAX_VIDEO_DURATION}s)`);

        // Check duration limit (10 minutes = 600 seconds)
        if (!isValidDuration(metadata.duration)) {
          // Duration exceeds limit - delete the uploaded video
          console.log(`❌ Video duration ${metadata.duration}s exceeds ${MAX_VIDEO_DURATION}s limit. Deleting...`);
          await deleteFromSpaces(req.file.location);

          return res.status(400).json({
            success: false,
            error: `Video duration (${Math.ceil(metadata.duration)}s) exceeds maximum of ${MAX_VIDEO_DURATION} seconds (10 minutes)`,
            maxDuration: MAX_VIDEO_DURATION
          });
        }

        // Attach video metadata to request for controller use
        req.videoMetadata = {
          url: videoUrl,  // Use corrected URL
          duration: Math.round(metadata.duration * 10) / 10, // Round to 1 decimal
          width: metadata.width,
          height: metadata.height,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          key: req.file.key
        };

        console.log(`✅ Video validated successfully`);
        next();

      } catch (validationError) {
        console.error('Video validation error:', validationError);

        // If validation fails, try to delete the uploaded video
        try {
          await deleteFromSpaces(req.file.location);
        } catch (deleteError) {
          console.error('Failed to delete invalid video:', deleteError);
        }

        // Check if ffmpeg not installed
        if (validationError.message.includes('ffmpeg') || validationError.message.includes('ffprobe')) {
          return res.status(500).json({
            success: false,
            error: 'Video processing service unavailable. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? validationError.message : undefined
          });
        }

        return res.status(400).json({
          success: false,
          error: 'Failed to validate video. Please try again with a different file.'
        });
      }
    });
  };
};

/**
 * Middleware to generate video thumbnail
 * Call after uploadSingleVideo if thumbnail is needed
 */
const generateThumbnail = async (req, res, next) => {
  if (!req.videoMetadata || !req.videoMetadata.url) {
    return next();
  }

  try {
    // Generate thumbnail filename
    const thumbnailKey = req.videoMetadata.key.replace(/\.[^.]+$/, '-thumb.jpg');
    const tempPath = path.join(os.tmpdir(), `thumb-${Date.now()}.jpg`);

    // Generate thumbnail locally
    await generateVideoThumbnail(req.videoMetadata.url, tempPath);

    // Upload thumbnail to S3
    const thumbnailBuffer = await fs.readFile(tempPath);

    await s3.upload({
      Bucket: 'my-projects-media',
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ACL: 'public-read',
      ContentType: 'image/jpeg'
    }).promise();

    // Construct thumbnail URL
    const bucketUrl = `https://my-projects-media.sfo3.digitaloceanspaces.com`;
    req.videoMetadata.thumbnail = `${bucketUrl}/${thumbnailKey}`;

    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});

    console.log(`🖼️ Thumbnail generated: ${req.videoMetadata.thumbnail}`);
    next();

  } catch (thumbnailError) {
    console.error('Thumbnail generation failed:', thumbnailError);
    // Don't fail the request, just continue without thumbnail
    req.videoMetadata.thumbnail = null;
    next();
  }
};

module.exports = {
  uploadSingleVideo,
  generateThumbnail,
  MAX_VIDEO_DURATION,
  MAX_VIDEO_SIZE
};
