/**
 * Migration: Add Performance Indexes for Chat System
 * 
 * This migration adds critical database indexes to improve chat/messaging query performance.
 * Indexes can be added without downtime.
 * 
 * Run: node migrations/addChatIndexes.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const colors = require('colors');

// Connect to MongoDB
const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`.red);
    process.exit(1);
  }
};

const addChatIndexes = async () => {
  try {
    console.log('\n📊 Starting chat indexes migration...\n'.yellow.bold);
    
    const db = mongoose.connection.db;
    
    // ========== MESSAGE COLLECTION INDEXES ==========
    console.log('📝 Adding Message collection indexes...'.cyan);
    
    const messagesCollection = db.collection('messages');
    
    // Compound index for conversation queries (most common)
    try {
      await messagesCollection.createIndex(
        { sender: 1, receiver: 1, createdAt: -1 },
        { name: 'sender_receiver_createdAt_idx' }
      );
      console.log('  ✅ Index: sender + receiver + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: sender + receiver + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Reverse compound index
    try {
      await messagesCollection.createIndex(
        { receiver: 1, sender: 1, createdAt: -1 },
        { name: 'receiver_sender_createdAt_idx' }
      );
      console.log('  ✅ Index: receiver + sender + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: receiver + sender + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for participants array (group messages)
    try {
      await messagesCollection.createIndex(
        { participants: 1, createdAt: -1 },
        { name: 'participants_createdAt_idx' }
      );
      console.log('  ✅ Index: participants + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: participants + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for unread messages
    try {
      await messagesCollection.createIndex(
        { receiver: 1, read: 1, createdAt: -1 },
        { name: 'receiver_read_createdAt_idx' }
      );
      console.log('  ✅ Index: receiver + read + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: receiver + read + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for sender queries
    try {
      await messagesCollection.createIndex(
        { sender: 1, createdAt: -1 },
        { name: 'sender_createdAt_idx' }
      );
      console.log('  ✅ Index: sender + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: sender + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for receiver queries
    try {
      await messagesCollection.createIndex(
        { receiver: 1, createdAt: -1 },
        { name: 'receiver_createdAt_idx' }
      );
      console.log('  ✅ Index: receiver + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: receiver + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for deleted messages filtering
    try {
      await messagesCollection.createIndex(
        { isDeleted: 1, createdAt: -1 },
        { name: 'isDeleted_createdAt_idx' }
      );
      console.log('  ✅ Index: isDeleted + createdAt'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: isDeleted + createdAt'.yellow);
      } else {
        throw err;
      }
    }
    
    // ========== CONVERSATION COLLECTION INDEXES ==========
    console.log('\n💬 Adding Conversation collection indexes...'.cyan);
    
    const conversationsCollection = db.collection('conversations');
    
    // Compound index for conversation list queries
    try {
      await conversationsCollection.createIndex(
        { participants: 1, lastMessageAt: -1, isGroup: 1 },
        { name: 'participants_lastMessageAt_isGroup_idx' }
      );
      console.log('  ✅ Index: participants + lastMessageAt + isGroup'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: participants + lastMessageAt + isGroup'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for unread count queries
    try {
      await conversationsCollection.createIndex(
        { 'unreadCount.user': 1, 'unreadCount.count': 1 },
        { name: 'unreadCount_user_count_idx' }
      );
      console.log('  ✅ Index: unreadCount.user + unreadCount.count'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: unreadCount.user + unreadCount.count'.yellow);
      } else {
        throw err;
      }
    }
    
    // Index for participant lookups (if not exists)
    try {
      await conversationsCollection.createIndex(
        { participants: 1 },
        { name: 'participants_idx' }
      );
      console.log('  ✅ Index: participants'.green);
    } catch (err) {
      if (err.code === 85) {
        console.log('  ⚠️  Index already exists: participants'.yellow);
      } else {
        throw err;
      }
    }
    
    // ========== VERIFICATION ==========
    console.log('\n🔍 Verifying indexes...'.cyan);
    
    const messageIndexes = await messagesCollection.indexes();
    const conversationIndexes = await conversationsCollection.indexes();
    
    console.log(`\n📊 Message collection has ${messageIndexes.length} indexes`.blue);
    console.log(`📊 Conversation collection has ${conversationIndexes.length} indexes`.blue);
    
    console.log('\n✅ Migration completed successfully!'.green.bold);
    console.log('💡 Indexes are now active and will improve query performance.\n'.cyan);
    
  } catch (error) {
    console.error('\n❌ Migration error:'.red.bold);
    console.error(error);
    process.exit(1);
  }
};

// Run migration
const runMigration = async () => {
  await connectDb();
  await addChatIndexes();
  await mongoose.connection.close();
  console.log('👋 Database connection closed.'.cyan);
  process.exit(0);
};

// Execute
runMigration();

