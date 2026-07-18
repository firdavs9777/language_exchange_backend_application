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
 * Returns true if the user has not opted out of `type` notifications.
 * Missing notificationPreferences = use defaults (all true).
 *
 * @param {Object} user - User document with notificationSettings populated
 * @param {string} type - One of: 'chat', 'wave', 'voiceRoomStart',
 *                        'scheduledRoomReminder', 'followerMoment',
 *                        'visitorAlert', 'matchAlert', 'reengagement'
 */
function shouldNotify(user, type) {
  if (!user) return false;
  const prefs = user.notificationPreferences;
  if (!prefs) return true;  // missing field = use defaults (all true)
  switch (type) {
    case 'reengagement':
      return user.notificationSettings?.marketing !== false;
    default:
      return prefs[type] !== false;
  }
}

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
    let historyRow = null;
    if (type !== 'chat_message') {
      historyRow = await _saveToHistory(
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

    // Update badge count (skip chat_message - uses unreadMessages badge instead).
    // Task 5 (Workstream E-core) — badge must only bump when the history row
    // actually persisted; otherwise the badge count drifts from the (empty)
    // in-app history whenever _saveToHistory silently swallows a
    // ValidationError (e.g. an enum miss).
    if (result.success && result.delivered > 0 && type !== 'chat_message' && historyRow) {
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
 * Send new-follower notification
 * Task 9 (Workstream E-core) — distinct from sendFriendRequest: a follow
 * used to route through sendFriendRequest, so users saw "New Friend Request"
 * for a plain follow. friend_request stays untouched for real friend
 * requests; this is the dedicated "X started following you" push.
 * @param {String} followedUserId - User being followed (recipient)
 * @param {String} followerId - User who did the following
 * @returns {Object} - Result
 */
const sendNewFollower = async (followedUserId, followerId) => {
  try {
    const follower = await User.findById(followerId);

    if (!follower) {
      return { success: false, error: 'Follower not found' };
    }

    const notification = templates.getNewFollowerTemplate(follower.name, {
      userId: followerId,
    });

    if (follower.images && follower.images.length > 0) {
      notification.imageUrl = follower.images[0];
    }

    return await send(followedUserId, 'new_follower', notification);
  } catch (error) {
    console.error('❌ Error sending new follower notification:', error);
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
    const Wave = require('../models/Wave');

    // Suppress the IMMEDIATE push if recipient received >3 waves in the last
    // 6 hours — this only limits real-time notification bursts, it does NOT
    // drop the wave: the Wave document itself is always created by the
    // caller (controllers/community.js) before this function runs, and it
    // stays isRead:false until the recipient actually views it. Task 11
    // (Workstream E-core, audit upgrade #4) — jobs/waveDailySummaryJob.js
    // runs daily (09:00 KST) and aggregates ALL isRead:false waves in the
    // lookback window regardless of whether their immediate push was
    // suppressed here, so a suppressed wave is picked up by the summary
    // instead of vanishing silently. Previously this comment said the
    // daily-summary cron was "future work" — it now exists and covers this.
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
    const recentWaveCount = await Wave.countDocuments({
      to: recipientId,
      createdAt: { $gte: sixHoursAgo }
    });
    if (recentWaveCount > 3) {
      console.log(`[wave] suppressing immediate push for ${recipientId} — ${recentWaveCount} waves in last 6h (daily summary will still cover it)`);
      return { success: true, skipped: true, reason: 'push suppressed (>3 waves in 6h); covered by daily summary' };
    }

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
 * Send story mention notification.
 * Structured like sendWave (fetch actor, build via template, delegate to
 * send() for the shared quiet-hours/frequency-cap/history/badge plumbing —
 * see fcmService.isCapped/recordSend keyed off config/notificationCaps.js).
 * Unlike sendWave, there's no bespoke recent-activity suppression here: a
 * story mention is a one-off per story, not a recurring signal like waves.
 * @param {String} recipientId - User who was mentioned
 * @param {String} senderId - User who created the story
 * @param {String} storyId - Story ID
 * @returns {Object} - Result
 */
const sendStoryMention = async (recipientId, senderId, storyId) => {
  try {
    const sender = await User.findById(senderId);

    if (!sender) {
      return { success: false, error: 'Sender not found' };
    }

    const notification = templates.getStoryMentionTemplate(sender.name, {
      userId: senderId,
      storyId: storyId,
    });

    // Add sender's image
    if (sender.images && sender.images.length > 0) {
      notification.imageUrl = sender.images[0];
    }

    return await send(recipientId, 'story_mention', notification);
  } catch (error) {
    console.error('❌ Error sending story mention notification:', error);
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
      // notification preferences gate
      if (!shouldNotify(user, 'chat')) return false;
      break;

    case 'moment_like':
      if (!user.notificationSettings.moments) {
        return false;
      }
      break;

    case 'moment_comment':
      if (!user.notificationSettings.moments) {
        return false;
      }
      // Step 16 — moment comments share the 'comment' preference toggle
      // with story comments + reply/reaction/mention.
      if (!shouldNotify(user, 'comment')) return false;
      break;

    case 'story_comment':
    case 'comment_reply':
    case 'comment_reaction':
    case 'comment_mention':
      // Step 16 — all comment-related notifications share the 'comment'
      // preference. story_comment lands in B4; the others were
      // pre-existing push types with no preference gate (silent send).
      if (!shouldNotify(user, 'comment')) return false;
      break;

    case 'friend_request':
      if (!user.notificationSettings.friendRequests) {
        return false;
      }
      // Step 16 — additional gate on the newFollower preference (the
      // user-facing toggle for "someone followed you" notifications).
      if (!shouldNotify(user, 'newFollower')) return false;
      break;

    case 'new_follower':
      // Task 9 (Workstream E-core) — a follow now sends its own distinct
      // "X started following you" push instead of masquerading as a
      // friend_request. Gated on the same newFollower preference used
      // above for friend_request (friend_request stays untouched for real
      // friend requests).
      if (!shouldNotify(user, 'newFollower')) return false;
      break;

    case 'vip_renewal_warning':
      // Step 16 — VIP renewal warning push (wired in B3).
      if (!shouldNotify(user, 'vipRenewalWarning')) return false;
      break;

    case 'profile_visit':
      if (!user.notificationSettings.profileVisits) {
        return false;
      }
      // notification preferences gate
      if (!shouldNotify(user, 'visitorAlert')) return false;
      break;

    case 'follower_moment':
      if (!user.notificationSettings.followerMoments) {
        return false;
      }
      // notification preferences gate
      if (!shouldNotify(user, 'followerMoment')) return false;
      break;

    case 'system':
      if (!user.notificationSettings.marketing) {
        return false;
      }
      break;

    case 'srs_review':
      // Task 2 (Workstream E-core) — vocabulary/SRS review reminders used to
      // send as type 'system' and were gated on notificationSettings.marketing,
      // so turning off marketing silently killed vocab reminders the user
      // explicitly enabled. Gate on the dedicated preference instead.
      if (!user.notificationSettings.vocabularyReviewReminders) {
        return false;
      }
      break;

    case 'streak_reminder':
      // Task 2/3 (Workstream E-core) — streak reminders used to bypass
      // gating entirely (raw fcmService.sendToUser call). Now routed through
      // send() and gated on notificationSettings.streakReminders.
      if (!user.notificationSettings.streakReminders) {
        return false;
      }
      break;

    case 'wave':
      // notification preferences gate — mutual waves use matchAlert pref
      if (data.isMutual === 'true') {
        if (!shouldNotify(user, 'matchAlert')) return false;
      } else {
        if (!shouldNotify(user, 'wave')) return false;
      }
      break;

    case 'voice_room_start':
      // notification preferences gate
      if (!shouldNotify(user, 'voiceRoomStart')) return false;
      break;

    case 'scheduled_room_reminder':
      // notification preferences gate
      if (!shouldNotify(user, 'scheduledRoomReminder')) return false;
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

/**
 * Send notification when someone @mentions a user in a language-room
 * ("hub") message — Workstream D, Task 7. Mirrors sendCommentMention's
 * shape. Deliberately mention-only: a plain (non-mention) hub message must
 * NEVER call this — see socket/roomHandler.js's room:message handler, which
 * only invokes this per mentioned user, never for the broadcast as a whole
 * (a 240-member hub must not push on every message).
 *
 * @param {String} mentionedUserId
 * @param {String} senderId - the message author
 * @param {String} roomId - hub Conversation _id
 * @param {String} messageText
 * @returns {Object} - Result
 */
const sendRoomMention = async (mentionedUserId, senderId, roomId, messageText) => {
  try {
    const [sender, mentionedUser] = await Promise.all([
      User.findById(senderId),
      User.findById(mentionedUserId),
    ]);
    if (!sender) return { success: false, error: 'Sender not found' };

    const snippet = messageText && messageText.length > 100
      ? `${messageText.substring(0, 100)}...`
      : (messageText || '');

    const { title, body } = templateService.render(
      'room_mention',
      mentionedUser?.preferredLocale || 'en',
      { actorName: sender.name, snippet },
    );

    const notification = {
      title,
      body,
      data: { type: 'room_mention', userId: senderId, roomId: roomId.toString() }
    };

    if (sender.images && sender.images.length > 0) {
      notification.imageUrl = sender.images[0];
    }

    return await send(mentionedUserId, 'room_mention', notification);
  } catch (error) {
    console.error('Error sending room mention notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a new-message push for a user-created "topic" room (Task 15 follow-up
 * — notifications). Mirrors sendChatMessage's shape/payload keys (same
 * templateService/fcmService plumbing via send()) but scoped to a room
 * instead of a 1:1 conversation. The caller (socket/roomHandler.js) is
 * responsible for only invoking this for `roomType:'topic'` rooms (NEVER the
 * big seeded hubs — see sendRoomMention above for why) and for already
 * filtering out the sender, members currently active in the room, and muted
 * members before calling this per recipient.
 *
 * @param {String} recipientId - a room participant (not the sender)
 * @param {String} senderId - the message author
 * @param {Object} room - plain object with at least `_id`, `title`
 * @param {String} messageText
 * @returns {Object} - Result
 */
const sendRoomMessage = async (recipientId, senderId, room, messageText) => {
  try {
    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId),
    ]);
    if (!sender) return { success: false, error: 'Sender not found' };

    const snippet = messageText && messageText.length > 100
      ? `${messageText.substring(0, 100)}...`
      : (messageText || '');

    const { title, body } = templateService.render(
      'room_message',
      recipient?.preferredLocale || 'en',
      { actorName: sender.name, roomName: room?.title || 'a room', snippet },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'room_message',
        userId: String(senderId),
        roomId: String(room._id),
      }
    };

    if (sender.images && sender.images.length > 0) {
      notification.imageUrl = sender.images[0];
    }

    return await send(recipientId, 'room_message', notification);
  } catch (error) {
    console.error('Error sending room message notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify a topic room's owner that someone joined (Task 15 follow-up —
 * notifications). Only called for `roomType:'topic'` rooms and only when
 * the joiner isn't the owner themself; respects the owner's per-room mute
 * the same way sendRoomMessage does (caller checks lib/roomMessageNotify.js's
 * isMemberMuted before invoking this).
 *
 * @param {String} ownerId - the room's owner
 * @param {String} joinerId - the user who just joined
 * @param {Object} room - plain object with at least `_id`, `title`
 * @returns {Object} - Result
 */
const sendRoomJoin = async (ownerId, joinerId, room) => {
  try {
    const [joiner, owner] = await Promise.all([
      User.findById(joinerId),
      User.findById(ownerId),
    ]);
    if (!joiner) return { success: false, error: 'Joiner not found' };

    const { title, body } = templateService.render(
      'room_join',
      owner?.preferredLocale || 'en',
      { actorName: joiner.name, roomName: room?.title || 'a room' },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'room_join',
        userId: String(joinerId),
        roomId: String(room._id),
      }
    };

    if (joiner.images && joiner.images.length > 0) {
      notification.imageUrl = joiner.images[0];
    }

    return await send(ownerId, 'room_join', notification);
  } catch (error) {
    console.error('Error sending room join notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify a topic room's owner that a (possibly previously-banned) user has
 * requested to join (Task 16 — moderation). Only meaningful for
 * `roomType:'topic'` rooms (hubs have no ban/request concept — the caller,
 * controllers/rooms.js, gates on that). Mirrors sendRoomJoin's shape/mute
 * check but is a distinct notification type/template — unlike an actual
 * join, this requires the owner to act (approve/deny), so it must not be
 * confused with the "someone just joined" push.
 *
 * @param {String} ownerId - the room's owner
 * @param {String} requesterId - the user asking to join
 * @param {Object} room - plain object with at least `_id`, `title`
 * @returns {Object} - Result
 */
const sendRoomJoinRequest = async (ownerId, requesterId, room) => {
  try {
    const [requester, owner] = await Promise.all([
      User.findById(requesterId),
      User.findById(ownerId),
    ]);
    if (!requester) return { success: false, error: 'Requester not found' };

    const { title, body } = templateService.render(
      'room_join_request',
      owner?.preferredLocale || 'en',
      { actorName: requester.name, roomName: room?.title || 'a room' },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'room_join_request',
        userId: String(requesterId),
        roomId: String(room._id),
      }
    };

    if (requester.images && requester.images.length > 0) {
      notification.imageUrl = requester.images[0];
    }

    return await send(ownerId, 'room_join_request', notification);
  } catch (error) {
    console.error('Error sending room join-request notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify a user that their join request was approved (Task 16 —
 * moderation). Sent to the requester, never the owner.
 *
 * @param {String} requesterId - the user who requested to join
 * @param {Object} room - plain object with at least `_id`, `title`
 * @returns {Object} - Result
 */
const sendRoomJoinApproved = async (requesterId, room) => {
  try {
    const requester = await User.findById(requesterId);
    if (!requester) return { success: false, error: 'Requester not found' };

    const { title, body } = templateService.render(
      'room_join_approved',
      requester?.preferredLocale || 'en',
      { roomName: room?.title || 'a room' },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'room_join_approved',
        roomId: String(room._id),
      }
    };

    return await send(requesterId, 'room_join_approved', notification);
  } catch (error) {
    console.error('Error sending room join-approved notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify a user that their join request was denied (Task 16 — moderation).
 * Denial does NOT ban — this is purely informational so the requester
 * isn't left wondering. Optional per spec; kept for UX symmetry with
 * sendRoomJoinApproved, at negligible extra cost.
 *
 * @param {String} requesterId - the user who requested to join
 * @param {Object} room - plain object with at least `_id`, `title`
 * @returns {Object} - Result
 */
const sendRoomJoinDenied = async (requesterId, room) => {
  try {
    const requester = await User.findById(requesterId);
    if (!requester) return { success: false, error: 'Requester not found' };

    const { title, body } = templateService.render(
      'room_join_denied',
      requester?.preferredLocale || 'en',
      { roomName: room?.title || 'a room' },
    );

    const notification = {
      title,
      body,
      data: {
        type: 'room_join_denied',
        roomId: String(room._id),
      }
    };

    return await send(requesterId, 'room_join_denied', notification);
  } catch (error) {
    console.error('Error sending room join-denied notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify host + RSVPs when a scheduled room flips to active.
 * @param {string} userId - recipient user ID
 * @param {string|ObjectId} roomId
 * @param {string} title - room title
 */
const sendScheduledRoomStarted = async (userId, roomId, title) => {
  // fcmTokens (plural array) is the real schema field — the old singular
  // `fcmToken` select never matched anything, so this early-return fired for
  // every user and these pushes silently never sent (E-core audit fix).
  const user = await User.findById(userId).select('fcmTokens notificationPreferences');
  if (!user?.fcmTokens?.some((t) => t.active)) return;
  if (!shouldNotify(user, 'voiceRoomStart')) return;

  await fcmService.sendToUser(
    user._id,
    {
      title: 'Room starting now',
      body: `${title} is starting now`,
    },
    {
      type: 'voice_room_start',
      roomId: String(roomId),
      route: `/voicerooms/${roomId}`,
    }
  );
};

/**
 * Remind RSVPs of an upcoming scheduled room.
 * @param {string} userId - recipient user ID
 * @param {string|ObjectId} roomId
 * @param {string} title - room title
 * @param {'1h'|'15min'} when - reminder window label
 */
const sendScheduledRoomReminder = async (userId, roomId, title, when) => {
  // Same fcmTokens-array fix as sendScheduledRoomStarted (E-core audit).
  const user = await User.findById(userId).select('fcmTokens notificationPreferences');
  if (!user?.fcmTokens?.some((t) => t.active)) return;
  if (!shouldNotify(user, 'scheduledRoomReminder')) return;

  const body = when === '1h'
    ? `${title} starts in 1 hour`
    : `${title} starts in 15 minutes`;

  await fcmService.sendToUser(
    user._id,
    {
      title: 'Upcoming room',
      body,
    },
    {
      type: 'scheduled_room_reminder',
      roomId: String(roomId),
      when,
      route: `/voicerooms/${roomId}`,
    }
  );
};

/**
 * Send VIP renewal warning push notification.
 * Step 16 — replaces the broken sendPushNotification stub in
 * jobs/subscriptionExpiryJob.js. Fires at 7 / 3 / 1 days before
 * vipSubscription.endDate (dedup via vipSubscription.warnings flags
 * managed by the job itself).
 *
 * @param {String} userId — recipient (the VIP user)
 * @param {Number} daysLeft — 7 | 3 | 1
 * @returns {Object} send() result
 */
const sendVipRenewalWarning = async (userId, daysLeft) => {
  try {
    const title = 'VIP Subscription Expiring Soon';
    const body = daysLeft === 1
      ? 'Your VIP subscription expires tomorrow! Renew now to keep unlimited tutor chips, ads-off, and more.'
      : `Your VIP subscription expires in ${daysLeft} days. Renew anytime to keep your benefits.`;

    const notification = {
      title,
      body,
      data: {
        type: 'vip_renewal_warning',
        daysLeft: String(daysLeft),
        screen: 'vip',
      },
    };

    return await send(userId, 'vip_renewal_warning', notification);
  } catch (error) {
    console.error('❌ Error sending VIP renewal warning:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  shouldNotify,
  _shouldSendNotification,
  send,
  sendChatMessage,
  sendMomentLike,
  sendMomentComment,
  sendFriendRequest,
  sendNewFollower,
  sendProfileVisit,
  sendFollowerMoment,
  sendWave,
  sendStoryMention,
  sendCommentReply,
  sendCommentReaction,
  sendCommentMention,
  sendRoomMention,
  sendRoomMessage,
  sendRoomJoin,
  sendRoomJoinRequest,
  sendRoomJoinApproved,
  sendRoomJoinDenied,
  sendScheduledRoomStarted,
  sendScheduledRoomReminder,
  sendVipRenewalWarning,
};

