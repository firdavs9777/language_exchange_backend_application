const express = require('express');
const router = express.Router();

const {
  getCallHistory,
  getCall,
  getMissedCallsCount,
  getIceServers
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

module.exports = router;
