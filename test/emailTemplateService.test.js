const { test } = require('node:test');
const assert = require('node:assert/strict');

const { t, interpolate, resolveEmailLocale, isRtl } = require('../services/emailTemplateService');

// ===================== interpolation =====================

test('interpolate: replaces {placeholders} with vars', () => {
  assert.equal(interpolate('Hi {userName}, welcome to {appName}!', { userName: 'Alex', appName: 'Bananatalk' }),
    'Hi Alex, welcome to Bananatalk!');
});

test('interpolate: missing placeholder is left intact (visible, not silent)', () => {
  assert.equal(interpolate('Hi {userName}!', {}), 'Hi {userName}!');
});

// ===================== t() lookup + fallback =====================

test('t: resolves an en key with vars', () => {
  assert.equal(t('en', 'welcome.subject', { appName: 'Bananatalk', userName: 'Alex' }),
    'Welcome to Bananatalk, Alex!');
});

test('t: unknown locale falls back to en wholesale', () => {
  assert.equal(t('xx', 'welcome.subject', { appName: 'Bananatalk', userName: 'Alex' }),
    'Welcome to Bananatalk, Alex!');
});

test('t: null/undefined locale falls back to en', () => {
  assert.equal(t(null, 'weeklyDigest.subject'), 'Your language learning week');
  assert.equal(t(undefined, 'weeklyDigest.subject'), 'Your language learning week');
});

test('t: per-KEY fallback — key missing from a translated catalog resolves from en', () => {
  // Translated catalogs intentionally omit keys whose value equals English
  // (e.g. store-brand names) — those must fall back to en per key.
  assert.equal(t('ko', 'common.appStore'), 'App Store');
  assert.equal(t('ko', 'common.googlePlay'), 'Google Play');
});

test('t: translated key resolves from the locale catalog, not en', () => {
  assert.notEqual(t('ko', 'welcome.heading', { appName: 'Bananatalk' }),
    t('en', 'welcome.heading', { appName: 'Bananatalk' }));
});

test('t: array values are returned as interpolated arrays', () => {
  const features = t('en', 'welcome.features');
  assert.ok(Array.isArray(features));
  assert.equal(features.length, 4);
});

test('t: unknown key throws (programming error, not a render fallback)', () => {
  assert.throws(() => t('en', 'not.a.real.key'));
});

// ===================== locale resolution + RTL =====================

test('resolveEmailLocale: stored preferredLocale wins, missing falls back to en', () => {
  assert.equal(resolveEmailLocale({ preferredLocale: 'ko' }), 'ko');
  assert.equal(resolveEmailLocale({ preferredLocale: null }), 'en');
  assert.equal(resolveEmailLocale({}), 'en');
  assert.equal(resolveEmailLocale(null), 'en');
});

test('isRtl: ar is RTL, everything else is not', () => {
  assert.equal(isRtl('ar'), true);
  assert.equal(isRtl('en'), false);
  assert.equal(isRtl('he'), false); // not a supported email locale today
});
