const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/spaces');
const path = require('path');

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
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