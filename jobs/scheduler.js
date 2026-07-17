/**
 * Job Scheduler
 * 
 * Schedules and runs background jobs for the application.
 * Can be integrated into server.js or run as a separate process.
 * 
 * Jobs:
 * - Inactivity email check: Daily at 9:00 AM
 * - Weekly digest: Sundays at 10:00 AM
 * - Story archival: Every hour
 */

const { runInactivityCheck } = require('./inactivityEmailJob');
const { runWeeklyDigest } = require('./weeklyDigestJob');
const Story = require('../models/Story');
const {
  cleanupInactiveTokens,
  sendReengagementNotifications,
  sendSubscriptionReminders,
  cleanupOldNotifications
} = require('./notificationJobs');
const { startLearningJobs } = require('./learningJobs');
const { runSubscriptionExpiryJob } = require('./subscriptionExpiryJob');
const { runAdminReportJob } = require('./adminReportJob');
const { runWebVisitReport } = require('./webVisitReportJob');
const { runPromotionalEmailJob } = require('./promotionalEmailJob');
const dailyCounterResetJob = require('./dailyCounterResetJob');
const weeklyCounterResetJob = require('./weeklyCounterResetJob');
const voiceRoomCleanupJob = require('./voiceRoomCleanupJob');
const waveDailySummaryJob = require('./waveDailySummaryJob');
const voiceRoomSchedulerJob = require('./voiceRoomSchedulerJob');
const { purgeLegacyPronunciationAudio } = require('./pronunciationAudioPurgeJob');
const { purgeAudioCacheOrphans } = require('./audioCacheOrphanPurgeJob');
const { runDailyRoomPromptJob } = require('./dailyRoomPromptJob');
const { runTutorMemoryDecayJob } = require('./tutorMemoryDecayJob');

// Track if scheduler is already running
let isSchedulerRunning = false;

/**
 * Get current time in Korea (KST = UTC+9, no daylight saving)
 */
const getKoreaTime = () => {
  const now = new Date();
  const koreaOffset = 9 * 60; // KST is UTC+9
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + koreaOffset * 60 * 1000);
};

/**
 * Calculate milliseconds until next occurrence of a time in Korea Time (KST)
 * @param {number} targetHour - Target hour (0-23) in KST
 * @param {number} targetMinute - Target minute (0-59)
 * @param {number} targetDay - Target day of week (0=Sunday, 6=Saturday), null for daily
 */
const getMillisecondsUntil = (targetHour, targetMinute = 0, targetDay = null) => {
  const nowKST = getKoreaTime();
  const targetKST = new Date(nowKST);

  targetKST.setHours(targetHour, targetMinute, 0, 0);

  // If target day specified (for weekly jobs)
  if (targetDay !== null) {
    const daysUntil = (targetDay - nowKST.getDay() + 7) % 7;
    targetKST.setDate(targetKST.getDate() + (daysUntil === 0 && nowKST > targetKST ? 7 : daysUntil));
  } else {
    // Daily job - if time has passed today, schedule for tomorrow
    if (nowKST > targetKST) {
      targetKST.setDate(targetKST.getDate() + 1);
    }
  }

  return targetKST.getTime() - nowKST.getTime();
};

/**
 * Schedule inactivity email job (daily at 9 AM)
 */
