/**
 * Migration: Add Performance Indexes for Leaderboard & Matching Features
 *
 * Run with: node migrations/addLeaderboardMatchingIndexes.js
 *
 * Adds optimized indexes for:
 * - Smart language partner matching
 * - XP/Streak leaderboards
 * - Quick match queries
 * - User discovery
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load config
dotenv.config({ path: './config/config.env' });

const runMigration = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // ========== USER COLLECTION INDEXES ==========
    console.log('\n📊 Adding User collection indexes...');
    const usersCollection = db.collection('users');

    // For matching algorithm - finding complementary language partners
    await createIndexSafe(usersCollection,
      { native_language: 1, language_to_learn: 1, isRegistrationComplete: 1, lastActive: -1 },
      { name: 'matching_language_pair', background: true }
    );

    // For quick matches - online users with language match
    await createIndexSafe(usersCollection,
      { native_language: 1, language_to_learn: 1, lastActive: -1, 'images.0': 1 },
      { name: 'quick_match_online', background: true }
    );

    // For user discovery by activity
    await createIndexSafe(usersCollection,
      { isRegistrationComplete: 1, lastActive: -1 },
      { name: 'active_users', background: true }
    );

    // For VIP subscription queries
    await createIndexSafe(usersCollection,
      { 'vipSubscription.isActive': 1, 'vipSubscription.endDate': 1 },
      { name: 'vip_subscription_status', background: true }
    );

    // For finding users by location
    await createIndexSafe(usersCollection,
      { 'location.country': 1, native_language: 1 },
      { name: 'users_by_country_language', background: true }
    );

    // For platform-based analytics
    await createIndexSafe(usersCollection,
      { 'fcmTokens.platform': 1, createdAt: -1 },
      { name: 'users_by_platform', background: true }
    );

    console.log('✅ User indexes added');

    // ========== LEARNING PROGRESS INDEXES ==========
    console.log('\n📊 Adding LearningProgress collection indexes...');
    const progressCollection = db.collection('learningprogresses');

    // For global XP leaderboard
    await createIndexSafe(progressCollection,
      { totalXP: -1 },
      { name: 'leaderboard_xp_global', background: true }
    );

    // For weekly XP leaderboard
    await createIndexSafe(progressCollection,
      { weeklyXP: -1 },
      { name: 'leaderboard_xp_weekly', background: true }
    );

    // For streak leaderboard (longest)
    await createIndexSafe(progressCollection,
      { longestStreak: -1 },
      { name: 'leaderboard_streak_longest', background: true }
    );

    // For friends leaderboard (by user with XP)
    await createIndexSafe(progressCollection,
      { user: 1, totalXP: -1 },
      { name: 'friends_leaderboard', background: true }
    );

    // For finding users who haven't practiced (streak reminders)
    await createIndexSafe(progressCollection,
      { lastActivityDate: 1, currentStreak: -1 },
      { name: 'streak_reminder_candidates', background: true }
    );

    console.log('✅ LearningProgress indexes added');

    // ========== CONVERSATION INDEXES ==========
    console.log('\n📊 Adding Conversation collection indexes...');
    const convosCollection = db.collection('conversations');

    // For matching algorithm - exclude existing partners
    await createIndexSafe(convosCollection,
      { participants: 1 },
      { name: 'conversation_participants', background: true }
    );

    console.log('✅ Conversation indexes added');

    // ========== MESSAGE INDEXES ==========
    console.log('\n📊 Adding Message collection indexes...');
    const messagesCollection = db.collection('messages');

    // For counting messages per user (engagement metrics)
    await createIndexSafe(messagesCollection,
      { sender: 1, createdAt: -1 },
      { name: 'messages_by_sender', background: true }
    );

    // For counting messages in time range (analytics)
    await createIndexSafe(messagesCollection,
      { createdAt: -1 },
      { name: 'messages_by_date', background: true }
    );

    console.log('✅ Message indexes added');

    // ========== CALL INDEXES ==========
    console.log('\n📊 Adding Call collection indexes...');
    const callsCollection = db.collection('calls');

    // For call analytics
    await createIndexSafe(callsCollection,
      { status: 1, createdAt: -1 },
      { name: 'calls_by_status', background: true }
    );

    // For user call history
    await createIndexSafe(callsCollection,
      { caller: 1, callee: 1, createdAt: -1 },
      { name: 'calls_by_participants', background: true }
    );

    console.log('✅ Call indexes added');

    // ========== VOICE ROOM INDEXES ==========
    console.log('\n📊 Adding VoiceRoom collection indexes...');
    const voiceRoomsCollection = db.collection('voicerooms');

    // For active rooms
    await createIndexSafe(voiceRoomsCollection,
      { status: 1, createdAt: -1 },
      { name: 'voicerooms_active', background: true }
    );

    console.log('✅ VoiceRoom indexes added');

    // ========== PRINT INDEX STATS ==========
    console.log('\n📈 Index Summary:');

    const collections = ['users', 'learningprogresses', 'conversations', 'messages', 'calls', 'voicerooms'];

    for (const collName of collections) {
      try {
        const coll = db.collection(collName);
        const indexes = await coll.indexes();
        console.log(`\n${collName}: ${indexes.length} indexes`);
        indexes.forEach(idx => {
          console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
      } catch (err) {
        console.log(`  ⚠️ Could not get indexes for ${collName}: ${err.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

/**
 * Create index safely (skip if already exists)
 */
async function createIndexSafe(collection, keys, options) {
  try {
    await collection.createIndex(keys, options);
    console.log(`  ✓ Created index: ${options.name}`);
  } catch (error) {
    if (error.code === 85 || error.code === 86) {
      // Index already exists with same name or same keys
      console.log(`  ⚡ Index already exists: ${options.name}`);
    } else {
      console.error(`  ✗ Failed to create ${options.name}:`, error.message);
    }
  }
}

// Run migration
runMigration();
