'use strict';

function formatHHmm(date, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

function isInQuietHours(user, now = new Date()) {
  const qh = user && user.quietHours;
  if (!qh || !qh.enabled) return false;

  const tz = qh.timezone || 'Asia/Seoul';
  const current = formatHHmm(now, tz);
  const { start, end } = qh;

  if (start === end) return false;

  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

module.exports = { isInQuietHours };
