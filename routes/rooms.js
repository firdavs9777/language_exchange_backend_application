/**
 * Language Rooms ("hubs") REST routes — Workstream D, Task 4.
 * Mounted at /api/v1/rooms in server.js.
 *
 * Every route is wrapped by the centralized ROOMS_ENABLED kill switch
 * (config/limitations.js — Task 7). Read fresh via getRoomsEnabled() rather
 * than the destructured constant so tests can toggle process.env at runtime
 * by clearing config/limitations.js's require cache.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roomsEnabledGuard } = require('../lib/roomMembership');
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
// entire feature can be pulled without a deploy. See
// lib/roomMembership.js:roomsEnabledGuard (unit tested there since this
// file can't be require()'d standalone in this sandbox — transitively pulls
// in jsonwebtoken via middleware/auth.js).
router.use(roomsEnabledGuard);

router.use(protect);

router.route('/').get(getRooms);
router.route('/:id').get(getRoom).put(updateRoom);
router.route('/:id/messages').get(getRoomMessages);
router.route('/:id/join').post(joinRoom);
router.route('/:id/leave').post(leaveRoom);
router.route('/:id/members/:userId').delete(removeMember);
router.route('/:id/members/:userId/mute').post(muteMember);

module.exports = router;
