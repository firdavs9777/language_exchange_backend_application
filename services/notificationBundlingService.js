'use strict';

const BUNDLEABLE = {
  moment_like:      { window: 60_000,  keyFn: (d) => d.momentId },
  follower_moment:  { window: 60_000,  keyFn: (d) => d.momentId },
  profile_visit:    { window: 300_000, keyFn: () => 'all' },
  friend_request:   { window: 60_000,  keyFn: () => 'all' },
};

const buckets = new Map(); // `${userId}|${type}|${key}` -> { count, actorIds, vars, timer }

function bucketKey(userId, type, ck) {
  return `${userId}|${type}|${ck}`;
}

async function collect(userId, type, data, dispatcher) {
  const cfg = BUNDLEABLE[type];
  if (!cfg) {
    // Pass-through for non-bundleable types
    await dispatcher({
      userId,
      type,
      count: 1,
      actorIds: data.actorId ? [data.actorId] : [],
      vars: data,
    });
    return;
  }
  const ck = cfg.keyFn(data) || 'all';
  const k = bucketKey(userId, type, ck);
  let bucket = buckets.get(k);
  if (!bucket) {
    bucket = { count: 0, actorIds: [], vars: data, timer: null };
    buckets.set(k, bucket);
    bucket.timer = setTimeout(() => flush(k, dispatcher), cfg.window);
  }
  bucket.count += 1;
  if (data.actorId) bucket.actorIds.push(data.actorId);
  // Keep most-recent vars (e.g. latest actorName) for template rendering
  bucket.vars = { ...bucket.vars, ...data };
}

async function flush(key, dispatcher) {
  const bucket = buckets.get(key);
  if (!bucket) return;
  buckets.delete(key);
  if (bucket.timer) clearTimeout(bucket.timer);
  const [userId, type] = key.split('|');
  await dispatcher({
    userId,
    type,
    count: bucket.count,
    actorIds: bucket.actorIds,
    vars: bucket.vars,
  });
}

// Test helpers
function _flushNow(userId, type, ck, dispatcher) {
  return flush(bucketKey(userId, type, ck), dispatcher);
}

function _reset() {
  for (const b of buckets.values()) {
    if (b.timer) clearTimeout(b.timer);
  }
  buckets.clear();
}

module.exports = { collect, _flushNow, _reset, BUNDLEABLE };
