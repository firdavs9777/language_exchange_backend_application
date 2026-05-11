const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const { mintRoomToken } = require('../services/livekitService');
const VoiceRoom = require('../models/VoiceRoom');
const Call = require('../models/Call');

/**
 * @route   POST /api/v1/livekit/test-token
 * @desc    Mint a LiveKit token for the smoke-test screen.
 *          Any authenticated user can join a hardcoded test room.
 * @body    { roomName?: string }   // defaults to 'smoke-test'
 */
exports.getTestToken = asyncHandler(async (req, res, next) => {
  const roomName = (req.body?.roomName || 'smoke-test').toString();

  const { token, url } = await mintRoomToken({
    identity: req.user._id.toString(),
    name: req.user.name || 'Guest',
    roomName,
  });

  res.status(200).json({
    success: true,
    data: { token, url, roomName },
  });
});

/**
 * @route   POST /api/v1/livekit/webhook
 * @desc    LiveKit Cloud webhook receiver (signed). Handles transport-
 *          level reconciliation when clients crash mid-call/room without
 *          a graceful disconnect.
 * @access  Verified via Authorization JWT (verifyLivekitWebhook mw)
 */
exports.webhook = async (req, res) => {
  const event = req.livekitEvent;
  const eventType = event.event;
  const roomName = event.room?.name;
  const participantIdentity = event.participant?.identity;

  try {
    if (eventType === 'room_finished' && roomName) {
      // Voice rooms use roomName = voiceRoom._id.toString()
      // Calls use roomName = 'call:' + callId
      if (roomName.startsWith('call:')) {
        const callId = roomName.slice('call:'.length);
        await Call.updateOne(
          { _id: callId, status: { $in: ['ringing', 'active'] } },
          { $set: { status: 'ended', endTime: new Date() } }
        );
      } else {
        await VoiceRoom.updateOne(
          { _id: roomName, status: 'active' },
          { $set: { status: 'ended', endedAt: new Date() } }
        );
      }
    } else if (eventType === 'participant_left' && roomName && participantIdentity) {
      if (!roomName.startsWith('call:')) {
        // Pull this user out of the voice room's participants array
        await VoiceRoom.updateOne(
          { _id: roomName },
          { $pull: { participants: { user: participantIdentity } } }
        );
        // If the room now has zero participants, mark it ended
        const room = await VoiceRoom.findById(roomName);
        if (room && room.participants.length === 0) {
          room.status = 'ended';
          room.endedAt = new Date();
          await room.save();
        }
      }
    } else if (eventType === 'participant_joined') {
      // Future: analytics. No-op for now.
    }
  } catch (e) {
    console.error('[livekit-webhook] handler error for', eventType, ':', e.message);
    // Still respond 200 — LiveKit retries on non-2xx
  }

  res.status(200).json({ ok: true });
};
