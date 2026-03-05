/**
 * Call Service
 * Handles call business logic and Xirsys integration
 */

const Call = require('../models/Call');
const { getIceServers } = require('../config/xirsys');

// Cache ICE servers for 5 minutes to reduce API calls
let cachedIceServers = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get ICE servers (cached)
 */
const getCachedIceServers = async () => {
  const now = Date.now();

  if (cachedIceServers && now < cacheExpiry) {
    return cachedIceServers;
  }

  cachedIceServers = await getIceServers();
  cacheExpiry = now + CACHE_DURATION;

  return cachedIceServers;
};

/**
 * Create a new call record
 */
const createCall = async (callerId, receiverId, type) => {
  return Call.create({
    participants: [callerId, receiverId],
    initiator: callerId,
    type,
    status: 'ringing',
    startTime: new Date()
  });
};

/**
 * Update call status
 */
const updateCallStatus = async (callId, status, extras = {}) => {
  const update = { status, ...extras };

  if (status === 'active') {
    update.answeredAt = new Date();
  }

  if (['ended', 'missed', 'rejected', 'failed'].includes(status)) {
    update.endTime = new Date();

    // Calculate duration if call was answered
    const call = await Call.findById(callId);
    if (call && call.answeredAt) {
      update.duration = Math.floor((new Date() - call.answeredAt) / 1000);
    }
  }

  return Call.findByIdAndUpdate(callId, update, { new: true });
};

/**
 * Get call history for a user
 */
const getCallHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20, type } = options;
  const skip = (page - 1) * limit;

  const filter = {
    participants: userId,
    status: { $in: ['ended', 'missed', 'rejected'] }
  };

  if (type && ['audio', 'video'].includes(type)) {
    filter.type = type;
  }

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants', 'name profilePicture')
      .populate('initiator', 'name profilePicture')
      .lean(),
    Call.countDocuments(filter)
  ]);

  return {
    calls,
    pagination: {
      total,
      page,
      limit,
      hasMore: skip + calls.length < total
    }
  };
};

/**
 * Get missed calls count for a user
 */
const getMissedCallsCount = async (userId, since = null) => {
  const filter = {
    participants: userId,
    initiator: { $ne: userId }, // They didn't initiate
    status: 'missed'
  };

  if (since) {
    filter.createdAt = { $gte: since };
  }

  return Call.countDocuments(filter);
};

/**
 * Check if user is currently in a call
 */
const isUserInCall = async (userId) => {
  const activeCall = await Call.findOne({
    participants: userId,
    status: { $in: ['ringing', 'active'] }
  });
  return activeCall;
};

/**
 * Get a specific call
 */
const getCall = async (callId) => {
  return Call.findById(callId)
    .populate('participants', 'name profilePicture')
    .populate('initiator', 'name profilePicture');
};

module.exports = {
  getCachedIceServers,
  createCall,
  updateCallStatus,
  getCallHistory,
  getMissedCallsCount,
  isUserInCall,
  getCall
};
