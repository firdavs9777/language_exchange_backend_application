const { test } = require('node:test');
const assert = require('node:assert/strict');
const { score, PRONUNCIATION_WRONG_THRESHOLD } = require('./pronunciationScoring');

test('exact match returns 100 and all ok', () => {
  const r = score('I walked to the park yesterday', 'I walked to the park yesterday.');
  assert.equal(r.overallScore, 100);
  assert.equal(r.wordScores.every(w => w.status === 'ok'), true);
  assert.equal(r.wordScores.every(w => w.charDiff === null), true);
});

test('one char off (par for park) marks wrong with charDiff', () => {
  const r = score('I walked to the par yesterday', 'I walked to the park yesterday.');
  const park = r.wordScores.find(w => w.word === 'park');
  assert.equal(park.status, 'wrong');
  assert.ok(Array.isArray(park.charDiff));
  assert.deepEqual(park.charDiff.map(c => c.match), [true, true, true, false]);
  assert.ok(r.overallScore >= 50 && r.overallScore < 100);
});

test('completely different word (doodle for park) marks missing', () => {
  const r = score('I walked to the doodle yesterday', 'I walked to the park yesterday.');
  const park = r.wordScores.find(w => w.word === 'park');
  assert.equal(park.status, 'missing');
  assert.equal(park.charDiff, null);
});

test('empty transcript: all words missing, score 0', () => {
  const r = score('', 'I walked to the park yesterday.');
  assert.equal(r.overallScore, 0);
  assert.equal(r.wordScores.every(w => w.status === 'missing'), true);
});

test('extra words in transcript are silently dropped', () => {
  const r = score('I walked to the park yesterday and stuff', 'I walked to the park yesterday.');
  assert.equal(r.overallScore, 100);
  assert.equal(r.wordScores.length, 6);
});

test('missing word in transcript marked missing', () => {
  const r = score('I walked to park yesterday', 'I walked to the park yesterday.');
  const the = r.wordScores.find(w => w.word === 'the');
  assert.equal(the.status, 'missing');
});

test('punctuation is stripped before comparison', () => {
  const r = score('Hello, world!', 'Hello world.');
  assert.equal(r.overallScore, 100);
});

test('case is normalized (uppercase transcript matches lowercase target)', () => {
  const r = score('HELLO WORLD', 'hello world');
  assert.equal(r.overallScore, 100);
});

test('threshold boundary: ratio 0.75 is wrong (above 0.6)', () => {
  // "park" (4) vs "par" (3) → editDist 1, ratio = 1 - 1/4 = 0.75
  const r = score('par', 'park');
  assert.equal(r.wordScores[0].status, 'wrong');
});

test('threshold boundary: ratio 0.25 is missing (below 0.6)', () => {
  // "park" (4) vs "pop" (3) → editDist 3, ratio = 1 - 3/4 = 0.25
  const r = score('pop', 'park');
  assert.equal(r.wordScores[0].status, 'missing');
});

test('longer words weighted more than shorter (yesterday wrong > the wrong)', () => {
  const longWrong = score('I walked to the park yesturday', 'I walked to the park yesterday');
  const shortWrong = score('I walked too the park yesterday', 'I walked to the park yesterday');
  // both have one near-miss; yesterday is longer → harder hit on score
  assert.ok(longWrong.overallScore < shortWrong.overallScore);
});

test('unicode (Korean) tokenization works', () => {
  const r = score('안녕하세요', '안녕하세요');
  assert.equal(r.overallScore, 100);
});

test('one-word target sentence: exact match', () => {
  const r = score('hello', 'Hello!');
  assert.equal(r.overallScore, 100);
});

test('threshold constant is exposed', () => {
  assert.equal(PRONUNCIATION_WRONG_THRESHOLD, 0.6);
});

test('returns the normalized transcript in the result', () => {
  const r = score('Hello, World!', 'hello world');
  assert.equal(typeof r.transcript, 'string');
  assert.ok(r.transcript.length > 0);
});
