/**
 * One-time migration script to convert all DigitalOcean Spaces URLs to CDN URLs
 * Run with: node scripts/migrateToCdnUrls.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI not found in config/config.env');
  process.exit(1);
}

// Collections and fields to update
const migrations = [
  { collection: 'messages', field: 'media.url' },
  { collection: 'messages', field: 'media.thumbnail' },
  { collection: 'users', field: 'images', isArray: true },
  { collection: 'users', field: 'avatar' },
  { collection: 'moments', field: 'images', isArray: true },
  { collection: 'moments', field: 'video.url' },
  { collection: 'moments', field: 'video.thumbnail' },
  { collection: 'stories', field: 'mediaUrls', isArray: true },
  { collection: 'stories', field: 'thumbnail' },
  { collection: 'comments', field: 'image' },
];

async function migrateToCdn() {
  console.log('🚀 Starting CDN URL migration...\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    let totalUpdated = 0;

    for (const { collection, field, isArray } of migrations) {
      console.log(`📦 Processing ${collection}.${field}...`);

      const col = db.collection(collection);

      // Build the query to find non-CDN URLs
      const query = {};
      if (isArray) {
        query[field] = {
          $elemMatch: {
            $regex: '\\.digitaloceanspaces\\.com',
            $not: { $regex: '\\.cdn\\.digitaloceanspaces\\.com' }
          }
        };
      } else {
        query[field] = {
          $regex: '\\.digitaloceanspaces\\.com',
          $not: { $regex: '\\.cdn\\.digitaloceanspaces\\.com' }
        };
      }

      // Find documents that need updating
      const docs = await col.find(query).toArray();
      console.log(`   Found ${docs.length} documents to update`);

      let updated = 0;
      for (const doc of docs) {
        const updateQuery = { _id: doc._id };
        let updateOp = {};

        if (isArray) {
          // Update array field
          const fieldValue = getNestedValue(doc, field);
          if (Array.isArray(fieldValue)) {
            const newValues = fieldValue.map(url =>
              typeof url === 'string'
                ? url.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com')
                : url
            );
            updateOp = { $set: { [field]: newValues } };
          }
        } else {
          // Update single field
          const fieldValue = getNestedValue(doc, field);
          if (typeof fieldValue === 'string') {
            const newValue = fieldValue.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');
            updateOp = { $set: { [field]: newValue } };
          }
        }

        if (Object.keys(updateOp).length > 0) {
          await col.updateOne(updateQuery, updateOp);
          updated++;
        }
      }

      console.log(`   ✅ Updated ${updated} documents\n`);
      totalUpdated += updated;
    }

    console.log('='.repeat(50));
    console.log(`🎉 Migration complete! Total documents updated: ${totalUpdated}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Helper to get nested field value (e.g., "media.url" from doc)
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Run migration
migrateToCdn();
