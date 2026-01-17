const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/spaces');

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

    if (!isImage && !isVideo) {
      return cb(new Error('Only images and videos are allowed! Supported formats: JPG, PNG, GIF, WebP, MP4, MOV, AVI, WebM, 3GP, M4V'));
    }

    cb(null, true);
  }
});

// Export different upload configurations
module.exports = {
  uploadSingle: (fieldName, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.single(fieldName)(req, res, next);
    };
  },
  
  uploadMultiple: (fieldName, maxCount = 5, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.array(fieldName, maxCount)(req, res, next);
    };
  },
  
  uploadFields: (fields, folder = 'bananatalk') => {
    return (req, res, next) => {
      req.uploadFolder = folder;
      uploadToSpaces.fields(fields)(req, res, next);
    };
  }
};