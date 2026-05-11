const express = require('express');
const router = express.Router();

const {
  getCallHistory,
  getCall,
  getMissedCallsCount,
  getIceServers,
  initiateCall,
  acceptCall,
  declineCall,
  endCall
} = require('../controllers/callController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/v1/calls
 * @desc    Get call history
 * @query   page, limit, type (audio|video)
 */
router.get('/', getCallHistory);

/**
 * @route   GET /api/v1/calls/ice-servers
 * @desc    Get ICE servers for WebRTC
 */
router.get('/ice-servers', getIceServers);

/**
 * @route   GET /api/v1/calls/missed/count
 * @desc    Get missed calls count
 * @query   since (ISO date string)
 */
router.get('/missed/count', getMissedCallsCount);

/**
 * @route   GET /api/v1/calls/:id
 * @desc    Get single call details
 */
router.get('/:id', getCall);

/**
 * @route   POST /api/v1/calls/initiate
 * @desc    Initiate a 1:1 call — creates Call (ringing), mints LiveKit
 *          tokens for both peers, pushes FCM data to receiver.
 * @body    { receiverId, type: 'audio' | 'video' }
 */
router.post('/initiate', initiateCall);

/**
 * @route   POST /api/v1/calls/:id/accept
 * @desc    Receiver accepts the call — marks active, mints fresh
 *          receiver token, emits call:accepted to caller.
 */
router.post('/:id/accept', acceptCall);

/**
 * @route   POST /api/v1/calls/:id/decline
 * @desc    Receiver declines the call — marks rejected, emits
 *          call:declined to caller.
 */
router.post('/:id/decline', declineCall);

/**
 * @route   POST /api/v1/calls/:id/end
 * @desc    Participant ends an active call — marks ended, computes
 *          duration, emits call:ended to both peers.
 */
router.post('/:id/end', endCall);

module.exports = router;
