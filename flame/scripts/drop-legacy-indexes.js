#!/usr/bin/env node
//
// Drops indexes left behind by an earlier Flame schema.
//
// Why this exists: `flame_db.swipes` already existed before the matching
// feature shipped, carrying a unique index `uniq_swiper_swiped` on
// { swiper_id, swiped_id }. The current Swipe model uses { from, to }, so every
// document we write leaves those legacy fields null — and a unique index treats
// null as a value. The first swipe succeeds; every later one dies with
// E11000 dup key { swiper_id: null, swiped_id: null }.
//
// Tests never caught it because mongodb-memory-server starts empty.
//
// Safety: this only drops an index whose key references fields that appear in
// NO current model. Anything else is reported and left alone. Dropping an index
// destroys no documents and is reversible by recreating it.
//
// Usage, from the repo root on the server:
//   node flame/scripts/drop-legacy-indexes.js          # report only
//   node flame/scripts/drop-legacy-indexes.js --apply  # actually drop

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../config/config.env') });

const APPLY = process.argv.includes('--apply');

// Fields the CURRENT models use. An index touching only fields outside these
// sets belongs to a dead schema.
const KNOWN_FIELDS = {
  swipes: new Set(['_id', 'from', 'to', 'action', 'createdAt']),
  matches: new Set(['_id', 'users', 'pairKey', 'conversationId', 'endedBy', 'createdAt']),
  reports: new Set([
    '_id', 'reportedBy', 'reportedUser', 'reason', 'description', 'status', 'createdAt',
  ]),
};

function indexFields(index) {
  return Object.keys(index.key || {});
}

async function main() {
  const uri = process.env.FLAME_MONGO_URI;
  if (!uri) {
    console.error('FLAME_MONGO_URI is not set — check config/config.env');
    process.exit(1);
  }

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();

  console.log(`connected to ${conn.name}\n`);

  let dropped = 0;
  let suspicious = 0;

  for (const [collName, known] of Object.entries(KNOWN_FIELDS)) {
    const exists = await conn.db
      .listCollections({ name: collName })
      .hasNext();
    if (!exists) {
      console.log(`${collName}: collection does not exist yet — nothing to do\n`);
      continue;
    }

    const coll = conn.db.collection(collName);
    const indexes = await coll.indexes();
    console.log(`${collName}: ${indexes.length} index(es)`);

    for (const idx of indexes) {
      const fields = indexFields(idx);
      const unknown = fields.filter((f) => !known.has(f));
      const allUnknown = unknown.length === fields.length && fields.length > 0;

      if (idx.name === '_id_') {
        console.log(`  keep   ${idx.name}  {${fields.join(', ')}}`);
      } else if (allUnknown) {
        suspicious += 1;
        if (APPLY) {
          await coll.dropIndex(idx.name);
          dropped += 1;
          console.log(`  DROPPED ${idx.name}  {${fields.join(', ')}}  <- legacy schema`);
        } else {
          console.log(`  WOULD DROP ${idx.name}  {${fields.join(', ')}}  <- legacy schema`);
        }
      } else if (unknown.length > 0) {
        // Mixed: part current, part unknown. Too ambiguous to drop automatically.
        console.log(
          `  REVIEW ${idx.name}  {${fields.join(', ')}}  <- unknown field(s): ${unknown.join(', ')}`,
        );
      } else {
        console.log(`  keep   ${idx.name}  {${fields.join(', ')}}`);
      }
    }

    // Legacy documents are invisible to the current model but worth surfacing.
    const legacyDocs = await coll.countDocuments({
      $or: [...known].length ? [{ _id: { $exists: false } }] : [],
    }).catch(() => 0);
    if (legacyDocs) console.log(`  note: ${legacyDocs} document(s) look legacy`);

    console.log('');
  }

  if (!APPLY && suspicious > 0) {
    console.log(`${suspicious} legacy index(es) found. Re-run with --apply to drop them.`);
  } else if (APPLY) {
    console.log(`done — dropped ${dropped} index(es).`);
  } else {
    console.log('done — nothing to drop.');
  }

  await conn.close();
}

main().catch((err) => {
  console.error('failed:', err.message);
  process.exit(1);
});
