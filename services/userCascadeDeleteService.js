/**
 * User Cascade Delete Service
 *
 * Handles comprehensive deletion of all user-related data when a user deletes their account.
 * Deletes: moments, messages, conversations, comments, stories, calls, challenges, notifications, etc.
 */

const User = require('../models/User');
const Moment = require('../models/Moment');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Comment = require('../models/Comment');
const Story = require('../models/Story');
const Notification = require('../models/Notification');
const Call = require('../models/Call');
const Challenge = require('../models/Challenge');
const Report = require('../models/Report');
const VoiceRoom = require('../models/VoiceRoom');
const Poll = require('../models/Poll');
const UserInteraction = require('../models/UserInteraction');
const ProfileVisit = require('../models/ProfileVisit');
const AIConversation = require('../models/AIConversation');
const UserAchievement = require('../models/UserAchievement');
const UserStudyPlan = require('../models/UserStudyPlan');
const LearningProgress = require('../models/LearningProgress');
const ConversationActivity = require('../models/ConversationActivity');
const AISuggestedFriends = require('../models/AISuggestedFriends');

class UserCascadeDeleteService {
  /**
   * Delete all data associated with a user
   * @param {String} userId - User ID to delete
   * @returns {Object} Deletion statistics
   */
  async deleteUserAndAllData(userId) {
    const stats = {
      user: 0,
      moments: 0,
      messages: 0,
      conversations: 0,
      comments: 0,
      stories: 0,
      notifications: 0,
      calls: 0,
      challenges: 0,
      reports: 0,
      voiceRooms: 0,
      polls: 0,
      interactions: 0,
      profileVisits: 0,
      aiConversations: 0,
      achievements: 0,
      studyPlans: 0,
      learningProgress: 0,
      conversationActivities: 0,
      otherReferences: 0
    };

    try {
      // 1. Delete user's moments
      const momentResult = await Moment.deleteMany({ user: userId });
      stats.moments = momentResult.deletedCount;

      // 2. Delete user's messages
      const messageResult = await Message.deleteMany({ sender: userId });
      stats.messages = messageResult.deletedCount;

      // 3. Delete conversations where user is a participant
      const conversationResult = await Conversation.deleteMany({
        participants: { $in: [userId] }
      });
      stats.conversations = conversationResult.deletedCount;

      // 4. Delete comments made by user
      const commentResult = await Comment.deleteMany({ author: userId });
      stats.comments = commentResult.deletedCount;

      // 5. Delete user's stories
      const storyResult = await Story.deleteMany({ user: userId });
      stats.stories = storyResult.deletedCount;

      // 6. Delete notifications sent to user
      const notificationResult = await Notification.deleteMany({ recipient: userId });
      stats.notifications = notificationResult.deletedCount;

      // 7. Delete calls involving user
      const callResult = await Call.deleteMany({
        $or: [
          { initiator: userId },
          { receiver: userId }
        ]
      });
      stats.calls = callResult.deletedCount;

      // 8. Delete challenges created by user
      const challengeResult = await Challenge.deleteMany({ createdBy: userId });
      stats.challenges = challengeResult.deletedCount;

      // 9. Delete reports made by user
      const reportResult = await Report.deleteMany({ reportedBy: userId });
      stats.reports = reportResult.deletedCount;

      // 10. Delete voice rooms created by user
      if (VoiceRoom) {
        const voiceRoomResult = await VoiceRoom.deleteMany({ host: userId });
        stats.voiceRooms = voiceRoomResult.deletedCount;
      }

      // 11. Delete polls created by user
      if (Poll) {
        const pollResult = await Poll.deleteMany({ createdBy: userId });
        stats.polls = pollResult.deletedCount;
      }

      // 12. Delete user interactions
      if (UserInteraction) {
        const interactionResult = await UserInteraction.deleteMany({
          $or: [
            { initiatingUser: userId },
            { targetUser: userId }
          ]
        });
        stats.interactions = interactionResult.deletedCount;
      }

      // 13. Delete profile visits by user
      if (ProfileVisit) {
        const visitResult = await ProfileVisit.deleteMany({ visitor: userId });
        stats.profileVisits = visitResult.deletedCount;
      }

      // 14. Delete AI conversations
      if (AIConversation) {
        const aiConvResult = await AIConversation.deleteMany({ user: userId });
        stats.aiConversations = aiConvResult.deletedCount;
      }

      // 15. Delete user achievements
      if (UserAchievement) {
        const achieveResult = await UserAchievement.deleteMany({ user: userId });
        stats.achievements = achieveResult.deletedCount;
      }

      // 16. Delete study plans
      if (UserStudyPlan) {
        const studyResult = await UserStudyPlan.deleteMany({ user: userId });
        stats.studyPlans = studyResult.deletedCount;
      }

      // 17. Delete learning progress
      if (LearningProgress) {
        const progressResult = await LearningProgress.deleteMany({ user: userId });
        stats.learningProgress = progressResult.deletedCount;
      }

      // 18. Delete conversation activities
      if (ConversationActivity) {
        const activityResult = await ConversationActivity.deleteMany({ user: userId });
        stats.conversationActivities = activityResult.deletedCount;
      }

      // 19. Delete AI suggested friends references
      if (AISuggestedFriends) {
        const suggestedResult = await AISuggestedFriends.deleteMany({
          $or: [
            { user: userId },
            { suggestedUser: userId }
          ]
        });
        stats.otherReferences += suggestedResult.deletedCount;
      }

      // 20. Finally, delete the user account
      const userResult = await User.findByIdAndDelete(userId);
      if (userResult) {
        stats.user = 1;
      }

      return {
        success: true,
        message: `User and all associated data deleted successfully`,
        stats
      };
    } catch (error) {
      console.error('Error in cascade delete:', error);
      throw new Error(`Cascade delete failed: ${error.message}`);
    }
  }

