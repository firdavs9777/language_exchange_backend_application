// utils/videoUtils.js
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Set ffmpeg/ffprobe paths explicitly for PM2 compatibility
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

// Maximum video duration in seconds (10 minutes)
const MAX_VIDEO_DURATION = 600;

// Maximum file size for videos (1GB - YouTube-style uploads)
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;

// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',  // .mov
  'video/x-msvideo',  // .avi
  'video/webm',
  'video/3gpp',       // .3gp
  'video/x-m4v'       // .m4v
];

/**
 * Validate video MIME type
 */
exports.isValidVideoType = (mimeType) => {
  return ALLOWED_VIDEO_TYPES.includes(mimeType);
};

/**
 * Get video metadata using ffprobe (via fluent-ffmpeg)
 * Memory-efficient - only reads metadata, not full video
 *
 * @param {string} filePath - Path to video file or URL
 * @returns {Promise<Object>} Video metadata including duration, width, height
 */
exports.getVideoMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log('🎬 Getting video metadata for:', filePath);

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('❌ ffprobe error:', err.message);
        return reject(new Error('Failed to get video metadata. Ensure ffmpeg is installed.'));
      }

      try {
        const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
        const format = metadata.format || {};

        const result = {
          duration: parseFloat(format.duration) || 0,
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          bitrate: parseInt(format.bit_rate) || null,
          codec: videoStream?.codec_name || null,
          size: parseInt(format.size) || null
        };

        console.log('✅ Video metadata:', result);
        resolve(result);
      } catch (parseError) {
        console.error('❌ Failed to parse metadata:', parseError);
        reject(new Error('Failed to parse video metadata'));
      }
    });
  });
};

/**
 * Validate video duration is under max limit
 *
 * @param {number} duration - Duration in seconds
 * @returns {boolean}
 */
exports.isValidDuration = (duration) => {
  return duration > 0 && duration <= MAX_VIDEO_DURATION;
};

/**
 * Generate video thumbnail using ffmpeg (via fluent-ffmpeg)
 * Extracts a frame at 1 second mark
 *
 * @param {string} videoPath - Path to video file or URL
 * @param {string} outputPath - Path for output thumbnail
 * @returns {Promise<string>} Path to generated thumbnail
 */
exports.generateVideoThumbnail = (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    console.log('🖼️ Generating thumbnail for:', videoPath);

    const outputDir = path.dirname(outputPath);
    const outputFilename = path.basename(outputPath);

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: outputFilename,
        folder: outputDir,
        size: '480x?'
      })
      .on('end', () => {
        console.log('✅ Thumbnail generated:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Thumbnail error:', err.message);
        reject(new Error('Failed to generate thumbnail'));
      });
  });
};

/**
 * Generate a unique filename for video
 *
 * @param {string} originalName - Original filename
 * @param {string} prefix - Prefix for the filename
 * @returns {string}
 */
exports.generateVideoFileName = (originalName, prefix = 'video') => {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}${ext}`;
};

/**
 * Format duration from seconds to MM:SS
 *
 * @param {number} seconds
 * @returns {string}
 */
exports.formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get video upload constraints for frontend validation
 * @returns {Object} Video constraints
 */
exports.getVideoConstraints = () => {
  return {
    maxDuration: MAX_VIDEO_DURATION,
    maxDurationFormatted: '10:00',
    maxSize: MAX_VIDEO_SIZE,
    maxSizeMB: MAX_VIDEO_SIZE / (1024 * 1024),
    maxSizeGB: MAX_VIDEO_SIZE / (1024 * 1024 * 1024),
    allowedTypes: ALLOWED_VIDEO_TYPES,
    allowedExtensions: ['.mp4', '.mov', '.avi', '.webm', '.3gp', '.m4v'],
    recommendedFormat: 'video/mp4',
    recommendedCodec: 'H.264',
    recommendedResolution: {
      maxWidth: 1080,
      maxHeight: 1920,
      aspectRatios: ['9:16', '16:9', '1:1', '4:5']
    }
  };
};

// Export constants
exports.MAX_VIDEO_DURATION = MAX_VIDEO_DURATION;
exports.MAX_VIDEO_SIZE = MAX_VIDEO_SIZE;
exports.ALLOWED_VIDEO_TYPES = ALLOWED_VIDEO_TYPES;
exports.FFPROBE_PATH = FFPROBE_PATH;
exports.FFMPEG_PATH = FFMPEG_PATH;