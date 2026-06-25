/**
 * Creates a temporary account for a support user, bypassing registration steps.
 * Inserts directly via mongoose collection API to avoid the jsonwebtoken/jwa
 * incompatibility with Node 25 (SlowBuffer removed).
 *
 * Usage: node scripts/create-temp-account.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');



const bcrypt = require('bcryptjs');

const EMAIL = 'nozil@mail.ru';
const PLAIN_PASSWORD = 'TempPass2026!';

const run = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected: ${conn.connection.host}`);

  const col = conn.connection.collection('users');

  const existing = await col.findOne({ email: EMAIL });
  if (existing) {
    console.log(`Account already exists for ${EMAIL} (id: ${existing._id})`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10);

  const now = new Date();
  const doc = {
    name: 'Nozil',
    email: EMAIL,
    password: hashedPassword,
    gender: 'female',
    native_language: 'tg',
    language_to_learn: 'en',
    isEmailVerified: true,
    isRegistrationComplete: true,
    termsAccepted: true,
    termsAcceptedDate: now,
    images: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);
  console.log('Created account:');
  console.log(`  Name:     Nozil`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PLAIN_PASSWORD}`);
  console.log(`  ID:       ${result.insertedId}`);
  console.log('\nShare these credentials with Nozil.');

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
