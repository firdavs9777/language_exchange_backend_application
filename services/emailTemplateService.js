'use strict';
/**
 * Email string-catalog service — the email twin of
 * services/notificationTemplateService.js.
 *
 * Catalogs live in email_templates/{locale}.json. en.json is the source of
 * truth; other locales may translate any subset of its keys and fall back to
 * en PER KEY (not per file), so partially-translated catalogs are safe to
 * ship. Unknown locale → en. Interpolation uses {placeholder} tokens; a
 * missing placeholder is left intact (e.g. "{userName}") exactly like the
 * push renderer, so bugs are visible rather than silent.
 *
 * Layout/HTML stays in utils/emailTemplates.js — catalogs contain only
 * copy strings (subjects, headings, paragraphs, labels, CTA text).
 */

const fs = require('fs');
const path = require('path');

const CATALOG_DIR = path.join(__dirname, '..', 'email_templates');
const cache = {};

function load(locale) {
  if (cache[locale] !== undefined) return cache[locale];
  const fp = path.join(CATALOG_DIR, `${locale}.json`);
  cache[locale] = fs.existsSync(fp)
    ? JSON.parse(fs.readFileSync(fp, 'utf8'))
    : null;
  return cache[locale];
}

function getPath(obj, dottedKey) {
  if (!obj) return undefined;
  return dottedKey
    .split('.')
    .reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : undefined), obj);
}

function interpolate(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`,
  );
}

/**
 * Look up a copy string (or string array) by dotted key with per-key en
 * fallback, then interpolate {vars}. Throws on keys missing from en.json —
 * that's always a programming error, caught by tests.
 *
 * @param {string} locale  e.g. 'ko' — unknown/null falls back to 'en'
 * @param {string} key     dotted path, e.g. 'welcome.subject'
 * @param {object} vars    interpolation values
 * @returns {string|string[]}
 */
function t(locale, key, vars = {}) {
  let val = getPath(load(locale || 'en'), key);
  if (val === undefined) val = getPath(load('en'), key);
  if (val === undefined) {
    throw new Error(`Unknown email template key: ${key}`);
  }
  if (Array.isArray(val)) return val.map((s) => interpolate(s, vars));
  return interpolate(val, vars);
}

/** Locale for a user's emails: stored preferredLocale, else en. */
function resolveEmailLocale(user) {
  return (user && user.preferredLocale) || 'en';
}

/** Right-to-left locales (drives dir="rtl" in the base layout). */
function isRtl(locale) {
  return locale === 'ar';
}

/** Test hook — drop the in-process catalog cache. */
function clearCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}

module.exports = { t, interpolate, resolveEmailLocale, isRtl, clearCache };
