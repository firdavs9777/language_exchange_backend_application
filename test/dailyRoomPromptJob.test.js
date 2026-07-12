const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getDayOfYear,
  selectPromptForLanguage,
  shouldPostToday,
  isSameUtcDay
} = require('../lib/dailyRoomPrompt');

// ---------------------------------------------------------------------------
// getDayOfYear
// ---------------------------------------------------------------------------

test('getDayOfYear: Jan 1 is day 1', () => {
  assert.equal(getDayOfYear(new Date(Date.UTC(2026, 0, 1))), 1);
});

test('getDayOfYear: Jan 2 is day 2', () => {
  assert.equal(getDayOfYear(new Date(Date.UTC(2026, 0, 2))), 2);
});

test('getDayOfYear: Dec 31 of a non-leap year is day 365', () => {
  assert.equal(getDayOfYear(new Date(Date.UTC(2026, 11, 31))), 365);
});

// ---------------------------------------------------------------------------
// selectPromptForLanguage
// ---------------------------------------------------------------------------

test('selectPromptForLanguage: filters to the hub target language', () => {
  const prompts = [
    { _id: '1', language: 'en', text: 'en-a' },
    { _id: '2', language: 'ko', text: 'ko-a' },
    { _id: '3', language: 'en', text: 'en-b' }
  ];
  const date = new Date(Date.UTC(2026, 0, 1)); // dayOfYear = 1
  const prompt = selectPromptForLanguage(prompts, 'en', date);
  assert.equal(prompt.language, 'en');
  assert.ok(['en-a', 'en-b'].includes(prompt.text));
});

test('selectPromptForLanguage: deterministic day-of-year rotation (same prompt all day)', () => {
  const prompts = [
    { _id: '1', language: 'en', text: 'en-a' },
    { _id: '2', language: 'en', text: 'en-b' }
  ];
  const morning = new Date(Date.UTC(2026, 0, 1, 1, 0, 0));
  const night = new Date(Date.UTC(2026, 0, 1, 23, 0, 0));
  const a = selectPromptForLanguage(prompts, 'en', morning);
  const b = selectPromptForLanguage(prompts, 'en', night);
  assert.equal(a.text, b.text);
});

test('selectPromptForLanguage: rotates to a different prompt on a different day', () => {
  const prompts = [
    { _id: '1', language: 'en', text: 'en-a' },
    { _id: '2', language: 'en', text: 'en-b' }
  ];
  const day1 = selectPromptForLanguage(prompts, 'en', new Date(Date.UTC(2026, 0, 1)));
  const day2 = selectPromptForLanguage(prompts, 'en', new Date(Date.UTC(2026, 0, 2)));
  assert.notEqual(day1.text, day2.text);
});

test('selectPromptForLanguage: returns null when no prompts match the language (skip + log)', () => {
  const prompts = [{ _id: '1', language: 'en', text: 'en-a' }];
  const result = selectPromptForLanguage(prompts, 'ko', new Date());
  assert.equal(result, null);
});

test('selectPromptForLanguage: returns null for an empty prompts array', () => {
  assert.equal(selectPromptForLanguage([], 'en', new Date()), null);
});

// ---------------------------------------------------------------------------
// isSameUtcDay / shouldPostToday — same-day dedup guard
// ---------------------------------------------------------------------------

test('isSameUtcDay: true for two timestamps on the same UTC calendar day', () => {
  const a = new Date(Date.UTC(2026, 6, 12, 0, 5, 0));
  const b = new Date(Date.UTC(2026, 6, 12, 23, 50, 0));
  assert.equal(isSameUtcDay(a, b), true);
});

test('isSameUtcDay: false across a UTC day boundary', () => {
  const a = new Date(Date.UTC(2026, 6, 12, 23, 59, 59));
  const b = new Date(Date.UTC(2026, 6, 13, 0, 0, 1));
  assert.equal(isSameUtcDay(a, b), false);
});

test('shouldPostToday: true when no prior prompt message exists', () => {
  assert.equal(shouldPostToday(null, new Date()), true);
});

test('shouldPostToday: false when the last prompt message was posted earlier today (no double-post)', () => {
  const now = new Date(Date.UTC(2026, 6, 12, 18, 0, 0));
  const lastPromptMessage = { createdAt: new Date(Date.UTC(2026, 6, 12, 9, 0, 0)) };
  assert.equal(shouldPostToday(lastPromptMessage, now), false);
});

test('shouldPostToday: true when the last prompt message was posted on a previous day', () => {
  const now = new Date(Date.UTC(2026, 6, 12, 9, 0, 0));
  const lastPromptMessage = { createdAt: new Date(Date.UTC(2026, 6, 11, 9, 0, 0)) };
  assert.equal(shouldPostToday(lastPromptMessage, now), true);
});

test('shouldPostToday: handles a string createdAt (as it would come back from a lean() Mongo doc)', () => {
  const now = new Date(Date.UTC(2026, 6, 12, 18, 0, 0));
  const lastPromptMessage = { createdAt: new Date(Date.UTC(2026, 6, 12, 9, 0, 0)).toISOString() };
  assert.equal(shouldPostToday(lastPromptMessage, now), false);
});
