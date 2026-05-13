/**
 * Pronunciation Audio Purge Job
 *
 * Nightly cleanup of legacy PronunciationAttempt user-audio blobs in
 * DigitalOcean Spaces. The PronunciationAttempt collection has a 30-day
 * Mongo TTL on createdAt — this job runs ~3 days before the TTL fires and
 * deletes the underlying Spaces blob so the audio is gone BEFORE the
 * URL pointing to it disappears.
 *
 * Why a companion job vs. just trusting Mongo TTL:
 *   - Mongo TTL only deletes the Mongo record, not the Spaces object.
 *     The blob would orphan in the bucket forever otherwise.
 *
 * Idempotency: once userAudioUrl is set to null on a record, subsequent
 *   runs skip it. Safe to retry on transient failures.
 *
 * Scope: only the legacy /speech/pronunciation/evaluate endpoint writes
 *   userAudioUrl. The new /tutor/pronunciation/score endpoint is
 *   memory-only and never touches this collection.
 */

const PronunciationAttempt = require('../models/PronunciationAttempt');
const { deleteFromSpaces } = require('../services/storageService');

// Process docs aged 27-30 days. The 3-day window before Mongo's 30-day TTL
// gives a margin so even a couple of failed/skipped nights still get cleaned
// up before the records are gone.
const CUTOFF_DAYS = 27;

// Defensive batch cap so a single run can't take forever even if the
// collection is large. The legacy endpoint isn't called by the active
// flow, so this should rarely matter.
const BATCH_LIMIT = 1000;

/**
 * @returns {Promise<{processed:number, blobsDeleted:number, errors:number, skipped:number}>}
 */
const purgeLegacyPronunciationAudio = async () => {
  const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000);
  const counts = { processed: 0, blobsDeleted: 0, errors: 0, skipped: 0 };

  console.log(`[pronunciation-purge] starting — cutoff=${cutoff.toISOString()} batchLimit=${BATCH_LIMIT}`);

  const docs = await PronunciationAttempt
    .find({
      createdAt: { $lt: cutoff },
      userAudioUrl: { $ne: null, $exists: true },
    })
    .select('_id userAudioUrl')
    .limit(BATCH_LIMIT)
    .lean(false); // need mongoose doc to .save()

  for (const doc of docs) {
    counts.processed++;
    const url = doc.userAudioUrl;
    if (!url || typeof url !== 'string' || url.length === 0) {
      counts.skipped++;
      continue;
    }
    try {
      await deleteFromSpaces(url);
      doc.userAudioUrl = null;
      await doc.save();
      counts.blobsDeleted++;
    } catch (e) {
      counts.errors++;
      console.error(`[pronunciation-purge] failed for attempt ${doc._id}: ${e.message}`);
    }
  }

  console.log(
    `[pronunciation-purge] done — processed=${counts.processed} ` +
    `deleted=${counts.blobsDeleted} skipped=${counts.skipped} errors=${counts.errors}`
  );
  return counts;
};

module.exports = { purgeLegacyPronunciationAudio };
