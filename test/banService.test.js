const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

// ALL mock.module calls before require('../services/banService')
const mockFindOne        = mock.fn();
const mockCreate         = mock.fn();
const mockDeleteOne      = mock.fn();
const mockUserFindById   = mock.fn();
const mockUserFindByIdAndDelete = mock.fn();
const mockAuditLogAction = mock.fn();

mock.module('../models/BannedIdentity.js', {
  defaultExport: {
    findOne:   mockFindOne,
    create:    mockCreate,
    deleteOne: mockDeleteOne,
  },
});

mock.module('../models/User.js', {
  defaultExport: {
    findById:          mockUserFindById,
    findByIdAndUpdate: mock.fn(),
    findByIdAndDelete: mockUserFindByIdAndDelete,
  },
});

mock.module('../models/AdminAuditLog.js', {
  defaultExport: { logAction: mockAuditLogAction },
});

// Load banService AFTER all mocks
const banService = require('../services/banService');

// checkBannedIdentity tests
test('checkBannedIdentity — returns banned:false when no match', async () => {
  mockFindOne.mock.mockImplementationOnce(() => Promise.resolve(null));
  const result = await banService.checkBannedIdentity({ email: 'a@b.com' });
  assert.deepEqual(result, { banned: false });
});

test('checkBannedIdentity — returns banned:true with reason when match found', async () => {
  mockFindOne.mock.mockImplementationOnce(() =>
    Promise.resolve({ reason: 'spam' })
  );
  const result = await banService.checkBannedIdentity({ email: 'bad@b.com' });
  assert.deepEqual(result, { banned: true, reason: 'spam' });
});

test('checkBannedIdentity — excludes undefined fields from $or query', async () => {
  mockFindOne.mock.mockImplementationOnce((query) => {
    assert.equal(query.$or.length, 1);
    assert.deepEqual(query.$or[0], { email: 'x@y.com' });
    return Promise.resolve(null);
  });
  await banService.checkBannedIdentity({ email: 'x@y.com' });
});

test('checkBannedIdentity — returns banned:false immediately when no identifiers provided', async () => {
  const callsBefore = mockFindOne.mock.calls.length;
  const result = await banService.checkBannedIdentity({});
  assert.deepEqual(result, { banned: false });
  assert.equal(mockFindOne.mock.calls.length, callsBefore); // no DB call made
});

// hardDeleteUser tests
test('hardDeleteUser — returns error when user not found', async () => {
  mockUserFindById.mock.mockImplementationOnce(() => Promise.resolve(null));
  const result = await banService.hardDeleteUser({ userId: 'abc123', moderatorId: 'mod1' });
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);
});

test('hardDeleteUser — returns error when user is not banned', async () => {
  mockUserFindById.mock.mockImplementationOnce(() =>
    Promise.resolve({ _id: 'abc123', isBanned: false })
  );
  const result = await banService.hardDeleteUser({ userId: 'abc123', moderatorId: 'mod1' });
  assert.equal(result.ok, false);
  assert.match(result.error, /not banned/i);
});

test('hardDeleteUser — creates BannedIdentity and deletes user on success', async () => {
  const fakeUser = {
    _id: 'abc123',
    isBanned: true,
    email: 'bad@b.com',
    googleId: null,
    facebookId: null,
    appleId: null,
    banReason: 'spam',
    bannedAt: new Date('2026-01-01'),
  };
  mockUserFindById.mock.mockImplementationOnce(() => Promise.resolve(fakeUser));
  mockCreate.mock.mockImplementationOnce(() => Promise.resolve({}));
  mockUserFindByIdAndDelete.mock.mockImplementationOnce(() => Promise.resolve({}));
  mockAuditLogAction.mock.mockImplementationOnce(() => Promise.resolve());

  const callsBefore = mockCreate.mock.calls.length;
  const deleteBefore = mockUserFindByIdAndDelete.mock.calls.length;

  const result = await banService.hardDeleteUser({ userId: 'abc123', moderatorId: 'mod1' });
  assert.equal(result.ok, true);
  assert.equal(mockCreate.mock.calls.length, callsBefore + 1);
  assert.equal(mockUserFindByIdAndDelete.mock.calls.length, deleteBefore + 1);
});
