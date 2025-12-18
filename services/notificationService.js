const User = require('../models/User');
const Notification = require('../models/Notification');
const fcmService = require('./fcmService');
const templates = require('../utils/notificationTemplates');

/**
 * Notification Service
 * Business logic layer for notifications
 */

/**
 * Generic send notification method
 * @param {String} userId - Recipient user ID
 * @param {String} type - Notification type
 * @param {Object} notificationData - { title, body, imageUrl, data }
 * @returns {Object} - Result
 */
const send = async (userId, type, notificationData) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if we should send this notification
    const shouldSend = await _shouldSendNotification(user, type, notificationData.data);
    
    if (!shouldSend) {
      console.log(`ℹ️ Skipping notification for user ${userId} (preferences/muted)`);
      return { success: true, skipped: true, reason: 'User preferences' };
    }

    // Save to notification history
    await _saveToHistory(
      userId,
      type,
      notificationData.title,
      notificationData.body,
      notificationData.data,
      notificationData.imageUrl
    );

    // Send via FCM
    const result = await fcmService.sendToUser(
      userId,
      {
        title: notificationData.title,
        body: user.notificationSettings.showPreview ? notificationData.body : 'You have a new message',
        imageUrl: notificationData.imageUrl
      },
      notificationData.data
    );

    // Update badge count
    if (result.success && result.delivered > 0) {
      await _updateBadgeCount(userId, 'notifications', 1);
    }

    return result;
  } catch (error) {
    console.error('❌ Error in notification send:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send chat message notification
 * @param {String} recipientId - Recipient user ID
 * @param {String} senderId - Sender user ID
 * @param {Object} message - Message object
 * @returns {Object} - Result
 */
const sendChatMessage = async (recipientId, senderId, message) => {
  try {
    const sender = await User.findById(senderId);
    
    if (!sender) {
      return { success: false, error: 'Sender not found' };
    }

    // Get message preview (handle different message types)
    let messagePreview = '';
    if (message.text) {
      messagePreview = message.text;
    } else if (message.voiceMessageUrl) {
      messagePreview = '🎤 Voice message';
    } else if (message.imageUrl) {
      messagePreview = '📷 Photo';
    } else if (message.videoUrl) {
      messagePreview = '🎥 Video';
    } else {
      messagePreview = 'Sent a message';
    }

    const notification = templates.getChatMessageTemplate(
      sender.name,
      messagePreview,
      {
        senderId: senderId,
        conversationId: message.conversation?.toString() || '',
        messageId: message._id?.toString() || ''
      }
    );

    // Add sender's image if available
    if (sender.images && sender.images.length > 0) {
      notification.imageUrl = sender.images[0];
    }

    const result = await send(recipientId, 'chat_message', notification);

    // Update message badge count
    if (result.success && !result.skipped) {
      await _updateBadgeCount(recipientId, 'messages', 1);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending chat notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send moment like notification
 * @param {String} momentOwnerId - Moment owner user ID
 * @param {String} likerId - User who liked ID
 * @param {String} momentId - Moment ID
 * @returns {Object} - Result
 */
const sendMomentLike = async (momentOwnerId, likerId, momentId) => {
  try {
    const [liker, moment] = await Promise.all([
      User.findById(likerId),
      require('../models/Moment').findById(momentId)
    ]);

    if (!liker || !moment) {
      return { success: false, error: 'Liker or moment not found' };
    }

    const momentPreview = moment.text || moment.translation || 'your moment';

    const notification = templates.getMomentLikeTemplate(
      liker.name,
      momentPreview,
      {
        userId: likerId,
        momentId: momentId.toString()
      }
    );

    // Add liker's image
    if (liker.images && liker.images.length > 0) {
      notification.imageUrl = liker.images[0];
    }

    return await send(momentOwnerId, 'moment_like', notification);
  } catch (error) {
    console.error('❌ Error sending moment like notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send moment comment notification
 * @param {String} momentOwnerId - Moment owner user ID
 * @param {String} commenterId - Commenter user ID
 * @param {String} momentId - Moment ID
 * @param {Object} comment - Comment object
 * @returns {Object} - Result
 */
const sendMomentComment = async (momentOwnerId, commenterId, momentId, comment) => {
  try {
    const commenter = await User.findById(commenterId);

    if (!commenter) {
      return { success: false, error: 'Commenter not found' };
    }

    const commentText = comment.text || comment.comment || 'commented on your moment';

    const notification = templates.getMomentCommentTemplate(
      commenter.name,
      commentText,
      {
        userId: commenterId,
        momentId: momentId.toString(),
        commentId: comment._id?.toString() || ''
      }
    );

    // Add commenter's image
    if (commenter.images && commenter.images.length > 0) {
      notification.imageUrl = commenter.images[0];
    }

    return await send(momentOwnerId, 'moment_comment', notification);
  } catch (error) {
    console.error('❌ Error sending moment comment notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send friend request notification
 * @param {String} recipientId - Recipient user ID
 * @param {String} requesterId - Requester user ID
 * @returns {Object} - Result
 */
const sendFriendRequest = async (recipientId, requesterId) => {
  try {
    const requester = await User.findById(requesterId);

    if (!requester) {
      return { success: false, error: 'Requester not found' };
    }

    const notification = templates.getFriendRequestTemplate(
      requester.name,
      {
        userId: requesterId
      }
    );

    // Add requester's image
    if (requester.images && requester.images.length > 0) {
      notification.imageUrl = requester.images[0];
    }

    return await send(recipientId, 'friend_request', notification);
  } catch (error) {
    console.error('❌ Error sending friend request notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send profile visit notification (VIP feature)
 * @param {String} profileOwnerId - Profile owner user ID
 * @param {String} visitorId - Visitor user ID
 * @returns {Object} - Result
 */
const sendProfileVisit = async (profileOwnerId, visitorId) => {
  try {
    const visitor = await User.findById(visitorId);

    if (!visitor) {
      return { success: false, error: 'Visitor not found' };
    }

    const notification = templates.getProfileVisitTemplate(
      visitor.name,
      {
        userId: visitorId
      }
    );

    // Add visitor's image
    if (visitor.images && visitor.images.length > 0) {
      notification.imageUrl = visitor.images[0];
    }

    return await send(profileOwnerId, 'profile_visit', notification);
  } catch (error) {
    console.error('❌ Error sending profile visit notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if notification should be sent based on user preferences
 * @private
 * @param {Object} user - User document
 * @param {String} type - Notification type
 * @param {Object} data - Notification data
 * @returns {Boolean} - Whether to send
 */
const _shouldSendNotification = async (user, type, data = {}) => {
  // Check if notifications are globally enabled
  if (!user.notificationSettings.enabled) {
    return false;
  }

  // Check type-specific preferences
  switch (type) {
    case 'chat_message':
      if (!user.notificationSettings.chatMessages) {
        return false;
      }
      // Check if conversation is muted
      if (data.conversationId && user.notificationSettings.mutedChats.includes(data.conversationId)) {
        return false;
      }
      break;
    
    case 'moment_like':
    case 'moment_comment':
      if (!user.notificationSettings.moments) {
        return false;
      }
      break;
    
    case 'friend_request':
      if (!user.notificationSettings.friendRequests) {
        return false;
      }
      break;
    
    case 'profile_visit':
      if (!user.notificationSettings.profileVisits) {
        return false;
      }
      break;
    
    case 'system':
      if (!user.notificationSettings.marketing) {
        return false;
      }
      break;
  }

  return true;
};

/**
 * Update user's badge count
 * @private
 * @param {String} userId - User ID
 * @param {String} type - Badge type ('messages' or 'notifications')
 * @param {Number} increment - Amount to increment (can be negative)
 * @returns {Object} - Updated user
 */
const _updateBadgeCount = async (userId, type, increment = 1) => {
  try {
    const updateField = type === 'messages' ? 'badges.unreadMessages' : 'badges.unreadNotifications';
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { [updateField]: increment } },
      { new: true }
    );

    return user;
  } catch (error) {
    console.error('❌ Error updating badge count:', error);
    return null;
  }
};

/**
 * Save notification to history
 * @private
 * @param {String} userId - User ID
 * @param {String} type - Notification type
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Notification data
 * @param {String} imageUrl - Optional image URL
 * @returns {Object} - Created notification
 */
const _saveToHistory = async (userId, type, title, body, data = {}, imageUrl = null) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      imageUrl,
      data
    });

    return notification;
  } catch (error) {
    console.error('❌ Error saving notification history:', error);
    return null;
  }
};

module.exports = {
  send,
  sendChatMessage,
  sendMomentLike,
  sendMomentComment,
  sendFriendRequest,
  sendProfileVisit
};

