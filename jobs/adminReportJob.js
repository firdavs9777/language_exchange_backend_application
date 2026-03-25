/**
 * Enhanced Admin Daily Report Job
 *
 * Sends comprehensive daily report with:
 * - User statistics (total, new, active, retention)
 * - Backend health (uptime, memory, DB stats)
 * - User demographics (by language, country, platform)
 * - Engagement metrics (messages, calls, translations)
 * - Revenue analytics (VIP stats, conversion)
 */

const os = require('os');
const User = require('../models/User');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const Story = require('../models/Story');
const Call = require('../models/Call');
const VoiceRoom = require('../models/VoiceRoom');
const Conversation = require('../models/Conversation');
const emailService = require('../services/emailService');
const mongoose = require('mongoose');

// Admin email for reports
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bananatalkmain@gmail.com';

// Server start time for uptime calculation
const SERVER_START_TIME = new Date();

/**
 * Get date boundaries (using local server time for consistency)
 */
const getDateBoundaries = () => {
  const now = new Date();

  // Today: Start of day to now
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Yesterday
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // 7 days ago
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 30 days ago
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 24 hours ago (for active users)
  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  return {
    now,
    startOfToday,
    startOfYesterday,
    sevenDaysAgo,
    thirtyDaysAgo,
    twentyFourHoursAgo
  };
};

/**
 * Get backend health statistics
 */
