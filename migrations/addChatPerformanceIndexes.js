/**
 * Migration: Add Chat Performance Indexes
 *
 * Run with: node migrations/addChatPerformanceIndexes.js
 *
 * This migration adds indexes to speed up chat operations:
 * - User lookups for chat
 * - Conversation lookups
 * - Message queries
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const runMigration = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;

    // ========== USER INDEXES ==========
    console.log('\n📊 Creating User indexes...');

    const userIndexes = [
      { key: { isOnline: 1, lastSeen: -1 }, name: 'online_status' },
      { key: { blockedUsers: 1 }, name: 'blocked_users' },
      { key: { blockedBy: 1 }, name: 'blocked_by' },
      { key: { isOnline: 1, userMode: 1, lastSeen: -1 }, name: 'user_discovery' },
      { key: { email: 1 }, name: 'email_lookup' },
    ];

    for (const index of userIndexes) {
      try {
        await db.collection('users').createIndex(index.key, { name: index.name, background: true });
        console.log(`  ✅ Created index: ${index.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⏭️  Index already exists: ${index.name}`);
        } else {
          console.error(`  ❌ Failed to create ${index.name}:`, err.message);
        }
      }
    }

    // ========== CONVERSATION INDEXES ==========
    console.log('\n📊 Creating Conversation indexes...');

    const conversationIndexes = [
      { key: { participants: 1, isGroup: 1 }, name: 'dm_lookup' },
      { key: { deletedBy: 1, participants: 1 }, name: 'deleted_filter' },
    ];

    for (const index of conversationIndexes) {
      try {
        await db.collection('conversations').createIndex(index.key, { name: index.name, background: true });
        console.log(`  ✅ Created index: ${index.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⏭️  Index already exists: ${index.name}`);
        } else {
          console.error(`  ❌ Failed to create ${index.name}:`, err.message);
        }
      }
    }

    // ========== MESSAGE INDEXES ==========
    console.log('\n📊 Verifying Message indexes...');

    const messageIndexes = [
      { key: { sender: 1, receiver: 1 }, name: 'sender_receiver_fast' },
      { key: { receiver: 1, sender: 1 }, name: 'receiver_sender_fast' },
    ];

    for (const index of messageIndexes) {
      try {
        await db.collection('messages').createIndex(index.key, { name: index.name, background: true });
        console.log(`  ✅ Created index: ${index.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⏭️  Index already exists: ${index.name}`);
        } else {
          console.error(`  ❌ Failed to create ${index.name}:`, err.message);
        }
      }
    }

    // ========== SHOW INDEX STATS ==========
    console.log('\n📈 Current index stats:');

    const collections = ['users', 'conversations', 'messages'];
    for (const collName of collections) {
      const indexes = await db.collection(collName).indexes();
      console.log(`\n  ${collName}: ${indexes.length} indexes`);
      indexes.forEach(idx => {
        const keys = Object.keys(idx.key).join(', ');
        console.log(`    - ${idx.name}: {${keys}}`);
      });
    }

    console.log('\n✅ Migration complete!');
    console.log('💡 Indexes are built in background - may take a few minutes for large collections');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
