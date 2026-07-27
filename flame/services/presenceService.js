// In-memory online-presence tracker for the isolated /flame Socket.IO namespace.
//
// Pure module — no socket/DB dependencies — so it's trivially unit-testable.
// Tracks a reference count per userId because a single user may have multiple
// concurrent socket connections (e.g. two tabs/devices); presence should only
// flip to "online" on the first connection and "offline" on the last one
// disconnecting.

const connectionCounts = new Map(); // userId -> number of live sockets

/** Register a new connection for userId. Returns true iff this transitioned 0 -> 1 (now online). */
function markOnline(userId) {
  const prev = connectionCounts.get(userId) || 0;
  connectionCounts.set(userId, prev + 1);
  return prev === 0;
}

/** Unregister a connection for userId. Returns true iff this transitioned the count -> 0 (now offline). */
function markOffline(userId) {
  const prev = connectionCounts.get(userId) || 0;
  if (prev <= 1) {
    connectionCounts.delete(userId);
    return prev !== 0;
  }
  connectionCounts.set(userId, prev - 1);
  return false;
}

/** Whether userId currently has at least one live connection. */
function isOnline(userId) {
  return (connectionCounts.get(userId) || 0) > 0;
}

/** Filter userIds down to those currently online. */
function onlineAmong(userIds) {
  if (!Array.isArray(userIds)) return [];
  return userIds.filter((id) => isOnline(id));
}

/** Test-only: clear all tracked state. */
function reset() {
  connectionCounts.clear();
}

module.exports = { markOnline, markOffline, isOnline, onlineAmong, reset };
