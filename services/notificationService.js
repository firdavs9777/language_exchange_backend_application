const User = require('../models/User');
const Notification = require('../models/Notification');
const fcmService = require('./fcmService');
const templates = require('../utils/notificationTemplates');
const templateService = require('./notificationTemplateService');
const bundlingService = require('./notificationBundlingService');

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

    // Save to notification history (skip chat_message - shown in chat list)
    if (type !== 'chat_message') {
      await _saveToHistory(
        userId,
        type,
        notificationData.title,
        notificationData.body,
        notificationData.data,
        notificationData.imageUrl
      );
    }

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

    // Update badge count (skip chat_message - uses unreadMessages badge instead)
    if (result.success && result.delivered > 0 && type !== 'chat_message') {
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
    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId),
    ]);

    if (!sender) {
      return { success: false, error: 'Sender not found' };
    }

    // Get message preview (handle different message types)
    let messagePreview = '';
    if (message.messageType === 'gif') {
      messagePreview = '🎬 GIF';
    } else if (message.messageType === 'sticker') {
      messagePreview = '🏷️ Sticker';
    } else if (message.text) {
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

    const truncatedPreview = messagePreview.length > 100
      ? `${messagePreview.substring(0, 100)}...`
      : messagePreview;

    const { title, body } = templateService.render(
      'chat_message',
      recipient?.preferredLocale || 'en',
      { senderName: sender.name, message: truncatedPreview },
    );

    // Note: showPreview override (body -> "You have a new message") is handled
    // centrally in send() below. Kept in English for C1 — separate concern to localize.
    const notification = {
      title,
      body,
      data: {
        type: 'chat_message',
        senderId: senderId,
        conversationId: message.conversation?.toString() || '',
        messageId: message._id?.toString() || '',
        screen: 'chat',
      },
    };

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
    const [liker, moment, owner] = await Promise.all([
      User.findById(likerId),
      require('../models/Moment').findById(momentId),
      User.findById(momentOwnerId),
    ]);

    if (!liker || !moment || !owner) {
      return { success: false, error: 'Liker, moment, or owner not found' };
    }

    await bundlingService.collect(
      String(momentOwnerId),
      'moment_like',
      {
        momentId: String(momentId),
        actorId: String(likerId),
        actorName: liker.name,
        likerImage: liker.images && liker.images.length > 0 ? liker.images[0] : null,
      },
      async (bundle) => {
        const tplKey = bundle.count > 1 ? 'moment_like_bundle' : 'moment_like_single';
        const { title, body } = templateService.render(
          tplKey,
          owner.preferredLocale || 'en',
          {
            actorName: bundle.vars.actorName,
            othersCount: Math.max(bundle.count - 1, 0),
          },
        );

        const notification = {
          title,
          body,
          data: {
            type: 'moment_like',
            userId: likerId,
            momentId: String(momentId),
            screen: 'moment_detail',
            bundleSize: bundle.count,
            bundleActors: bundle.actorIds,
          },
        };

        if (bundle.vars.likerImage) {
          notification.imageUrl = bundle.vars.likerImage;
        }

        await send(String(momentOwnerId), 'moment_like', notification);
      },
    );

    return { success: true, bundled: true };
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
    const [commenter, owner] = await Promise.all([
      User.findById(commenterId),
      User.findById(momentOwnerId),
    ]);

    if (!commenter) {
      return { success: false, error: 'Commenter not found' };
    }

    const commentText = comment.text || comment.comment || 'commented on your moment';
    const snippet = commentText.length > 80
      ? `${commentText.substring(0, 80)}...`
      : commentText;

    const { title, body } = templateService.render(
      'moment_comment',
      owner?.preferredLocale || 'en',
      { actorName: commenter.name, snippet },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'moment_comment',
        userId: commenterId,
        momentId: momentId.toString(),
        commentId: comment._id?.toString() || '',
        screen: 'moment_detail',
      },
    };

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
    const [requester, recipient] = await Promise.all([
      User.findById(requesterId),
      User.findById(recipientId),
    ]);

    if (!requester || !recipient) {
      return { success: false, error: 'Requester or recipient not found' };
    }

    await bundlingService.collect(
      String(recipientId),
      'friend_request',
      {
        actorId: String(requesterId),
        actorName: requester.name,
        requesterImage: requester.images && requester.images.length > 0 ? requester.images[0] : null,
      },
      async (bundle) => {
        const tplKey = bundle.count > 1 ? 'friend_request_bundle' : 'friend_request_single';
        const { title, body } = templateService.render(
          tplKey,
          recipient.preferredLocale || 'en',
          {
            actorName: bundle.vars.actorName,
            count: bundle.count,
          },
        );

        const notification = {
          title,
          body,
          data: {
            type: 'friend_request',
            userId: requesterId,
            screen: 'profile',
            bundleSize: bundle.count,
            bundleActors: bundle.actorIds,
          },
        };

        if (bundle.vars.requesterImage) {
          notification.imageUrl = bundle.vars.requesterImage;
        }

        await send(String(recipientId), 'friend_request', notification);
      },
    );

    return { success: true, bundled: true };
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
    const [visitor, profileOwner] = await Promise.all([
      User.findById(visitorId),
      User.findById(profileOwnerId),
    ]);

    if (!visitor || !profileOwner) {
      return { success: false, error: 'Visitor or profile owner not found' };
    }

    await bundlingService.collect(
      String(profileOwnerId),
      'profile_visit',
      {
        actorId: String(visitorId),
        actorName: visitor.name,
        visitorImage: visitor.images && visitor.images.length > 0 ? visitor.images[0] : null,
      },
      async (bundle) => {
        const tplKey = bundle.count > 1 ? 'profile_visit_bundle' : 'profile_visit_single';
        const { title, body } = templateService.render(
          tplKey,
          profileOwner.preferredLocale || 'en',
          {
            actorName: bundle.vars.actorName,
            count: bundle.count,
          },
        );

        const notification = {
          title,
          body,
          data: {
            type: 'profile_visit',
            userId: visitorId,
            screen: 'profile',
            bundleSize: bundle.count,
            bundleActors: bundle.actorIds,
          },
        };

        if (bundle.vars.visitorImage) {
          notification.imageUrl = bundle.vars.visitorImage;
        }

        await send(String(profileOwnerId), 'profile_visit', notification);
      },
    );

    return { success: true, bundled: true };
  } catch (error) {
    console.error('❌ Error sending profile visit notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send wave notification
 * @param {String} recipientId - User receiving the wave
 * @param {String} waverId - User who waved
 * @param {String} waveId - Wave ID
 * @param {Boolean} isMutual - Whether this is a mutual wave
 * @returns {Object} - Result
 */
const sendWave = async (recipientId, waverId, waveId, isMutual = false) => {
  try {
    const waver = await User.findById(waverId);

    if (!waver) {
      return { success: false, error: 'Waver not found' };
    }

    const notification = templates.getWaveTemplate(
      waver.name,
      isMutual,
      {
        userId: waverId,
        waveId: waveId
      }
    );

    // Add waver's image
    if (waver.images && waver.images.length > 0) {
      notification.imageUrl = waver.images[0];
    }

    return await send(recipientId, 'wave', notification);
  } catch (error) {
    console.error('❌ Error sending wave notification:', error);
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
    
    case 'follower_moment':
      if (!user.notificationSettings.followerMoments) {
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
      data,
      bundleSize: data.bundleSize || 1,
      bundleActors: Array.isArray(data.bundleActors) ? data.bundleActors : [],
    });

    return notification;
  } catch (error) {
    console.error('❌ Error saving notification history:', error);
    return null;
  }
};

/**
 * Send notification to followers when user posts a moment
 * @param {String} momentAuthorId - ID of user who posted the moment
 * @param {String} momentId - Moment ID
 * @param {String} momentText - Moment text content
 * @returns {Object} - Result with count of notifications sent
 */
const sendFollowerMoment = async (momentAuthorId, momentId, momentText) => {
  try {
    const author = await User.findById(momentAuthorId).populate('followers');
    
    if (!author || !author.followers || author.followers.length === 0) {
      console.log(`ℹ️ No followers to notify for user ${momentAuthorId}`);
      return { success: true, notified: 0 };
    }

    const momentPreview = momentText || '';
    let sentCount = 0;
    let failedCount = 0;

    // Send notification to each follower
    const notificationPromises = author.followers.map(async (follower) => {
      try {
        // Skip if follower is the author (shouldn't happen but just in case)
        if (follower._id.toString() === momentAuthorId.toString()) {
          return;
        }

        const followerLocale = follower.preferredLocale || 'en';
        const authorImage = author.images && author.images.length > 0 ? author.images[0] : null;

        await bundlingService.collect(
          String(follower._id),
          'follower_moment',
          {
            momentId: String(momentId),
            actorId: String(momentAuthorId),
            actorName: author.name,
            authorImage,
          },
          async (bundle) => {
            const tplKey = bundle.count > 1 ? 'follower_moment_bundle' : 'follower_moment_single';
            const { title, body } = templateService.render(
              tplKey,
              followerLocale,
              {
                actorName: bundle.vars.actorName,
                othersCount: Math.max(bundle.count - 1, 0),
              },
            );

            const notification = {
              title,
              body,
              data: {
                type: 'follower_moment',
                userId: momentAuthorId,
                momentId: String(momentId),
                screen: 'moment_detail',
                bundleSize: bundle.count,
                bundleActors: bundle.actorIds,
              },
            };

            if (bundle.vars.authorImage) {
              notification.imageUrl = bundle.vars.authorImage;
            }

            await send(String(follower._id), 'follower_moment', notification);
          },
        );

        sentCount++;
      } catch (error) {
        console.error(`❌ Error sending follower moment notification to ${follower._id}:`, error);
        failedCount++;
      }
    });

    await Promise.all(notificationPromises);

    console.log(`✅ Sent ${sentCount} follower moment notifications (${failedCount} failed)`);

    return {
      success: true,
      notified: sentCount,
      failed: failedCount
    };
  } catch (error) {
    console.error('❌ Error sending follower moment notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when someone replies to a comment
 */
const sendCommentReply = async (parentAuthorId, replierId, momentId, replyText) => {
  try {
    const [replier, parentAuthor] = await Promise.all([
      User.findById(replierId),
      User.findById(parentAuthorId),
    ]);
    if (!replier) return { success: false, error: 'Replier not found' };

    const snippet = replyText.length > 100
      ? `${replyText.substring(0, 100)}...`
      : replyText;

    const { title, body } = templateService.render(
      'comment_reply',
      parentAuthor?.preferredLocale || 'en',
      { actorName: replier.name, snippet },
    );

    const notification = {
      title,
      body,
      data: { type: 'comment_reply', userId: replierId, momentId: momentId.toString() }
    };

    if (replier.images && replier.images.length > 0) {
      notification.imageUrl = replier.images[0];
    }

    return await send(parentAuthorId, 'comment_reply', notification);
  } catch (error) {
    console.error('Error sending comment reply notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when someone reacts to a comment
 */
const sendCommentReaction = async (commentAuthorId, reactorId, momentId, emoji) => {
  try {
    const [reactor, commentAuthor] = await Promise.all([
      User.findById(reactorId),
      User.findById(commentAuthorId),
    ]);
    if (!reactor) return { success: false, error: 'Reactor not found' };

    const { title, body } = templateService.render(
      'comment_reaction',
      commentAuthor?.preferredLocale || 'en',
      { emoji, actorName: reactor.name },
    );

    const notification = {
      title,
      body,
      data: { type: 'comment_reaction', userId: reactorId, momentId: momentId.toString() }
    };

    if (reactor.images && reactor.images.length > 0) {
      notification.imageUrl = reactor.images[0];
    }

    return await send(commentAuthorId, 'comment_reaction', notification);
  } catch (error) {
    console.error('Error sending comment reaction notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when someone mentions a user in a comment
 */
const sendCommentMention = async (mentionedUserId, mentionerId, momentId, commentText) => {
  try {
    const [mentioner, mentionedUser] = await Promise.all([
      User.findById(mentionerId),
      User.findById(mentionedUserId),
    ]);
    if (!mentioner) return { success: false, error: 'Mentioner not found' };

    const snippet = commentText.length > 100
      ? `${commentText.substring(0, 100)}...`
      : commentText;

    const { title, body } = templateService.render(
      'comment_mention',
      mentionedUser?.preferredLocale || 'en',
      { actorName: mentioner.name, snippet },
    );

    const notification = {
      title,
      body,
      data: { type: 'comment_mention', userId: mentionerId, momentId: momentId.toString() }
    };

    if (mentioner.images && mentioner.images.length > 0) {
      notification.imageUrl = mentioner.images[0];
    }

    return await send(mentionedUserId, 'comment_mention', notification);
  } catch (error) {
    console.error('Error sending comment mention notification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  send,
  sendChatMessage,
  sendMomentLike,
  sendMomentComment,
  sendFriendRequest,
  sendProfileVisit,
  sendFollowerMoment,
  sendWave,
  sendCommentReply,
  sendCommentReaction,
  sendCommentMention
};