const scheduleInactivityJob = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled inactivity check...');
    try {
      await runInactivityCheck();
    } catch (error) {
      console.error('Scheduled inactivity check failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };
  
  // Schedule first run
  const msUntilNextRun = getMillisecondsUntil(9, 0); // 9:00 AM
  console.log(`📅 Inactivity job scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule weekly digest job (Sundays at 10 AM)
 */
const scheduleWeeklyDigest = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled weekly digest...');
    try {
      await runWeeklyDigest();
    } catch (error) {
      console.error('Scheduled weekly digest failed:', error);
    }
    // Schedule next run (7 days from now)
    setTimeout(runJob, 7 * 24 * 60 * 60 * 1000);
  };
  
  // Schedule first run (next Sunday at 10 AM)
  const msUntilNextRun = getMillisecondsUntil(10, 0, 0); // 10:00 AM Sunday
  console.log(`📅 Weekly digest scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule story archival (every hour)
 */
const scheduleStoryArchival = () => {
  const runJob = async () => {
    try {
      const archivedCount = await Story.archiveExpired();
      if (archivedCount > 0) {
        console.log(`📸 Archived ${archivedCount} expired stories`);
      }
    } catch (error) {
      console.error('Story archival failed:', error);
    }
    // Schedule next run (1 hour from now)
    setTimeout(runJob, 60 * 60 * 1000);
  };
  
  // Start immediately
  setTimeout(runJob, 5000); // Wait 5 seconds after startup
  console.log('📅 Story archival job scheduled (hourly)');
};

/**
 * Schedule FCM token cleanup (daily at 2:00 AM)
 */
const scheduleTokenCleanup = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled token cleanup...');
    try {
      await cleanupInactiveTokens();
    } catch (error) {
      console.error('Scheduled token cleanup failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };
  
  // Schedule first run at 2:00 AM
  const msUntilNextRun = getMillisecondsUntil(2, 0);
  console.log(`📅 Token cleanup scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule re-engagement notifications (weekly, Monday at 10:00 AM)
 */
const scheduleReengagement = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled re-engagement...');
    try {
      await sendReengagementNotifications();
    } catch (error) {
      console.error('Scheduled re-engagement failed:', error);
    }
    // Schedule next run (7 days from now)
    setTimeout(runJob, 7 * 24 * 60 * 60 * 1000);
  };
  
  // Schedule first run (next Monday at 10 AM)
  const msUntilNextRun = getMillisecondsUntil(10, 0, 1); // 10:00 AM Monday
  console.log(`📅 Re-engagement scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule subscription reminders (daily at 9:00 AM)
 */
const scheduleSubscriptionReminders = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled subscription reminders...');
    try {
      await sendSubscriptionReminders();
    } catch (error) {
      console.error('Scheduled subscription reminders failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };
  
  // Schedule first run at 9:00 AM
  const msUntilNextRun = getMillisecondsUntil(9, 0);
  console.log(`📅 Subscription reminders scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule old notification cleanup (weekly, Sunday at 3:00 AM)
 */
const scheduleNotificationCleanup = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled notification cleanup...');
    try {
      await cleanupOldNotifications();
    } catch (error) {
      console.error('Scheduled notification cleanup failed:', error);
    }
    // Schedule next run (7 days from now)
    setTimeout(runJob, 7 * 24 * 60 * 60 * 1000);
  };

  // Schedule first run (next Sunday at 3 AM)
  const msUntilNextRun = getMillisecondsUntil(3, 0, 0); // 3:00 AM Sunday
  console.log(`📅 Notification cleanup scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule SRS review reminders (daily at 9:00 AM KST)
 */
const scheduleSrsReviewReminders = () => {
  const { sendSrsReviewReminders } = require('./learningJobs');

  const runJob = async () => {
    console.log('\n⏰ Running scheduled SRS review reminders...');
    try {
      await sendSrsReviewReminders();
    } catch (error) {
      console.error('Scheduled SRS review reminders failed:', error);
    }
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(9, 0);
  console.log(`📅 SRS review reminders scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule streak reminders (daily at 8:00 PM KST).
 * Task 3 (Workstream E-core) — sendStreakReminders lived as dead code in
 * jobs/learningJobs.js (defined :323, exported :418, never called from
 * startLearningJobs, which only supports interval scheduling via
 * scheduleJob(name, intervalMs, fn) — no time-of-day support). Wired here
 * following the scheduleSrsReviewReminders pattern instead.
 */
const scheduleStreakReminders = () => {
  const { sendStreakReminders } = require('./learningJobs');

  const runJob = async () => {
    console.log('\n⏰ Running scheduled streak reminders...');
    try {
      await sendStreakReminders();
    } catch (error) {
      console.error('Scheduled streak reminders failed:', error);
    }
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(20, 0); // 8:00 PM KST
  console.log(`📅 Streak reminders scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule the daily language-room ("hub") prompt job (daily at 8:30 AM KST).
 * Staggered 30min before the 9 AM cluster (inactivity/subscription/SRS jobs)
 * to avoid bursts. Posts one system prompt message per seeded hub — see
 * jobs/dailyRoomPromptJob.js (Workstream D, Task 6). No-ops entirely if
 * ROOMS_ENABLED is false.
 */
const scheduleDailyRoomPrompt = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled daily room prompt job...');
    try {
      await runDailyRoomPromptJob();
    } catch (error) {
      console.error('Scheduled daily room prompt job failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  // Schedule first run at 8:30 AM KST
  const msUntilNextRun = getMillisecondsUntil(8, 30);
  console.log(`📅 Daily room prompt job scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule tutor memory decay (3:30 AM KST, daily). H6 — halves stale weak-area
 * frequencies (unseen > 14d) and resolves areas exercised successfully N times,
 * so mastered/abandoned topics stop surfacing in tutor prompts. Staggered away
 * from the 2:00-2:15 purge cluster and the 8:30/9:00 morning clusters.
 */
const scheduleTutorMemoryDecay = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled tutor memory decay job...');
    try {
      await runTutorMemoryDecayJob();
    } catch (error) {
      console.error('Scheduled tutor memory decay job failed:', error);
    }
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(3, 30);
  console.log(`📅 Tutor memory decay job scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule subscription expiry check (every hour)
 * Critical job for billing integrity - checks expired VIP subscriptions
 * and deactivates them after grace period
 */
const scheduleSubscriptionExpiry = () => {
  const runJob = async () => {
    try {
      await runSubscriptionExpiryJob();
    } catch (error) {
      console.error('Scheduled subscription expiry job failed:', error);
    }
    // Schedule next run (1 hour from now)
    setTimeout(runJob, 60 * 60 * 1000);
  };

  // Start first run after 1 minute (allow server to fully initialize)
  setTimeout(runJob, 60 * 1000);
  console.log('📅 Subscription expiry job scheduled (hourly)');
};

/**
 * Schedule daily admin report (daily at 9:00 AM)
 * Sends daily statistics to admin email
 */
const scheduleAdminReport = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled admin report...');
    try {
      await runAdminReportJob();
    } catch (error) {
      console.error('Scheduled admin report failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  // Schedule first run at 9:00 AM
  const msUntilNextRun = getMillisecondsUntil(9, 0);
  console.log(`📅 Admin report scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule weekly web visit report (Mondays at 8:00 AM)
 */
const scheduleWebVisitReport = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled web visit report...');
    try {
      await runWebVisitReport();
    } catch (error) {
      console.error('Scheduled web visit report failed:', error);
    }
    // Schedule next run (7 days from now)
    setTimeout(runJob, 7 * 24 * 60 * 60 * 1000);
  };

  // Schedule first run (next Monday at 8 AM)
  const msUntilNextRun = getMillisecondsUntil(8, 0, 1); // 8:00 AM Monday
  console.log(`📅 Web visit report scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule weekly promotional email (Sundays at 9:00 AM KST)
 */
const schedulePromotionalEmail = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled promotional email...');
    try {
      await runPromotionalEmailJob();
    } catch (error) {
      console.error('Scheduled promotional email failed:', error);
    }
    // Schedule next run (7 days from now)
    setTimeout(runJob, 7 * 24 * 60 * 60 * 1000);
  };

  // Schedule first run (next Sunday at 9 AM KST)
  const msUntilNextRun = getMillisecondsUntil(9, 0, 0); // 9:00 AM Sunday
  console.log(`📅 Promotional email scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule daily counter reset (every hour, catches all timezones crossing midnight)
 */
const scheduleDailyCounterReset = () => {
  const runJob = async () => {
    try {
      await dailyCounterResetJob.run();
    } catch (error) {
      console.error('[dailyCounterResetJob]', error);
    }
    // Schedule next run (1 hour from now)
    setTimeout(runJob, 60 * 60 * 1000);
  };

  // Start first run after 2 minutes (allow server to fully initialize)
  setTimeout(runJob, 2 * 60 * 1000);
  console.log('📅 Daily counter reset job scheduled (hourly)');
};

/**
 * Schedule weekly counter reset (every 6 hours)
 */
const scheduleWeeklyCounterReset = () => {
  const runJob = async () => {
    try {
      await weeklyCounterResetJob.run();
    } catch (error) {
      console.error('[weeklyCounterResetJob]', error);
    }
    // Schedule next run (6 hours from now)
    setTimeout(runJob, 6 * 60 * 60 * 1000);
  };

  // Start first run after 3 minutes (allow server to fully initialize)
  setTimeout(runJob, 3 * 60 * 1000);
  console.log('📅 Weekly counter reset job scheduled (every 6 hours)');
};

/**
 * Schedule legacy pronunciation audio purge (daily at 2:00 AM KST).
 * Deletes Spaces blobs for PronunciationAttempt records aged >27 days,
 * ~3 days before the 30-day Mongo TTL drops the record entirely.
 */
const schedulePronunciationAudioPurge = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled pronunciation audio purge...');
    try {
      await purgeLegacyPronunciationAudio();
    } catch (error) {
      console.error('Scheduled pronunciation audio purge failed:', error);
    }
    // Schedule next run (24 hours from now)
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(2, 0); // 2:00 AM KST
  console.log(`📅 Pronunciation audio purge scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Schedule AudioCache orphan-blob purge (daily at 2:15 AM KST).
 * Staggered 15min after the pronunciation purge to avoid bursts.
 * Deletes Spaces blobs for AudioCache records aged >87 days,
 * ~3 days before the 90-day Mongo TTL drops the record.
 */
const scheduleAudioCacheOrphanPurge = () => {
  const runJob = async () => {
    console.log('\n⏰ Running scheduled AudioCache orphan purge...');
    try {
      await purgeAudioCacheOrphans();
    } catch (error) {
      console.error('Scheduled AudioCache orphan purge failed:', error);
    }
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(2, 15); // 2:15 AM KST
  console.log(`📅 AudioCache orphan purge scheduled in ${Math.round(msUntilNextRun / 1000 / 60 / 60)} hours`);
  setTimeout(runJob, msUntilNextRun);
};

/**
 * Start all scheduled jobs
 */
const startScheduler = () => {
  if (isSchedulerRunning) {
    console.log('⚠️ Scheduler is already running');
    return;
  }
  
  isSchedulerRunning = true;
  console.log('\n🚀 Starting job scheduler...');
  
  // Email and content jobs
  scheduleInactivityJob();
  scheduleWeeklyDigest();
  scheduleStoryArchival();
  
  // Notification jobs
  scheduleTokenCleanup();
  scheduleReengagement();
  scheduleSubscriptionReminders();
  scheduleSrsReviewReminders();  // ← new
  scheduleStreakReminders();     // ← new (Task 3, Workstream E-core)
  scheduleNotificationCleanup();

  // Subscription/billing jobs
  scheduleSubscriptionExpiry();

  // Admin reports
  scheduleAdminReport();

  // Web visit weekly report (Mondays at 8:00 AM)
  scheduleWebVisitReport();

  // Promotional email (Sundays at 9:00 AM KST)
  schedulePromotionalEmail();

  // Notification frequency-cap counter resets
  scheduleDailyCounterReset();
  scheduleWeeklyCounterReset();

  // Learning/gamification jobs
  startLearningJobs();

  // Voice room stale-cleanup job (every 60s, stale > 90s)
  voiceRoomCleanupJob.start();

  // Voice room scheduler job (every 60s — start scheduled rooms + reminders)
  voiceRoomSchedulerJob.start();

  // Wave daily summary job (9 AM UTC, hourly tick)
  waveDailySummaryJob.start();

  // Legacy pronunciation user-audio purge (2 AM KST, daily)
  schedulePronunciationAudioPurge();
  scheduleAudioCacheOrphanPurge();

  // Language rooms ("hubs") daily prompt (8:30 AM KST, daily)
  scheduleDailyRoomPrompt();

  // Tutor memory decay/mastery (3:30 AM KST, daily) — H6
  scheduleTutorMemoryDecay();

  console.log('✅ All jobs scheduled!\n');
};

/**
 * Run all jobs immediately (for testing)
 */
const runAllJobsNow = async () => {
  console.log('\n🔄 Running all jobs immediately...');
  
  try {
    console.log('\n1️⃣ Running inactivity check...');
    await runInactivityCheck();
    
    console.log('\n2️⃣ Running weekly digest...');
    await runWeeklyDigest();
    
    console.log('\n3️⃣ Running story archival...');
    const archivedCount = await Story.archiveExpired();
    console.log(`Archived ${archivedCount} stories`);
    
    console.log('\n4️⃣ Running token cleanup...');
    await cleanupInactiveTokens();
    
    console.log('\n5️⃣ Running re-engagement...');
    await sendReengagementNotifications();
    
    console.log('\n6️⃣ Running subscription reminders...');
    await sendSubscriptionReminders();
    
    console.log('\n7️⃣ Running notification cleanup...');
    await cleanupOldNotifications();

    console.log('\n8️⃣ Running subscription expiry check...');
    await runSubscriptionExpiryJob();

    console.log('\n9️⃣ Running admin report...');
    await runAdminReportJob();

    console.log('\n🔟 Running web visit report...');
    await runWebVisitReport();

    console.log('\n1️⃣1️⃣ Running promotional email...');
    await runPromotionalEmailJob();

    console.log('\n1️⃣2️⃣ Running daily room prompt job...');
    await runDailyRoomPromptJob();

    console.log('\n✅ All jobs completed!');
  } catch (error) {
    console.error('Error running jobs:', error);
  }
};

module.exports = {
  startScheduler,
  runAllJobsNow,
  scheduleInactivityJob,
  scheduleWeeklyDigest,
  scheduleStoryArchival,
  scheduleTokenCleanup,
  scheduleReengagement,
  scheduleSubscriptionReminders,
  scheduleNotificationCleanup,
  scheduleSubscriptionExpiry,
  scheduleAdminReport,
  scheduleWebVisitReport,
  schedulePromotionalEmail,
  scheduleDailyCounterReset,
  scheduleWeeklyCounterReset,
  scheduleSrsReviewReminders,
  scheduleStreakReminders,
  scheduleDailyRoomPrompt
};

