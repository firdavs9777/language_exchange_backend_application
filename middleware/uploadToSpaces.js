const multer = require('multer');
const multerS3 = require('multer-s3');
const sharp = require('sharp');
const s3 = require('../config/spaces');

// Bucket configuration
const BUCKET_NAME = 'my-projects-media';
const BUCKET_REGION = 'sfo3';
// Use CDN URL for faster global delivery
const BUCKET_URL = `https://${BUCKET_NAME}.${BUCKET_REGION}.cdn.digitaloceanspaces.com`;

// Image compression settings
const CHAT_IMAGE_MAX_WIDTH = 1200;
const CHAT_IMAGE_QUALITY = 90; // High quality, still saves ~50% file size

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
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',                                                          // .pdf
  'application/msword',                                                       // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
  'application/vnd.ms-excel',                                                 // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // .xlsx
  'application/vnd.ms-powerpoint',                                            // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',                                                               // .txt
  'text/csv',                                                                 // .csv
  'application/zip',                                                          // .zip
  'application/x-zip-compressed',                                             // .zip (alternative)
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
    const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.mimetype);

    if (!isImage && !isVideo && !isAudio && !isDocument) {
      return cb(new Error('File type not allowed! Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, MOV, AVI, WebM), Audio (MP3, AAC, M4A), Documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP)'));
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
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES,

  /**
   * Upload with image compression for chat messages
   * Compresses images to reduce file size for slow connections
   * Non-image files are uploaded without modification
   */
  uploadSingleCompressed: (fieldName, folder = 'bananatalk') => {
    // Use memory storage for compression
    const memoryUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: VIDEO_MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
        const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype);
        const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.mimetype);

        if (!isImage && !isVideo && !isAudio && !isDocument) {
          return cb(new Error('File type not allowed!'));
        }
        cb(null, true);
      }
    });

    return (req, res, next) => {
      memoryUpload.single(fieldName)(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const file = req.file;
          const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
          let buffer = file.buffer;
          let contentType = file.mimetype;
          let fileName = `${folder}/${Date.now()}-${file.originalname}`;

          // Compress images only (skip GIFs to preserve animation)
          if (isImage && file.mimetype !== 'image/gif') {
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Resize if wider than max width
            if (metadata.width > CHAT_IMAGE_MAX_WIDTH) {
              image.resize(CHAT_IMAGE_MAX_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside'
              });
            }

            // Compress to JPEG for better compression (except PNGs with transparency)
            if (file.mimetype === 'image/png') {
              buffer = await image.png({ quality: CHAT_IMAGE_QUALITY, compressionLevel: 9 }).toBuffer();
            } else {
              buffer = await image.jpeg({ quality: CHAT_IMAGE_QUALITY, progressive: true }).toBuffer();
              contentType = 'image/jpeg';
              fileName = fileName.replace(/\.(png|webp)$/i, '.jpg');
            }

            console.log(`📸 Compressed image: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB → ${(buffer.length / 1024).toFixed(1)}KB)`);
          }

          // Upload to S3/Spaces
          const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ACL: 'public-read',
            ContentType: contentType
          };

          const result = await s3.upload(uploadParams).promise();

          // Set file properties like multer-s3 does
          req.file.location = result.Location || `${BUCKET_URL}/${fileName}`;
          req.file.key = fileName;
          req.file.size = buffer.length;
          req.file.mimetype = contentType;

          // Fix URL if needed
          fixS3Url(req.file);

          next();
        } catch (compressError) {
          console.error('❌ Image compression error:', compressError);
          // Fall back to original file if compression fails
          next(compressError);
        }
      });
    };
  },

  /**
   * Upload multiple files with image compression
   * Compresses images to reduce file size for slow connections
   * Non-image files are uploaded without modification
   */
  uploadMultipleCompressed: (fieldName, maxCount = 5, folder = 'bananatalk') => {
    const memoryUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: VIDEO_MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
        const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype);
        const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.mimetype);

        if (!isImage && !isVideo && !isAudio && !isDocument) {
          return cb(new Error('File type not allowed!'));
        }
        cb(null, true);
      }
    });

    return (req, res, next) => {
      memoryUpload.array(fieldName, maxCount)(req, res, async (err) => {
        if (err) return next(err);
        if (!req.files || req.files.length === 0) return next();

        try {
          const uploadedFiles = [];

          for (const file of req.files) {
            const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
            let buffer = file.buffer;
            let contentType = file.mimetype;
            let fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${file.originalname}`;

            // Compress images only (skip GIFs to preserve animation)
            if (isImage && file.mimetype !== 'image/gif') {
              const image = sharp(buffer);
              const metadata = await image.metadata();

              if (metadata.width > CHAT_IMAGE_MAX_WIDTH) {
                image.resize(CHAT_IMAGE_MAX_WIDTH, null, {
                  withoutEnlargement: true,
                  fit: 'inside'
                });
              }

              if (file.mimetype === 'image/png') {
                buffer = await image.png({ quality: CHAT_IMAGE_QUALITY, compressionLevel: 9 }).toBuffer();
              } else {
                buffer = await image.jpeg({ quality: CHAT_IMAGE_QUALITY, progressive: true }).toBuffer();
                contentType = 'image/jpeg';
                fileName = fileName.replace(/\.(png|webp)$/i, '.jpg');
              }

              console.log(`📸 Compressed image: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB → ${(buffer.length / 1024).toFixed(1)}KB)`);
            }

            // Upload to S3/Spaces
            const uploadParams = {
              Bucket: BUCKET_NAME,
              Key: fileName,
              Body: buffer,
              ACL: 'public-read',
              ContentType: contentType
            };

            const result = await s3.upload(uploadParams).promise();

            const uploadedFile = {
              ...file,
              location: result.Location || `${BUCKET_URL}/${fileName}`,
              key: fileName,
              size: buffer.length,
              mimetype: contentType
            };

            fixS3Url(uploadedFile);
            uploadedFiles.push(uploadedFile);
          }

          req.files = uploadedFiles;
          next();
        } catch (compressError) {
          console.error('❌ Image compression error:', compressError);
          next(compressError);
        }
      });
    };
  }
};