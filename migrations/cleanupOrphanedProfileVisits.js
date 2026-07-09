/**
 * Migration: Clean up orphaned ProfileVisit records
 *
 * When users were deleted, their ProfileVisit records weren't cleaned up because
 * the deletion query used the wrong field name ('visited' instead of 'profileOwner').
 *
 * This migration:
 * 1. Finds ProfileVisit records with deleted profileOwners
 * 2. Finds ProfileVisit records with deleted visitors
 * 3. Deletes all orphaned records
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

const ProfileVisit = require('../models/ProfileVisit');
const User = require('../models/User');

async function cleanup() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    console.log('✅ Connected\n');

    // ============================================
    // Step 1: Find orphaned profileOwner records
    // ============================================
    console.log('🔍 Finding orphaned profileOwner records...');

    const orphanedOwners = await ProfileVisit.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'profileOwner',
          foreignField: '_id',
          as: 'ownerData',
        },
      },
      { $match: { ownerData: { $eq: [] } } },
      { $count: 'orphaned' },
    ]).toArray();

    const orphanedOwnerCount = orphanedOwners[0]?.orphaned || 0;
    console.log(`   Found: ${orphanedOwnerCount} visits with deleted profileOwners\n`);

    // ============================================
    // Step 2: Find orphaned visitor records
    // ============================================
    console.log('🔍 Finding orphaned visitor records...');

    const orphanedVisitors = await ProfileVisit.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'visitor',
          foreignField: '_id',
          as: 'visitorData',
        },
      },
      { $match: { visitorData: { $eq: [] } } },
      { $count: 'orphaned' },
    ]).toArray();

    const orphanedVisitorCount = orphanedVisitors[0]?.orphaned || 0;
    console.log(`   Found: ${orphanedVisitorCount} visits with deleted visitors\n`);

    // ============================================
    // Step 3: Delete orphaned profileOwner records
    // ============================================
    console.log('🗑️  Deleting orphaned profileOwner records...');

    const deleteOwnerResult = await ProfileVisit.deleteMany({
      profileOwner: {
        $nin: await User.distinct('_id'),
      },
    });

    console.log(`   Deleted: ${deleteOwnerResult.deletedCount} records\n`);

    // ============================================
    // Step 4: Delete orphaned visitor records
    // ============================================
    console.log('🗑️  Deleting orphaned visitor records...');

    const deleteVisitorResult = await ProfileVisit.deleteMany({
      visitor: {
        $nin: await User.distinct('_id'),
      },
    });

    console.log(`   Deleted: ${deleteVisitorResult.deletedCount} records\n`);

    // ============================================
    // Step 5: Verify cleanup
    // ============================================
    console.log('✅ Verifying cleanup...\n');

    const remainingOrphanedOwners = await ProfileVisit.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'profileOwner',
          foreignField: '_id',
          as: 'ownerData',
        },
      },
      { $match: { ownerData: { $eq: [] } } },
      { $count: 'orphaned' },
    ]).toArray();

    const remainingOrphanedVisitors = await ProfileVisit.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'visitor',
          foreignField: '_id',
          as: 'visitorData',
        },
      },
      { $match: { visitorData: { $eq: [] } } },
      { $count: 'orphaned' },
    ]).toArray();

    const remainingOwnerCount = remainingOrphanedOwners[0]?.orphaned || 0;
    const remainingVisitorCount = remainingOrphanedVisitors[0]?.orphaned || 0;

    console.log('📊 Results:');
    console.log(
      `   Remaining orphaned profileOwners: ${remainingOwnerCount} (should be 0)`
    );
    console.log(
      `   Remaining orphaned visitors: ${remainingVisitorCount} (should be 0)`
    );

    // Get total valid records
    const totalRecords = await ProfileVisit.countDocuments();
    console.log(`   Total valid ProfileVisit records: ${totalRecords}\n`);

    if (remainingOwnerCount === 0 && remainingVisitorCount === 0) {
      console.log('✅ Cleanup successful! All orphaned records removed.\n');
      console.log('📈 Summary:');
      console.log(`   - Deleted ${deleteOwnerResult.deletedCount} records with deleted profileOwners`);
      console.log(`   - Deleted ${deleteVisitorResult.deletedCount} records with deleted visitors`);
      console.log(`   - Total records cleaned: ${deleteOwnerResult.deletedCount + deleteVisitorResult.deletedCount}`);
      console.log(`   - Valid records remaining: ${totalRecords}\n`);
    } else {
      console.log(
        '⚠️  WARNING: Some orphaned records still exist. Check the query logic.\n'
      );
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanup();
