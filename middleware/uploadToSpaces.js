const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/spaces');

// Bucket configuration
const BUCKET_NAME = 'my-projects-media';
const BUCKET_REGION = 'sfo3';
const BUCKET_URL = `https://${BUCKET_NAME}.${BUCKET_REGION}.digitaloceanspaces.com`;

/**
 * Fix malformed S3 URLs from multer-s3
 * multer-s3 sometimes returns URLs like: sfo3.digitaloceanspaces.com/bucket/key
 * Should be: https://bucket.sfo3.digitaloceanspaces.com/key
 */
const fixS3Url = (file) => {
  if (!file || !file.location) return;

  if (!file.location.startsWith('https://')) {
    file.location = `${BUCKET_URL}/${file.key}`;
  }
};

// File size limits
const VIDEO_MAX_SIZE = 1024 * 1024 * 1024; // 1GB for videos

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',  // .mov
  'video/x-msvideo',  // .avi
  'video/webm',
  'video/3gpp',       // .3gp
  'video/x-m4v'       // .m4v
];
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',       // .mp3
  'audio/mp3',        // .mp3 (alternative)
  'audio/aac',        // .aac (iOS native)
  'audio/x-aac',      // .aac (alternative)
  'audio/mp4',        // .m4a (AAC in MP4 container)
  'audio/x-m4a'       // .m4a (alternative)
];

// Upload to Spaces
const uploadToSpaces = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'my-projects-media',
    acl: 'public-read',
    key: function (req, file, cb) {
      const folder = req.uploadFolder || 'bananatalk'; // Default folder
      const fileName = `${folder}/${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE
  }),
  limits: { fileSize: VIDEO_MAX_SIZE }, // 1GB max (for videos), images validated in fileFilter
  fileFilter: (req, file, cb) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
    const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype);

    if (!isImage && !isVideo && !isAudio) {
      return cb(new Error('File type not allowed! Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, MOV, AVI, WebM), Audio (MP3, AAC, M4A)'));
    }

    cb(null, true);
  }
});

// Export different upload configurations
module.exports = {
  uploadSingle: (fieldName, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.single(fieldName)(req, res, (err) => {
        if (err) return next(err);
        // Fix malformed URL
        fixS3Url(req.file);
        next();
      });
    };
  },

  uploadMultiple: (fieldName, maxCount = 5, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.array(fieldName, maxCount)(req, res, (err) => {
        if (err) return next(err);
        // Fix malformed URLs for all files
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(fixS3Url);
        }
        next();
      });
    };
  },

  uploadFields: (fields, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.fields(fields)(req, res, (err) => {
        if (err) return next(err);
        // Fix malformed URLs for all field files
        if (req.files) {
          Object.values(req.files).flat().forEach(fixS3Url);
        }
        next();
      });
    };
  },

  // Export utilities for external use
  fixS3Url,
  BUCKET_URL,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES
};