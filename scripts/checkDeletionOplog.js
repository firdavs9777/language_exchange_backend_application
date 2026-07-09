/**
 * Check MongoDB Oplog for User Deletions
 *
 * The oplog records all writes to the database
 * This script finds deleteOne/deleteMany operations on the Users collection
 *
 * Usage:
 *   node scripts/checkDeletionOplog.js
 *
 * NOTE: This requires read access to the oplog on your MongoDB cluster
 * (usually only available on replica sets)
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

(async () => {
  try {
    console.log('\n🔍 Checking MongoDB Oplog for User Deletions\n');

    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;

    // Try to access oplog
    try {
      const oplog = db.collection('oplog.rs');

      console.log('✅ Oplog accessible\n');

      // Find delete operations on users collection
      const deletions = await oplog
        .find({
          $or: [
            { op: 'd', ns: 'test.users' },  // delete operation
            { op: 'd', 'o._id': { $exists: true } }  // any delete with _id
          ]
        })
        .sort({ ts: -1 })
        .limit(100)
        .toArray();

      if (deletions.length === 0) {
        console.log('No delete operations found in oplog');
        console.log('(Oplog may have been rotated if deletions were old)\n');
      } else {
        console.log(`Found ${deletions.length} delete operations\n`);

        deletions.forEach((op, index) => {
          console.log(`${index + 1}. Deletion`);
          console.log(`   Timestamp: ${op.ts}`);
          console.log(`   Namespace: ${op.ns}`);
          if (op.o && op.o._id) {
            console.log(`   Deleted ID: ${op.o._id}`);
          }
          console.log();
        });
      }
    } catch (oplogErr) {
      console.log('⚠️  Oplog not accessible');
      console.log('   Reason: ' + oplogErr.message);
      console.log('\n   This is expected if:');
      console.log('   - Your MongoDB is not a replica set');
      console.log('   - Oplog has been rotated (old deletions lost)');
      console.log('   - User does not have oplog access\n');

      // Alternative: check if we can at least see the clusters status
      console.log('ℹ️  Alternative approach:');
      console.log('   1. Check admin audit logs (we added logging for new deletions)');
      console.log('   2. Run: node scripts/checkAccountDeletionHistory.js <email>');
      console.log('   3. Run: node scripts/auditDeletedAccounts.js\n');
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
