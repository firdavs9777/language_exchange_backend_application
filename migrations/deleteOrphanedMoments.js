/**
 * Migration: Delete orphaned moments from deleted users
 *
 * Removes all moments whose user references no longer exist in the database.
 * These are moments created by users who have been deleted or whose accounts
 * have disappeared.
 *
 * Usage:
 *   node migrations/deleteOrphanedMoments.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

async function deleteOrphanedMoments() {
  try {
    console.log('🔄 Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;

    // Get all valid user IDs
    const validUsers = await db.collection('users')
      .find({})
      .project({ _id: 1 })
      .toArray();

    const validUserIds = new Set(validUsers.map(u => u._id.toString()));
    console.log(`📊 Found ${validUsers.length} active users in database\n`);

    // Find all moments
    const allMoments = await db.collection('moments')
      .find({})
      .project({ _id: 1, user: 1, description: 1, createdAt: 1 })
      .toArray();

    // Identify orphaned moments
    const orphanedMomentIds = [];
    const orphanedUserIds = new Set();

    allMoments.forEach(moment => {
      if (!validUserIds.has(moment.user.toString())) {
        orphanedMomentIds.push(moment._id);
        orphanedUserIds.add(moment.user.toString());
      }
    });

    console.log(`🔍 Analysis Results:\n`);
    console.log(`  Total moments: ${allMoments.length}`);
    console.log(`  Orphaned moments (user deleted): ${orphanedMomentIds.length}`);
    console.log(`  From unique deleted users: ${orphanedUserIds.size}\n`);

    if (orphanedMomentIds.length === 0) {
      console.log('✅ No orphaned moments to delete\n');
      process.exit(0);
    }

    // Delete orphaned moments
    console.log(`🗑️  Deleting ${orphanedMomentIds.length} orphaned moments…\n`);

    const result = await db.collection('moments').deleteMany({
      _id: { $in: orphanedMomentIds }
    });

    console.log(`✅ Deletion complete:\n`);
    console.log(`  Deleted: ${result.deletedCount} moments`);
    console.log(`  From: ${orphanedUserIds.size} deleted/disappeared users\n`);

    // Verify deletion
    const remainingOrphaned = await db.collection('moments')
      .find({})
      .project({ user: 1 })
      .toArray();

    let orphanVerify = 0;
    remainingOrphaned.forEach(m => {
      if (!validUserIds.has(m.user.toString())) orphanVerify++;
    });

    if (orphanVerify === 0) {
      console.log('✅ Verification passed: No orphaned moments remain\n');
    } else {
      console.log(`⚠️ Warning: ${orphanVerify} orphaned moments still exist\n`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

deleteOrphanedMoments();
