/**
 * AudioCache Orphan-Blob Purge Job
 *
 * Mirror of jobs/pronunciationAudioPurgeJob.js scoped to AudioCache
 * (TTS audio caching).
 *
 * AudioCache has a 90-day Mongo TTL on lastAccessedAt — Mongo auto-drops
 * the metadata. This job runs ~3 days before the TTL fires and deletes
 * the underlying Spaces blob so audio is gone BEFORE the URL disappears.
 *
 * Idempotent: once audioUrl is null, subsequent runs skip the record.
 */

const AudioCache = require('../models/AudioCache');
const { deleteFromSpaces } = require('../services/storageService');

const CUTOFF_DAYS = 87;
const BATCH_LIMIT = 1000;

const purgeAudioCacheOrphans = async () => {
  const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000);
  const counts = { processed: 0, blobsDeleted: 0, errors: 0, skipped: 0 };

  console.log(`[audio-cache-purge] starting — cutoff=${cutoff.toISOString()} batchLimit=${BATCH_LIMIT}`);

  const docs = await AudioCache
    .find({
      lastAccessedAt: { $lt: cutoff },
      audioUrl: { $ne: null, $exists: true },
    })
    .select('_id audioUrl')
    .limit(BATCH_LIMIT)
    .lean(false);

  for (const doc of docs) {
    counts.processed++;
    const url = doc.audioUrl;
    if (!url || typeof url !== 'string' || url.length === 0) {
      counts.skipped++;
      continue;
    }
    try {
      await deleteFromSpaces(url);
      doc.audioUrl = null;
      await doc.save();
      counts.blobsDeleted++;
    } catch (e) {
      counts.errors++;
      console.error(`[audio-cache-purge] failed for cache ${doc._id}: ${e.message}`);
    }
  }

  console.log(
    `[audio-cache-purge] done — processed=${counts.processed} ` +
    `deleted=${counts.blobsDeleted} skipped=${counts.skipped} errors=${counts.errors}`
  );
  return counts;
};

module.exports = { purgeAudioCacheOrphans };
