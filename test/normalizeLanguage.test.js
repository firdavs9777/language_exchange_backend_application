const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLanguage, CANONICAL, ALIASES } = require('../lib/normalizeLanguage');

test('maps display names to canonical ISO', () => {
  assert.equal(normalizeLanguage('English'), 'en');
  assert.equal(normalizeLanguage('English (US)'), 'en');
  assert.equal(normalizeLanguage('English (UK)'), 'en');
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('Chinese (Simplified)'), 'zh');
  assert.equal(normalizeLanguage('Chinese (Traditional)'), 'zh');
  assert.equal(normalizeLanguage('Chinese'), 'zh');
  assert.equal(normalizeLanguage('zh'), 'zh');
  assert.equal(normalizeLanguage('中文'), 'zh');
  assert.equal(normalizeLanguage('Korean'), 'ko');
  assert.equal(normalizeLanguage('ko'), 'ko');
  assert.equal(normalizeLanguage('한국어'), 'ko');
  assert.equal(normalizeLanguage('Japanese'), 'ja');
  assert.equal(normalizeLanguage('ja'), 'ja');
  assert.equal(normalizeLanguage('日本語'), 'ja');
  assert.equal(normalizeLanguage('Arabic'), 'ar');
  assert.equal(normalizeLanguage('ar'), 'ar');
  assert.equal(normalizeLanguage('Spanish'), 'es');
  assert.equal(normalizeLanguage('es'), 'es');
  assert.equal(normalizeLanguage('German'), 'de');
  assert.equal(normalizeLanguage('de'), 'de');
  assert.equal(normalizeLanguage('French'), 'fr');
  assert.equal(normalizeLanguage('fr'), 'fr');
});

test('is case/space tolerant', () => {
  assert.equal(normalizeLanguage('  korean '), 'ko');
  assert.equal(normalizeLanguage('ENGLISH'), 'en');
  assert.equal(normalizeLanguage('  Chinese (Simplified)  '), 'zh');
  assert.equal(normalizeLanguage('SpAnIsH'), 'es');
});

test('returns null for empty/unknown (no auto-join)', () => {
  assert.equal(normalizeLanguage(''), null);
  assert.equal(normalizeLanguage(null), null);
  assert.equal(normalizeLanguage(undefined), null);
  assert.equal(normalizeLanguage('Klingon'), null);
  assert.equal(normalizeLanguage(42), null);
  assert.equal(normalizeLanguage('   '), null);
});

test('exposes CANONICAL list and ALIASES map', () => {
  assert.deepEqual(CANONICAL, ['en', 'ko', 'ja', 'zh', 'ar', 'es', 'de', 'fr']);
  assert.equal(ALIASES['english'], 'en');
  assert.equal(ALIASES['chinese (simplified)'], 'zh');
});
