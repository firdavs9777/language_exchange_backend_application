// utils/videoUtils.js
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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
 * Get video metadata using ffprobe via shell exec
 * Works reliably with PM2 by using shell execution
 *
 * @param {string} filePath - Path to video file or URL
 * @returns {Promise<Object>} Video metadata including duration, width, height
 */
exports.getVideoMetadata = async (filePath) => {
  console.log('🎬 Getting video metadata for:', filePath);

  try {
    // Use shell execution - handles PATH properly
    const cmd = `/usr/bin/ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;

    const { stdout } = await execAsync(cmd, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (!stdout) {
      throw new Error('No output from ffprobe');
    }

    const metadata = JSON.parse(stdout);
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
    return result;

  } catch (error) {
    console.error('❌ ffprobe error:', error.message);
    throw new Error('Failed to get video metadata. Ensure ffmpeg is installed.');
  }
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
 * Generate video thumbnail using ffmpeg via shell exec
 * Extracts a frame at 1 second mark
 *
 * @param {string} videoPath - Path to video file or URL
 * @param {string} outputPath - Path for output thumbnail
 * @returns {Promise<string>} Path to generated thumbnail
 */
exports.generateVideoThumbnail = async (videoPath, outputPath) => {
  console.log('🖼️ Generating thumbnail for:', videoPath);

  try {
    // Use shell execution - handles PATH properly
    const cmd = `/usr/bin/ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=480:-1" -q:v 2 -y "${outputPath}"`;

    await execAsync(cmd, {
      timeout: 60000 // 60 second timeout
    });

    console.log('✅ Thumbnail generated:', outputPath);
    return outputPath;

  } catch (error) {
    console.error('❌ Thumbnail error:', error.message);
    throw new Error('Failed to generate thumbnail');
  }
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
exports.FFPROBE_PATH = '/usr/bin/ffprobe';
exports.FFMPEG_PATH = '/usr/bin/ffmpeg';