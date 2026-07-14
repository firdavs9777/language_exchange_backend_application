const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeLocale, SUPPORTED_LOCALES } = require('../lib/normalizeLocale');

test('SUPPORTED_LOCALES matches the notification_templates directory', () => {
  const dir = path.join(__dirname, '..', 'notification_templates');
  const onDisk = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
  assert.deepEqual([...SUPPORTED_LOCALES].sort(), onDisk);
});

test('device locale tags normalize to supported codes', () => {
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('ko_KR'), 'ko');
  assert.equal(normalizeLocale('ja-JP'), 'ja');
  assert.equal(normalizeLocale('pt_BR'), 'pt');
  assert.equal(normalizeLocale('ru'), 'ru');
  assert.equal(normalizeLocale('fil-PH'), 'tl'); // Filipino → Tagalog
  assert.equal(normalizeLocale('in-ID'), 'id');  // legacy Android Indonesian
});

test('Chinese script/region disambiguation', () => {
  assert.equal(normalizeLocale('zh-Hans-CN'), 'zh');
  assert.equal(normalizeLocale('zh_CN'), 'zh');
  assert.equal(normalizeLocale('zh'), 'zh');
  assert.equal(normalizeLocale('zh-Hant-TW'), 'zh_TW');
  assert.equal(normalizeLocale('zh_TW'), 'zh_TW');
  assert.equal(normalizeLocale('zh-HK'), 'zh_TW');
  assert.equal(normalizeLocale('yue-HK'), 'zh_TW'); // Cantonese
});

test('native_language display names (backfill inputs)', () => {
  assert.equal(normalizeLocale('Chinese (Simplified)'), 'zh');
  assert.equal(normalizeLocale('Chinese (Traditional)'), 'zh_TW');
  assert.equal(normalizeLocale('Arabic'), 'ar');
  assert.equal(normalizeLocale('Russian'), 'ru');
  assert.equal(normalizeLocale('English (US)'), 'en');
  assert.equal(normalizeLocale('한국어'), 'ko');
  assert.equal(normalizeLocale('Tajik'), 'tg');
});

test('unknown/unsupported inputs return null (renderer falls back to en)', () => {
  assert.equal(normalizeLocale(''), null);
  assert.equal(normalizeLocale(null), null);
  assert.equal(normalizeLocale(undefined), null);
  assert.equal(normalizeLocale('Uzbek'), null);
  assert.equal(normalizeLocale('my-MM'), null); // Burmese not supported
  assert.equal(normalizeLocale('!!!'), null);
});

test('every normalized output is a supported locale', () => {
  const inputs = ['en-US', 'ko_KR', 'zh-Hant-TW', 'Chinese (Simplified)', 'Arabic', 'fil', 'pt_BR', 'Tajik'];
  for (const input of inputs) {
    const out = normalizeLocale(input);
    assert.ok(SUPPORTED_LOCALES.includes(out), `${input} → ${out} not in SUPPORTED_LOCALES`);
  }
});
