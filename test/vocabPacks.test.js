const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { validateVocabPacksData, VALID_LEVELS } = require('../lib/vocabPackShape');

// ---------------------------------------------------------------------------
// validateVocabPacksData — the H9 seeder gate. The seeder must refuse
// malformed content instead of half-seeding it.
// ---------------------------------------------------------------------------

const goodPack = (over = {}) => ({
  level: 'intermediate',
  topic: 'Travel',
  words: [
    { word: 'itinerary', definition: 'a planned route of a journey', example: 'Our itinerary includes three cities.', translationHint: 'travel plan' },
    { word: 'landmark', definition: 'a famous or easily recognized place', example: 'The tower is the city’s best-known landmark.' },
  ],
  ...over,
});

test('valid data passes', () => {
  const r = validateVocabPacksData([goodPack(), goodPack({ level: 'advanced', topic: 'Work' })]);
  assert.deepEqual(r, { valid: true, errors: [] });
});

test('rejects non-array / empty input', () => {
  assert.equal(validateVocabPacksData(null).valid, false);
  assert.equal(validateVocabPacksData({}).valid, false);
  assert.equal(validateVocabPacksData([]).valid, false);
});

test('rejects unknown level', () => {
  const r = validateVocabPacksData([goodPack({ level: 'beginner' })]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /level/);
});

test('rejects missing topic and empty words', () => {
  assert.equal(validateVocabPacksData([goodPack({ topic: ' ' })]).valid, false);
  assert.equal(validateVocabPacksData([goodPack({ words: [] })]).valid, false);
});

test('rejects word entries missing required fields', () => {
  const bad = goodPack();
  bad.words.push({ word: 'orphan', definition: '' , example: 'x' });
  const r = validateVocabPacksData([bad]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /definition is required/);
});

test('rejects duplicate words within a pack (case-insensitive)', () => {
  const bad = goodPack();
  bad.words.push({ word: 'Itinerary', definition: 'dup', example: 'dup ex' });
  const r = validateVocabPacksData([bad]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /duplicate word/);
});

test('rejects duplicate (level, topic) pack pairs', () => {
  const r = validateVocabPacksData([goodPack(), goodPack()]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /duplicate \(level, topic\)/);
});

test('translationHint is optional but must be a string', () => {
  const bad = goodPack();
  bad.words[0].translationHint = 42;
  assert.equal(validateVocabPacksData([bad]).valid, false);
});

// ---------------------------------------------------------------------------
// Exercises — optional, but shape-validated when present.
// ---------------------------------------------------------------------------

const withExercises = (exercises) => goodPack({ topic: 'Travel', exercises });

test('valid exercises of every type pass', () => {
  const r = validateVocabPacksData([withExercises([
    { type: 'multiple_choice', prompt: 'Pick one', options: ['a', 'b', 'c'], answerIndex: 1, targetWord: 'itinerary' },
    { type: 'fill_blank', prompt: 'Our ___ has three cities.', answer: 'itinerary', targetWord: 'itinerary' },
    { type: 'error_correction', prompt: 'wrong', corrected: 'right', targetWord: 'landmark' },
    { type: 'matching', pairs: [{ term: 'itinerary', definition: 'travel plan' }, { term: 'landmark', definition: 'famous place' }] },
  ])]);
  assert.deepEqual(r, { valid: true, errors: [] });
});

test('exercises must be an array when present', () => {
  const r = validateVocabPacksData([goodPack({ exercises: 'nope' })]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /exercises must be an array/);
});

test('rejects unknown exercise type', () => {
  const r = validateVocabPacksData([withExercises([{ type: 'crossword' }])]);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('\n'), /type must be one of/);
});

test('multiple_choice needs prompt, >=2 options, valid answerIndex', () => {
  assert.equal(validateVocabPacksData([withExercises([{ type: 'multiple_choice', options: ['a', 'b'], answerIndex: 0 }])]).valid, false);
  assert.equal(validateVocabPacksData([withExercises([{ type: 'multiple_choice', prompt: 'q', options: ['a'], answerIndex: 0 }])]).valid, false);
  assert.equal(validateVocabPacksData([withExercises([{ type: 'multiple_choice', prompt: 'q', options: ['a', 'b'], answerIndex: 5 }])]).valid, false);
});

test('fill_blank needs prompt and answer; matching needs >=2 pairs', () => {
  assert.equal(validateVocabPacksData([withExercises([{ type: 'fill_blank', prompt: 'q' }])]).valid, false);
  assert.equal(validateVocabPacksData([withExercises([{ type: 'matching', pairs: [{ term: 'x', definition: 'y' }] }])]).valid, false);
});

// ---------------------------------------------------------------------------
// The shipped migrations/vocabPacksData.json must itself pass validation and
// cover both levels, so the seeder machinery is provably runnable.
// ---------------------------------------------------------------------------

test('migrations/vocabPacksData.json is valid and covers both levels', () => {
  const p = path.join(__dirname, '..', 'migrations', 'vocabPacksData.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const r = validateVocabPacksData(data);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
  for (const level of VALID_LEVELS) {
    assert.ok(data.some(pack => pack.level === level), `data must include a ${level} pack`);
  }
});
