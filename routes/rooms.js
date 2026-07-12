/**
 * Language Rooms ("hubs") REST routes — Workstream D, Task 4.
 * Mounted at /api/v1/rooms in server.js.
 *
 * Every route is wrapped by the ROOMS_ENABLED kill switch. Currently reads
 * process.env.ROOMS_ENABLED directly via lib/roomMembership.js:isRoomsEnabled
 * (default-true) — a clearly marked stand-in.
 *
 * TODO(Task 7): once config/limitations.js exports ROOMS_ENABLED, replace
 * the guard below with that centralized flag (kept identical behavior —
 * same default-true semantics — so swapping it is a drop-in change).
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isRoomsEnabled } = require('../lib/roomMembership');
const {
  getRooms,
  getRoom,
  getRoomMessages,
  joinRoom,
  leaveRoom,
  removeMember,
  muteMember,
  updateRoom
} = require('../controllers/rooms');

// Kill switch — short-circuits to 404 when ROOMS_ENABLED is false, so the
// entire feature can be pulled without a deploy.
router.use((req, res, next) => {
  if (!isRoomsEnabled()) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  next();
});

router.use(protect);

router.route('/').get(getRooms);
router.route('/:id').get(getRoom).put(updateRoom);
router.route('/:id/messages').get(getRoomMessages);
router.route('/:id/join').post(joinRoom);
router.route('/:id/leave').post(leaveRoom);
router.route('/:id/members/:userId').delete(removeMember);
router.route('/:id/members/:userId/mute').post(muteMember);

module.exports = router;
