/**
 * Notification Templates
 * Provides consistent notification messages across the app
 */

/**
 * Chat message notification template
 * @param {String} senderName - Name of the message sender
 * @param {String} messagePreview - Preview of the message (first 100 chars)
 * @param {Object} messageData - Additional message data
 * @returns {Object} - { title, body, data }
 */
const getChatMessageTemplate = (senderName, messagePreview, messageData = {}) => {
  return {
    title: senderName,
    body: messagePreview.length > 100 ? `${messagePreview.substring(0, 100)}...` : messagePreview,
    data: {
      type: 'chat_message',
      senderId: messageData.senderId || '',
      conversationId: messageData.conversationId || '',
      messageId: messageData.messageId || '',
      screen: 'chat'
    }
  };
};

/**
 * Moment like notification template
 * @param {String} userName - Name of the user who liked
 * @param {String} momentPreview - Preview text of the moment
 * @param {Object} momentData - Additional moment data
 * @returns {Object} - { title, body, data }
 */
const getMomentLikeTemplate = (userName, momentPreview, momentData = {}) => {
  return {
    title: 'New Like',
    body: `${userName} liked your moment: "${momentPreview.substring(0, 50)}${momentPreview.length > 50 ? '...' : ''}"`,
    data: {
      type: 'moment_like',
      userId: momentData.userId || '',
      momentId: momentData.momentId || '',
      screen: 'moment_detail'
    }
  };
};

/**
 * Moment comment notification template
 * @param {String} userName - Name of the commenter
 * @param {String} commentText - Comment text
 * @param {Object} momentData - Additional moment data
 * @returns {Object} - { title, body, data }
 */
const getMomentCommentTemplate = (userName, commentText, momentData = {}) => {
  return {
    title: 'New Comment',
    body: `${userName} commented: "${commentText.substring(0, 80)}${commentText.length > 80 ? '...' : ''}"`,
    data: {
      type: 'moment_comment',
      userId: momentData.userId || '',
      momentId: momentData.momentId || '',
      commentId: momentData.commentId || '',
      screen: 'moment_detail'
    }
  };
};

/**
 * Friend request notification template
 * @param {String} userName - Name of the user sending request
 * @param {Object} userData - Additional user data
 * @returns {Object} - { title, body, data }
 */
const getFriendRequestTemplate = (userName, userData = {}) => {
  return {
    title: 'New Friend Request',
    body: `${userName} wants to connect with you`,
    data: {
      type: 'friend_request',
      userId: userData.userId || '',
      screen: 'profile'
    }
  };
};

/**
 * Profile visit notification template (VIP feature)
 * @param {String} visitorName - Name of the visitor
 * @param {Object} visitorData - Additional visitor data
 * @returns {Object} - { title, body, data }
 */
const getProfileVisitTemplate = (visitorName, visitorData = {}) => {
  return {
    title: 'Profile Visit',
    body: `${visitorName} viewed your profile`,
    data: {
      type: 'profile_visit',
      userId: visitorData.userId || '',
      screen: 'profile'
    }
  };
};

/**
 * System notification template
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} customData - Custom data
 * @returns {Object} - { title, body, data }
 */
const getSystemTemplate = (title, body, customData = {}) => {
  return {
    title,
    body,
    data: {
      type: 'system',
      ...customData
    }
  };
};

/**
 * Re-engagement notification template
 * @returns {Object} - { title, body, data }
 */
const getReengagementTemplate = () => {
  const messages = [
    {
      title: 'We miss you! 💛',
      body: 'Your friends are waiting for you on BanaTalk'
    },
    {
      title: 'Come back to BanaTalk! 🌟',
      body: 'New moments and messages are waiting for you'
    },
    {
      title: 'Your language partner is waiting! 🗣️',
      body: 'Continue your language learning journey on BanaTalk'
    }
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    ...randomMessage,
    data: {
      type: 'system',
      screen: 'home'
    }
  };
};

/**
 * VIP subscription expiring template
 * @param {Number} daysLeft - Days until expiration
 * @returns {Object} - { title, body, data }
 */
const getSubscriptionExpiringTemplate = (daysLeft) => {
  return {
    title: 'VIP Subscription Expiring',
    body: `Your VIP subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Renew now to keep your benefits!`,
    data: {
      type: 'system',
      screen: 'subscription',
      daysLeft: daysLeft.toString()
    }
  };
};

/**
 * Follower new moment notification template
 * @param {String} userName - Name of the user who posted
 * @param {String} momentPreview - Preview text of the moment
 * @param {Object} momentData - Additional moment data
 * @returns {Object} - { title, body, data }
 */
const getFollowerMomentTemplate = (userName, momentPreview, momentData = {}) => {
  const previewText = momentPreview 
    ? `"${momentPreview.substring(0, 60)}${momentPreview.length > 60 ? '...' : ''}"`
    : 'Check it out!';
  
  return {
    title: `${userName} posted a moment`,
    body: previewText,
    data: {
      type: 'follower_moment',
      userId: momentData.userId || '',
      momentId: momentData.momentId || '',
      screen: 'moment_detail'
    }
  };
};

module.exports = {
  getChatMessageTemplate,
  getMomentLikeTemplate,
  getMomentCommentTemplate,
  getFriendRequestTemplate,
  getProfileVisitTemplate,
  getSystemTemplate,
  getReengagementTemplate,
  getSubscriptionExpiringTemplate,
  getFollowerMomentTemplate
};

