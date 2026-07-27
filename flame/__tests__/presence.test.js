const test = require('node:test');
const assert = require('node:assert/strict');
const presenceService = require('../services/presenceService');

test('markOnline: returns true only on the 0 -> 1 transition', () => {
  presenceService.reset();
  assert.equal(presenceService.markOnline('u1'), true, 'first connection flips online');
  assert.equal(presenceService.markOnline('u1'), false, 'second connection is already online');
  assert.equal(presenceService.markOnline('u1'), false, 'third connection is already online');
});

test('markOffline: returns true only on the -> 0 transition', () => {
  presenceService.reset();
  presenceService.markOnline('u1');
  presenceService.markOnline('u1');
  presenceService.markOnline('u1');
  assert.equal(presenceService.markOffline('u1'), false, 'still 2 connections left');
  assert.equal(presenceService.markOffline('u1'), false, 'still 1 connection left');
  assert.equal(presenceService.markOffline('u1'), true, 'last connection flips offline');
});

test('markOffline on an unknown/never-connected user does not go negative or report offline', () => {
  presenceService.reset();
  assert.equal(presenceService.markOffline('ghost'), false);
  assert.equal(presenceService.isOnline('ghost'), false);
});

test('multiple connections from the same user: isOnline stays true until the last disconnects', () => {
  presenceService.reset();
  presenceService.markOnline('u1');
  presenceService.markOnline('u1');
  assert.equal(presenceService.isOnline('u1'), true);
  presenceService.markOffline('u1');
  assert.equal(presenceService.isOnline('u1'), true, 'one connection remains');
  presenceService.markOffline('u1');
  assert.equal(presenceService.isOnline('u1'), false, 'all connections gone');
});

test('isOnline reflects independent per-user state', () => {
  presenceService.reset();
  presenceService.markOnline('u1');
  assert.equal(presenceService.isOnline('u1'), true);
  assert.equal(presenceService.isOnline('u2'), false);
});

test('onlineAmong filters a list of ids down to the ones currently online', () => {
  presenceService.reset();
  presenceService.markOnline('u1');
  presenceService.markOnline('u3');
  const result = presenceService.onlineAmong(['u1', 'u2', 'u3', 'u4']);
  assert.deepEqual(result.sort(), ['u1', 'u3']);
});

test('onlineAmong returns [] for a non-array input and for an empty list', () => {
  presenceService.reset();
  presenceService.markOnline('u1');
  assert.deepEqual(presenceService.onlineAmong([]), []);
  assert.deepEqual(presenceService.onlineAmong(undefined), []);
  assert.deepEqual(presenceService.onlineAmong(null), []);
});

test('reset clears all tracked presence state', () => {
  presenceService.markOnline('u1');
  presenceService.markOnline('u2');
  presenceService.reset();
  assert.equal(presenceService.isOnline('u1'), false);
  assert.equal(presenceService.isOnline('u2'), false);
});