const getBackendHealth = async () => {
  const uptime = Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  // Memory usage
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  // CPU load
  const loadAvg = os.loadavg();

  // MongoDB stats
  let dbStats = {};
  try {
    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();
    dbStats = {
      connections: serverStatus.connections?.current || 'N/A',
      availableConnections: serverStatus.connections?.available || 'N/A',
      opcounters: serverStatus.opcounters || {}
    };
  } catch (err) {
    dbStats = { error: 'Could not fetch DB stats' };
  }

  return {
    uptime: `${days}d ${hours}h ${minutes}m`,
    uptimeSeconds: uptime,
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      systemUsedPercent: usedMemPercent
    },
    cpu: {
      loadAvg1m: loadAvg[0].toFixed(2),
      loadAvg5m: loadAvg[1].toFixed(2),
      loadAvg15m: loadAvg[2].toFixed(2),
      cores: os.cpus().length
    },
    database: dbStats,
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()}`
  };
};

/**
 * Get user statistics
 */
const getUserStats = async (dates) => {
  const { startOfToday, startOfYesterday, sevenDaysAgo, thirtyDaysAgo, twentyFourHoursAgo } = dates;

  // Basic counts
  const [
    totalUsers,
    totalRegistered,
    newUsersToday,
    newUsersYesterday,
    newUsersThisWeek,
    newUsersThisMonth,
    activeUsersToday,
    activeUsersThisWeek,
    activeUsersThisMonth
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isRegistrationComplete: true }),
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ lastActive: { $gte: twentyFourHoursAgo } }),
    User.countDocuments({ lastActive: { $gte: sevenDaysAgo } }),
    User.countDocuments({ lastActive: { $gte: thirtyDaysAgo } })
  ]);

  // Registration completion rate
  const incompleteRegistrations = totalUsers - totalRegistered;
  const completionRate = totalUsers > 0 ? Math.round((totalRegistered / totalUsers) * 100) : 0;

  // Retention rate (users who came back in last 7 days out of users who joined 7-14 days ago)
  const fourteenDaysAgo = new Date(startOfToday);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const usersJoined7to14DaysAgo = await User.countDocuments({
    createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }
  });

  const retainedUsers = await User.countDocuments({
    createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
    lastActive: { $gte: sevenDaysAgo }
  });

  const retentionRate = usersJoined7to14DaysAgo > 0
    ? Math.round((retainedUsers / usersJoined7to14DaysAgo) * 100)
    : 0;

  // Growth rate (week over week)
  const twoWeeksAgo = new Date(sevenDaysAgo);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
  const newUsersLastWeek = await User.countDocuments({
    createdAt: { $gte: twoWeeksAgo, $lt: sevenDaysAgo }
  });
  const growthRate = newUsersLastWeek > 0
    ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
    : 0;

  return {
    total: totalUsers,
    registered: totalRegistered,
    incompleteRegistrations,
    completionRate,
    newToday: newUsersToday,
    newYesterday: newUsersYesterday,
    newThisWeek: newUsersThisWeek,
    newThisMonth: newUsersThisMonth,
    activeToday: activeUsersToday,
    activeThisWeek: activeUsersThisWeek,
    activeThisMonth: activeUsersThisMonth,
    retentionRate,
    growthRate
  };
};

/**
 * Get user demographics
 */
const getUserDemographics = async () => {
  // By native language (top 10)
  const byNativeLanguage = await User.aggregate([
    { $match: { isRegistrationComplete: true, native_language: { $exists: true, $ne: null } } },
    { $group: { _id: '$native_language', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // By learning language (top 10)
  const byLearningLanguage = await User.aggregate([
    { $match: { isRegistrationComplete: true, language_to_learn: { $exists: true, $ne: null } } },
    { $group: { _id: '$language_to_learn', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // By country (top 10)
  const byCountry = await User.aggregate([
    { $match: { isRegistrationComplete: true, 'location.country': { $exists: true, $ne: null } } },
    { $group: { _id: '$location.country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // By platform (iOS vs Android)
  const byPlatform = await User.aggregate([
    { $match: { isRegistrationComplete: true } },
    { $unwind: { path: '$fcmTokens', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$fcmTokens.platform', count: { $sum: 1 } } }
  ]);

  // By gender
  const byGender = await User.aggregate([
    { $match: { isRegistrationComplete: true } },
    { $group: { _id: '$gender', count: { $sum: 1 } } }
  ]);

  return {
    byNativeLanguage,
    byLearningLanguage,
    byCountry,
    byPlatform,
    byGender
  };
};

/**
 * Get VIP/subscription statistics
 */
const getVipStats = async (dates) => {
  const { startOfToday, sevenDaysAgo, thirtyDaysAgo } = dates;
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [
    totalVip,
    newVipToday,
    newVipThisWeek,
    newVipThisMonth,
    expiringIn7Days,
    expiredThisWeek
  ] = await Promise.all([
    User.countDocuments({ 'vipSubscription.isActive': true }),
    User.countDocuments({ 'vipSubscription.isActive': true, 'vipSubscription.startDate': { $gte: startOfToday } }),
    User.countDocuments({ 'vipSubscription.isActive': true, 'vipSubscription.startDate': { $gte: sevenDaysAgo } }),
    User.countDocuments({ 'vipSubscription.isActive': true, 'vipSubscription.startDate': { $gte: thirtyDaysAgo } }),
    User.countDocuments({ 'vipSubscription.isActive': true, 'vipSubscription.endDate': { $gte: new Date(), $lte: sevenDaysFromNow } }),
    User.countDocuments({ 'vipSubscription.isActive': false, 'vipSubscription.endDate': { $gte: sevenDaysAgo, $lt: new Date() } })
  ]);

  // VIP by plan type
  const byPlanType = await User.aggregate([
    { $match: { 'vipSubscription.isActive': true } },
    { $group: { _id: '$vipSubscription.planType', count: { $sum: 1 } } }
  ]);

  // Conversion rate (VIP / total registered)
  const totalRegistered = await User.countDocuments({ isRegistrationComplete: true });
  const conversionRate = totalRegistered > 0 ? ((totalVip / totalRegistered) * 100).toFixed(2) : 0;

  return {
    totalVip,
    newVipToday,
    newVipThisWeek,
    newVipThisMonth,
    expiringIn7Days,
    expiredThisWeek,
    byPlanType,
    conversionRate
  };
};

/**
 * Get engagement statistics
 */
const getEngagementStats = async (dates) => {
  const { startOfToday, sevenDaysAgo } = dates;

  // Messages
  const [messagesToday, messagesThisWeek, totalMessages] = await Promise.all([
    Message.countDocuments({ createdAt: { $gte: startOfToday } }),
    Message.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Message.countDocuments({})
  ]);

  // Conversations
  const [newConversationsToday, totalConversations] = await Promise.all([
    Conversation.countDocuments({ createdAt: { $gte: startOfToday } }),
    Conversation.countDocuments({})
  ]);

  // Moments & Stories
  const [momentsToday, storiesToday, totalMoments] = await Promise.all([
    Moment.countDocuments({ createdAt: { $gte: startOfToday } }),
    Story.countDocuments({ createdAt: { $gte: startOfToday } }),
    Moment.countDocuments({})
  ]);

  // Calls (if Call model exists)
  let callStats = { callsToday: 0, callsThisWeek: 0, avgCallDuration: 0 };
  try {
    const [callsToday, callsThisWeek] = await Promise.all([
      Call.countDocuments({ createdAt: { $gte: startOfToday } }),
      Call.countDocuments({ createdAt: { $gte: sevenDaysAgo } })
    ]);

    const avgDuration = await Call.aggregate([
      { $match: { status: 'ended', duration: { $gt: 0 }, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);

    callStats = {
      callsToday,
      callsThisWeek,
      avgCallDuration: avgDuration[0]?.avgDuration ? Math.round(avgDuration[0].avgDuration) : 0
    };
  } catch (err) {
    // Call model might not exist
  }

  // Voice rooms
  let voiceRoomStats = { roomsToday: 0, activeRooms: 0 };
  try {
    const [roomsToday, activeRooms] = await Promise.all([
      VoiceRoom.countDocuments({ createdAt: { $gte: startOfToday } }),
      VoiceRoom.countDocuments({ status: 'active' })
    ]);
    voiceRoomStats = { roomsToday, activeRooms };
  } catch (err) {
    // VoiceRoom model might not exist
  }

  // Calculate messages per active user
  const activeUsersToday = await User.countDocuments({ lastActive: { $gte: startOfToday } });
  const messagesPerUser = activeUsersToday > 0 ? (messagesToday / activeUsersToday).toFixed(1) : 0;

  return {
    messages: {
      today: messagesToday,
      thisWeek: messagesThisWeek,
      total: totalMessages,
      perActiveUser: messagesPerUser
    },
    conversations: {
      newToday: newConversationsToday,
      total: totalConversations
    },
    content: {
      momentsToday,
      storiesToday,
      totalMoments
    },
    calls: callStats,
    voiceRooms: voiceRoomStats
  };
};

/**
 * Get new users list
 */
const getNewUsersList = async (dates) => {
  const { startOfToday } = dates;

  return User.find({ createdAt: { $gte: startOfToday } })
    .select('name username email createdAt native_language language_to_learn location isRegistrationComplete')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

/**
 * Gather all statistics
 */
const gatherStats = async () => {
  const dates = getDateBoundaries();

  const [
    backendHealth,
    userStats,
    demographics,
    vipStats,
    engagementStats,
    newUsersList
  ] = await Promise.all([
    getBackendHealth(),
    getUserStats(dates),
    getUserDemographics(),
    getVipStats(dates),
    getEngagementStats(dates),
    getNewUsersList(dates)
  ]);

  return {
    generatedAt: new Date(),
    backendHealth,
    users: userStats,
    demographics,
    vip: vipStats,
    engagement: engagementStats,
    newUsersList,
    // Legacy fields for backward compatibility
    totalUsers: userStats.registered,
    newUsersToday: userStats.newToday,
    newUsersThisWeek: userStats.newThisWeek,
    activeUsersToday: userStats.activeToday,
    totalVipUsers: vipStats.totalVip,
    newVipToday: vipStats.newVipToday,
    expiringVipSoon: vipStats.expiringIn7Days,
    messagesToday: engagementStats.messages.today,
    momentsToday: engagementStats.content.momentsToday,
    storiesToday: engagementStats.content.storiesToday
  };
};

/**
 * Run the daily admin report job
 */
const runAdminReportJob = async () => {
  console.log('\n📊 Starting enhanced daily admin report job...');

  try {
    const stats = await gatherStats();

    console.log('📈 Stats gathered:');
    console.log(`   - Total users: ${stats.users.registered} (${stats.users.incompleteRegistrations} incomplete)`);
    console.log(`   - New users today: ${stats.users.newToday} (yesterday: ${stats.users.newYesterday})`);
    console.log(`   - Active users: ${stats.users.activeToday} today, ${stats.users.activeThisWeek} this week`);
    console.log(`   - Retention rate: ${stats.users.retentionRate}%`);
    console.log(`   - VIP users: ${stats.vip.totalVip} (${stats.vip.conversionRate}% conversion)`);
    console.log(`   - Messages today: ${stats.engagement.messages.today}`);
    console.log(`   - Calls today: ${stats.engagement.calls.callsToday}`);
    console.log(`   - Server uptime: ${stats.backendHealth.uptime}`);

    // Send the report email
    const success = await emailService.sendAdminDailyReport(ADMIN_EMAIL, stats);

    if (success) {
      console.log(`✅ Enhanced daily admin report sent to ${ADMIN_EMAIL}`);
    } else {
      console.error(`❌ Failed to send daily admin report`);
    }

    return success;
  } catch (error) {
    console.error('❌ Admin report job failed:', error);
    return false;
  }
};

module.exports = {
  runAdminReportJob,
  gatherStats,
  ADMIN_EMAIL
};
