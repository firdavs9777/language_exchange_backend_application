const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CATALOG_DIR = path.join(__dirname, '..', 'email_templates');
const TRANSLATED = ['zh', 'zh_TW', 'ar', 'ru', 'ko', 'ja', 'fr'];

const load = (locale) =>
  JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, `${locale}.json`), 'utf8'));

// Flatten {a: {b: "x", c: ["y"]}} -> Map("a.b" -> "x", "a.c" -> ["y"]),
// skipping the _meta block.
const flatten = (obj, prefix = '', out = new Map()) => {
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
};

const placeholders = (val) => {
  const strings = Array.isArray(val) ? val : [val];
  const found = new Set();
  for (const s of strings) {
    for (const m of String(s).matchAll(/\{(\w+)\}/g)) found.add(m[1]);
  }
  return found;
};

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

test('every catalog parses as JSON (en + all translations)', () => {
  for (const locale of ['en', ...TRANSLATED]) {
    assert.ok(flatten(load(locale)).size > 0, `${locale}.json is empty`);
  }
});

test('every translated key exists in en (no orphan keys)', () => {
  const enKeys = new Set(flatten(load('en')).keys());
  for (const locale of TRANSLATED) {
    for (const key of flatten(load(locale)).keys()) {
      assert.ok(enKeys.has(key), `${locale}.json has orphan key "${key}" not present in en.json`);
    }
  }
});

test('placeholders used in translations all exist in the en counterpart (no typos)', () => {
  const en = flatten(load('en'));
  for (const locale of TRANSLATED) {
    for (const [key, val] of flatten(load(locale))) {
      const enPh = placeholders(en.get(key));
      for (const ph of placeholders(val)) {
        assert.ok(enPh.has(ph),
          `${locale}.json "${key}" uses {${ph}} which en.json's version does not define`);
      }
    }
  }
});

test('no emoji in any subject line, any locale', () => {
  for (const locale of ['en', ...TRANSLATED]) {
    for (const [key, val] of flatten(load(locale))) {
      if (!key.endsWith('.subject') && !key.endsWith('.subjectFallback')) continue;
      assert.ok(!EMOJI_RE.test(String(val)), `${locale}.json subject "${key}" contains emoji`);
    }
  }
});

test('translated catalogs are marked machineTranslated for QA tracking', () => {
  for (const locale of TRANSLATED) {
    assert.equal(load(locale)._meta?.machineTranslated, true,
      `${locale}.json missing _meta.machineTranslated flag`);
  }
});

// ===================== rendered output =====================

test('ar renders with dir="rtl"; en does not', () => {
  const templates = require('../utils/emailTemplates');
  const ar = templates.welcomeEmail('أحمد', 'ar');
  const en = templates.welcomeEmail('Alex', 'en');
  assert.ok(ar.html.includes('dir="rtl"'), 'ar html missing dir="rtl"');
  assert.ok(!en.html.includes('dir="rtl"'), 'en html unexpectedly has dir="rtl"');
});

test('rendering a full template in each translated locale produces localized subject + text', () => {
  const templates = require('../utils/emailTemplates');
  const enSubject = templates.weeklyDigest('Alex', { wordsReviewed: 2 }, null, 'en').subject;
  for (const locale of TRANSLATED) {
    const r = templates.weeklyDigest('Alex', { wordsReviewed: 2 }, null, locale);
    assert.ok(r.subject && r.subject !== enSubject, `${locale} digest subject not localized`);
    assert.ok(r.text.includes('2'), `${locale} digest text missing interpolated stat`);
    assert.ok(r.html.includes('Unsubscribe') === false, 'no unsubscribe expected without url');
  }
});

test('unsubscribe footer link text is localized', () => {
  const templates = require('../utils/emailTemplates');
  const ko = templates.weeklyDigest('Alex', {}, 'https://u.example/x', 'ko');
  assert.ok(ko.html.includes('수신 거부'), 'ko digest missing localized unsubscribe label');
});
