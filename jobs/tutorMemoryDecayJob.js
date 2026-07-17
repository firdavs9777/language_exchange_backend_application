/**
 * TutorMemory weak-area decay job (H6, workstream-h-aistudy).
 *
 * NEW daily pass — verified at build time that no pre-existing job iterates
 * TutorMemory. Hosted in jobs/scheduler.js on the KST-daily pattern
 * (3:30 AM KST, staggered away from the 2:00-2:15 purge cluster and the
 * 9 AM notification cluster).
 *
 * Per user:
 * - weakAreas frequency halves when lastSeen > 14 days (idempotent within
 *   a window via lastDecayedAt — see lib/tutorMemoryDecay.js)
 * - weakAreas with successCount >= 3 get resolvedAt set → excluded from
 *   prompts, never auto-resurrected.
 *
 * Batch-writes only docs that actually changed. Failures on one doc never
 * abort the pass.
 */

const TutorMemory = require('../models/TutorMemory');
const { decayWeakAreas } = require('../lib/tutorMemoryDecay');

const BATCH_SIZE = 200;

const runTutorMemoryDecayJob = async () => {
  const started = Date.now();
  let scanned = 0;
  let updated = 0;
  let decayedTotal = 0;
  let resolvedTotal = 0;
  let failures = 0;

  // Only docs that have any weak areas at all.
  const cursor = TutorMemory.find({ 'weakAreas.0': { $exists: true } })
    .select('_id weakAreas')
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  for await (const doc of cursor) {
    scanned += 1;
    try {
      const { weakAreas, changed, decayed, resolved } = decayWeakAreas(doc.weakAreas);
      if (!changed) continue;

      await TutorMemory.updateOne({ _id: doc._id }, { $set: { weakAreas } });
      updated += 1;
      decayedTotal += decayed;
      resolvedTotal += resolved;
    } catch (e) {
      failures += 1;
      console.error(`[tutorMemoryDecayJob] failed for memory ${doc._id}:`, e.message);
    }
  }

  const summary = {
    scanned,
    updated,
    decayed: decayedTotal,
    resolved: resolvedTotal,
    failures,
    ms: Date.now() - started,
  };
  console.log('[tutorMemoryDecayJob] done:', JSON.stringify(summary));
  return summary;
};

module.exports = { runTutorMemoryDecayJob };
