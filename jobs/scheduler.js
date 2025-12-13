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

// Track if scheduler is already running
let isSchedulerRunning = false;

/**
 * Calculate milliseconds until next occurrence of a time
 * @param {number} targetHour - Target hour (0-23)
 * @param {number} targetMinute - Target minute (0-59)
 * @param {number} targetDay - Target day of week (0=Sunday, 6=Saturday), null for daily
 */
const getMillisecondsUntil = (targetHour, targetMinute = 0, targetDay = null) => {
  const now = new Date();
  const target = new Date();
  
  target.setHours(targetHour, targetMinute, 0, 0);
  
  // If target day specified (for weekly jobs)
  if (targetDay !== null) {
    const daysUntil = (targetDay - now.getDay() + 7) % 7;
    target.setDate(target.getDate() + (daysUntil === 0 && now > target ? 7 : daysUntil));
  } else {
    // Daily job - if time has passed today, schedule for tomorrow
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }
  }
  
  return target.getTime() - now.getTime();
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
 * Start all scheduled jobs
 */
const startScheduler = () => {
  if (isSchedulerRunning) {
    console.log('⚠️ Scheduler is already running');
    return;
  }
  
  isSchedulerRunning = true;
  console.log('\n🚀 Starting job scheduler...');
  
  scheduleInactivityJob();
  scheduleWeeklyDigest();
  scheduleStoryArchival();
  
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
  scheduleStoryArchival
};

