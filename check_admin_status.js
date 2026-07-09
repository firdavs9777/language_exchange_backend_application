const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });

    const email = 'bananatalkmain@gmail.com';
    const userCol = mongoose.connection.db.collection('users');

    const admin = await userCol.findOne({ email });

    console.log('\n🔍 ADMIN ACCOUNT STATUS\n');
    console.log('='.repeat(70) + '\n');

    if (!admin) {
      console.log('❌ ACCOUNT NOT FOUND\n');
    } else {
      console.log('✅ ACCOUNT EXISTS\n');
      console.log('📊 Account Details:\n');
      console.log(`  Email: ${admin.email}`);
      console.log(`  ID: ${admin._id}`);
      console.log(`  Created: ${admin.createdAt}`);
      console.log(`  Updated: ${admin.updatedAt}\n`);

      console.log('🔐 Account Status:\n');
      console.log(`  Email Verified: ${admin.isEmailVerified}`);
      console.log(`  Registration Complete: ${admin.isRegistrationComplete}`);
      console.log(`  Terms Accepted: ${admin.termsAccepted}`);
      console.log(`  Banned: ${admin.isBanned || false}\n`);

      console.log('🔑 Authentication:\n');
      console.log(`  Has Password Hash: ${!!admin.password}`);
      console.log(`  Google ID: ${admin.googleId || 'none'}`);
      console.log(`  Facebook ID: ${admin.facebookId || 'none'}`);
      console.log(`  Apple ID: ${admin.appleId || 'none'}\n`);

      // Check if there were recent attempts to delete
      console.log('⚠️  Last Activity:\n');
      console.log(`  Last Login: ${admin.lastLogin || 'never'}`);
      console.log(`  Last Activity: ${admin.lastActivityAt || 'unknown'}\n`);

      console.log('='.repeat(70) + '\n');

      if (!admin.isEmailVerified) {
        console.log('⚠️  WARNING: Email not verified');
      }
      if (admin.isBanned) {
        console.log('🚫 CRITICAL: Account is banned!');
      }
      if (!admin.password && !admin.googleId && !admin.facebookId) {
        console.log('⚠️  WARNING: No login method available!');
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
