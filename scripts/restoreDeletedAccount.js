/**
 * Restore a Deleted Account
 *
 * Recreates the user document under its ORIGINAL _id, which reattaches every
 * record still pointing at it (messages, conversations, moments, vocabulary,
 * coin transactions...). Nothing is moved, so there are no unique-index
 * conflicts to resolve.
 *
 * Usage:
 *   node scripts/restoreDeletedAccount.js <email>              # dry run
 *   node scripts/restoreDeletedAccount.js <email> --execute
 *   node scripts/restoreDeletedAccount.js <email> --id <userId> --execute
 *
 * Context: accounts were being destroyed by a TTL index on
 * refreshTokens.createdAt (see models/User.js). That index deleted only the
 * user document, so the owner's data is still intact and recoverable. The
 * index is gone, but historical victims still need restoring one at a time.
 *
 * IMPORTANT: profile fields (name, images, languages, birth year) are NOT
 * recoverable — nothing denormalises them. The restored account is a shell
 * with profileCompleted=false, so the owner is walked through onboarding
 * again. Their history comes back; their profile does not.
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/config.env' });

const args = process.argv.slice(2);
const emailToRestore = args.find((a) => !a.startsWith('--'));
const EXECUTE = args.includes('--execute');
const idFlagIndex = args.indexOf('--id');
const FORCED_ID = idFlagIndex !== -1 ? args[idFlagIndex + 1] : null;

if (!emailToRestore) {
  console.log('Usage: node scripts/restoreDeletedAccount.js <email> [--id <userId>] [--execute]');
  process.exit(1);
}

// Where a user id can appear. Used both to rank candidates and to report
// what the restore will reattach.
const SOURCES = [
  ['messages', 'sender'], ['conversations', 'participants'], ['moments', 'user'],
  ['comments', 'user'], ['vocabularies', 'user'], ['cointransactions', 'userId'],
  ['aiusagelogs', 'userId'], ['profilevisits', 'visitor'], ['profilevisits', 'profileOwner'],
  ['conversationactivities', 'user'], ['userinteractions', 'user'],
  ['learningprogresses', 'user'], ['tutormemories', 'user'], ['stories', 'user'],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const oid = (s) => new mongoose.Types.ObjectId(String(s));

  console.log(`\nRestoring: ${emailToRestore}`);
  console.log(EXECUTE ? '*** EXECUTE ***\n' : '*** DRY RUN — re-run with --execute to apply ***\n');

  // --- Refuse to resurrect a banned account ---------------------------
  const banned = await db.collection('bannedidentities').findOne({
    email: emailToRestore.toLowerCase(),
  });
  if (banned) {
    console.error('REFUSING: this identity is blacklisted in bannedidentities.');
    console.error(`  reason: ${banned.reason || 'n/a'}`);
    console.error(`  banned at: ${banned.bannedAt || banned.deletedAt}`);
    console.error('  Restoring would undo a moderation decision. Unban first if this is intended.');
    await mongoose.connection.close();
    process.exit(1);
  }

  // --- Does an account already hold this email? -----------------------
  const liveByEmail = await users.findOne({ email: emailToRestore });

  // --- Candidate ids this email has used, ranked by surviving data ----
  const seen = await db.collection('securitylogs').distinct('details.userId', {
    $or: [{ email: emailToRestore }, { 'details.email': emailToRestore }],
  });
  const candidates = [];
  for (const raw of seen) {
    if (!raw) continue;
    let id;
    try { id = oid(raw); } catch { continue; }
    if (await users.findOne({ _id: id }, { projection: { _id: 1 } })) continue; // alive
    const detail = {};
    let total = 0;
    for (const [coll, field] of SOURCES) {
      let n = 0;
      try { n = await db.collection(coll).countDocuments({ [field]: id }); } catch { continue; }
      if (n) { detail[`${coll}.${field}`] = n; total += n; }
    }
    if (total) candidates.push({ id: String(id), total, detail });
  }
  candidates.sort((a, b) => b.total - a.total);

  if (!candidates.length) {
    console.log('No recoverable data found for this email.');
    if (liveByEmail) console.log(`(An account already exists: ${liveByEmail._id})`);
    await mongoose.connection.close();
    return;
  }

  console.log('Recoverable incarnations (most data first):');
  candidates.forEach((c, i) =>
    console.log(`  ${i === 0 ? '*' : ' '} ${c.id}  ${String(c.total).padStart(5)} records`));

  const chosen = FORCED_ID
    ? candidates.find((c) => c.id === String(FORCED_ID))
    : candidates[0];
  if (!chosen) {
    console.error(`\n--id ${FORCED_ID} is not a recoverable incarnation for this email.`);
    await mongoose.connection.close();
    process.exit(1);
  }
  console.log(`\nRestoring _id ${chosen.id} (${chosen.total} records):`);
  Object.entries(chosen.detail).forEach(([k, v]) => console.log(`   ${k.padEnd(34)} ${v}`));

  // --- Build the document ---------------------------------------------
  // If the owner already re-registered, carry their current identity across
  // and retire the newer doc, so the restored account is the one they log
  // into. Otherwise create a shell they can claim via social login.
  const base = liveByEmail || {};
  const restored = {
    ...base,
    _id: oid(chosen.id),
    email: emailToRestore,
    name: base.name || emailToRestore.split('@')[0],
    isEmailVerified: true,
    isRegistrationComplete: true,
    profileCompleted: base.profileCompleted === true,
    refreshTokens: [],
    restoredFrom: {
      restoredAt: new Date(),
      previousId: liveByEmail ? String(liveByEmail._id) : null,
      reason: 'Recovery of account deleted by refreshTokens.createdAt TTL index',
    },
  };
  delete restored.__v;

  if (liveByEmail && String(liveByEmail._id) === chosen.id) {
    console.log('\nAlready restored — the live account is this id. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  console.log('\nPlan:');
  if (liveByEmail) {
    console.log(`  - remove newer account ${liveByEmail._id} (frees unique email/googleId/username)`);
    console.log('    NOTE: data created under that id is not moved by this script.');
  }
  console.log(`  - insert user ${chosen.id} (profileCompleted=${restored.profileCompleted})`);
  console.log(`  - ${chosen.total} records reattach automatically`);

  if (!EXECUTE) {
    console.log('\nDRY RUN — no changes made.');
    await mongoose.connection.close();
    return;
  }

  if (liveByEmail) await users.deleteOne({ _id: liveByEmail._id });
  await users.insertOne(restored);

  const check = await users.findOne({ _id: oid(chosen.id) });
  console.log('\nRestored:', !!check, '| email:', check && check.email);
  console.log('The owner signs in with the same provider and lands on their history.');
  await mongoose.connection.close();
})().catch((err) => {
  console.error('Restoration failed:', err.message);
  process.exit(1);
});
