const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'support', 'help', 'api',
  'banatalk', 'bananatalk', 'official', 'staff', 'moderator',
]);
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function validateUsername(raw) {
  const normalized = (raw || '').trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) return { ok: false, normalized: null, reason: 'invalid_format' };
  if (RESERVED_USERNAMES.has(normalized)) return { ok: false, normalized: null, reason: 'reserved' };
  return { ok: true, normalized, reason: null };
}

module.exports = { validateUsername, RESERVED_USERNAMES, USERNAME_RE };
