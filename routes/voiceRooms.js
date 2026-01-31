const express = require('express');
const router = express.Router();

const {
  getVoiceRooms,
  getVoiceRoom,
  createVoiceRoom,
  joinVoiceRoom,
  leaveVoiceRoom,
  endVoiceRoom,
  updateParticipantStatus,
  promoteParticipant,
  getMyRoom
} = require('../controllers/voiceRooms');

const { protect } = require('../middleware/auth');
const { interactionLimiter } = require('../middleware/rateLimiter');
const { checkVoiceRoomAccess } = require('../middleware/checkLimitations');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/v1/voicerooms
 * @desc    Get all active voice rooms
 * @query   language, topic, page, limit
 */
router.get('/', getVoiceRooms);

/**
 * @route   GET /api/v1/voicerooms/my
 * @desc    Get user's current active room
 */
router.get('/my', getMyRoom);

/**
 * @route   GET /api/v1/voicerooms/:id
 * @desc    Get single voice room details
 */
router.get('/:id', getVoiceRoom);

/**
 * @route   POST /api/v1/voicerooms
 * @desc    Create a new voice room
 * @body    { title, description?, topic?, language, secondaryLanguage?, maxParticipants?, isPublic?, tags? }
 * @access  Regular & VIP users only (visitors blocked)
 */
router.post('/', checkVoiceRoomAccess, interactionLimiter, createVoiceRoom);

/**
 * @route   POST /api/v1/voicerooms/:id/join
 * @desc    Join a voice room
 */
router.post('/:id/join', interactionLimiter, joinVoiceRoom);

/**
 * @route   POST /api/v1/voicerooms/:id/leave
 * @desc    Leave a voice room
 */
router.post('/:id/leave', leaveVoiceRoom);

/**
 * @route   POST /api/v1/voicerooms/:id/end
 * @desc    End a voice room (host only)
 */
router.post('/:id/end', endVoiceRoom);

/**
 * @route   PUT /api/v1/voicerooms/:id/status
 * @desc    Update participant status (mute/speaking)
 * @body    { isMuted?, isSpeaking? }
 */
router.put('/:id/status', updateParticipantStatus);

/**
 * @route   PUT /api/v1/voicerooms/:id/promote/:userId
 * @desc    Promote participant to co-host (host only)
 */
router.put('/:id/promote/:userId', promoteParticipant);

module.exports = router;