  /**
   * Get deletion summary before actually deleting
   * @param {String} userId - User ID to check
   * @returns {Object} Count of data that will be deleted
   */
  async getDeleteionSummary(userId) {
    const summary = {
      moments: await Moment.countDocuments({ user: userId }),
      messages: await Message.countDocuments({ sender: userId }),
      conversations: await Conversation.countDocuments({ participants: userId }),
      comments: await Comment.countDocuments({ author: userId }),
      stories: await Story.countDocuments({ user: userId }),
      notifications: await Notification.countDocuments({ recipient: userId }),
      calls: await Call.countDocuments({ $or: [{ initiator: userId }, { receiver: userId }] }),
      challenges: await Challenge.countDocuments({ createdBy: userId }),
      reports: await Report.countDocuments({ reportedBy: userId }),
    };

    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    summary.total = total;

    return summary;
  }

  /**
   * Remove user references from other collections without full deletion
   * This is a softer approach - removes user from arrays but keeps the documents
   * @param {String} userId - User ID to remove references from
   * @returns {Object} Update statistics
   */
  async removeUserReferencesOnly(userId) {
    const stats = {};

    try {
      // Remove from moments likedUsers
      stats.momentsLikes = (await Moment.updateMany(
        { likedUsers: userId },
        { $pull: { likedUsers: userId } }
      )).modifiedCount;

      // Remove from moments savedBy
      stats.momentsSaves = (await Moment.updateMany(
        { savedBy: userId },
        { $pull: { savedBy: userId } }
      )).modifiedCount;

      // Remove from moment reactions
      stats.momentReactions = (await Moment.updateMany(
        { 'reactions.user': userId },
        { $pull: { reactions: { user: userId } } }
      )).modifiedCount;

      // Remove from comments likedUsers
      stats.commentLikes = (await Comment.updateMany(
        { likedUsers: userId },
        { $pull: { likedUsers: userId } }
      )).modifiedCount;

      // Remove user from conversations (but don't delete conversation)
      stats.conversationRemoval = (await Conversation.updateMany(
        { participants: userId },
        { $pull: { participants: userId } }
      )).modifiedCount;

      // Remove from notification read-by
      stats.notificationReadby = (await Notification.updateMany(
        { readBy: userId },
        { $pull: { readBy: userId } }
      )).modifiedCount;

      return {
        success: true,
        message: 'User references removed from documents',
        stats
      };
    } catch (error) {
      console.error('Error removing user references:', error);
      throw new Error(`Reference removal failed: ${error.message}`);
    }
  }
}

module.exports = new UserCascadeDeleteService();
