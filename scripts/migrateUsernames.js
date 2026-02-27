/**
 * Migration Script: Generate usernames for existing users
 *
 * Run this script to add unique usernames to all existing users
 * who don't have one yet.
 *
 * Usage: node scripts/migrateUsernames.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const mongoose = require('mongoose');
const { migrateExistingUsers } = require('../utils/generateUsername');

const runMigration = async () => {
  console.log('🚀 Starting username migration...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Run migration
    const results = await migrateExistingUsers();

    console.log('\n✅ Migration completed!');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📡 Database connection closed');
    process.exit(0);
  }
};

// Run the migration
runMigration();
