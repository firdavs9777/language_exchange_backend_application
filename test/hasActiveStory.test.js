const { test } = require('node:test');
const assert = require('node:assert/strict');
const { visibleOwners, VISIBLE_PRIVACIES } = require('../lib/activeStoryFlags');

test('public stories are always visible, regardless of following', () => {
  const stories = [{ user: 'owner1', privacy: 'public' }];
  const followingSet = new Set(); // viewer follows nobody
  assert.deepEqual(visibleOwners(stories, followingSet), new Set(['owner1']));
});

test('friends-privacy stories are visible when the viewer follows the owner', () => {
  const stories = [{ user: 'owner2', privacy: 'friends' }];
  const followingSet = new Set(['owner2']);
  assert.deepEqual(visibleOwners(stories, followingSet), new Set(['owner2']));
});

test('friends-privacy stories are hidden when the viewer does not follow the owner', () => {
  const stories = [{ user: 'owner3', privacy: 'friends' }];
  const followingSet = new Set(); // not following owner3
  assert.deepEqual(visibleOwners(stories, followingSet), new Set());
});

test('VISIBLE_PRIVACIES excludes close_friends (so the DB query never fetches them)', () => {
  assert.deepEqual(VISIBLE_PRIVACIES, ['public', 'friends']);
  assert.ok(!VISIBLE_PRIVACIES.includes('close_friends'));
});

test('mixed set: only owners with a visible story end up in the result', () => {
  const stories = [
    { user: 'a', privacy: 'public' },
    { user: 'b', privacy: 'friends' }, // followed
    { user: 'c', privacy: 'friends' }, // not followed
  ];
  const followingSet = new Set(['b']);
  assert.deepEqual(visibleOwners(stories, followingSet), new Set(['a', 'b']));
});
