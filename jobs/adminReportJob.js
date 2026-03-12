/**
 * Admin Daily Report Job
 *
 * Sends a daily report to the admin email with:
 * - User statistics (total, new today, active)
 * - VIP subscription stats
 * - Content stats (messages, moments, stories)
 * - List of new users
 */

const User = require('../models/User');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const Story = require('../models/Story');
const emailService = require('../services/emailService');

// Admin email for reports
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bananatalkmain@gmail.com';

/**
 * Get date boundaries for today (UTC-based for consistency)
 */
const getTodayBoundaries = () => {
  const now = new Date();
  // Use UTC to avoid timezone issues
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  return { startOfDay, endOfDay };
};

/**
 * Get date boundaries for this week (last 7 days, UTC-based)
 */
const getWeekBoundaries = () => {
  const now = new Date();
  const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);
  return { startOfWeek, endOfWeek: now };
};

/**
 * Gather all statistics for the daily report
 */
const gatherStats = async () => {
  const { startOfDay, endOfDay } = getTodayBoundaries();
  const { startOfWeek } = getWeekBoundaries();

  // User statistics
  const totalUsers = await User.countDocuments({ isRegistrationComplete: true });

  const newUsersToday = await User.countDocuments({
    isRegistrationComplete: true,
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  const newUsersThisWeek = await User.countDocuments({
    isRegistrationComplete: true,
    createdAt: { $gte: startOfWeek }
  });

  const activeUsersToday = await User.countDocuments({
    isRegistrationComplete: true,
    lastActive: { $gte: startOfDay }
  });

  // VIP statistics
  const totalVipUsers = await User.countDocuments({
    isRegistrationComplete: true,
    'vipSubscription.isActive': true
  });

  const newVipToday = await User.countDocuments({
    isRegistrationComplete: true,
    'vipSubscription.isActive': true,
    'vipSubscription.startDate': { $gte: startOfDay, $lt: endOfDay }
  });

  // VIP expiring in next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const expiringVipSoon = await User.countDocuments({
    'vipSubscription.isActive': true,
    'vipSubscription.endDate': { $gte: new Date(), $lte: sevenDaysFromNow }
  });

  // Content statistics
  const messagesToday = await Message.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  const momentsToday = await Moment.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  const storiesToday = await Story.countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  // Get list of new users today (limit to 20)
  const newUsersList = await User.find({
    isRegistrationComplete: true,
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  })
    .select('name username email createdAt native_language language_to_learn')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
    totalUsers,
    newUsersToday,
    newUsersThisWeek,
    activeUsersToday,
    totalVipUsers,
    newVipToday,
    expiringVipSoon,
    messagesToday,
    momentsToday,
    storiesToday,
    newUsersList
  };
};

/**
 * Run the daily admin report job
 */
const runAdminReportJob = async () => {
  console.log('\n📊 Starting daily admin report job...');

  try {
    const stats = await gatherStats();

    console.log('📈 Stats gathered:');
    console.log(`   - Total users: ${stats.totalUsers}`);
    console.log(`   - New users today: ${stats.newUsersToday}`);
    console.log(`   - Active users today: ${stats.activeUsersToday}`);
    console.log(`   - VIP users: ${stats.totalVipUsers}`);

    // Send the report email
    const success = await emailService.sendAdminDailyReport(ADMIN_EMAIL, stats);

    if (success) {
      console.log(`✅ Daily admin report sent to ${ADMIN_EMAIL}`);
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
