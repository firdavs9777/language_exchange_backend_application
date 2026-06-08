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

test('checkBannedIdentity — returns banned:true with reason:null when match has no reason', async () => {
  mockFindOne.mock.mockImplementationOnce(() =>
    Promise.resolve({ reason: undefined })
  );
  const result = await banService.checkBannedIdentity({ email: 'noreason@b.com' });
  assert.deepEqual(result, { banned: true, reason: null });
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
  mockCreate.mock.mockImplementationOnce(() => Promise.resolve({ _id: 'bannedDoc1' }));
  mockUserFindByIdAndDelete.mock.mockImplementationOnce(() => Promise.resolve({}));
  mockAuditLogAction.mock.mockImplementationOnce(() => Promise.resolve());

  const callsBefore = mockCreate.mock.calls.length;
  const deleteBefore = mockUserFindByIdAndDelete.mock.calls.length;

  const result = await banService.hardDeleteUser({ userId: 'abc123', moderatorId: 'mod1' });
  assert.equal(result.ok, true);
  assert.equal(mockCreate.mock.calls.length, callsBefore + 1);
  assert.equal(mockUserFindByIdAndDelete.mock.calls.length, deleteBefore + 1);

  // Verify the payload passed to BannedIdentity.create
  const createPayload = mockCreate.mock.calls[callsBefore].arguments[0];
  assert.equal(createPayload.email, 'bad@b.com');
  assert.equal(createPayload.moderatorId, 'mod1');
  assert.equal(createPayload.originalUserId, 'abc123');
});

test('hardDeleteUser — calls BannedIdentity.deleteOne for rollback when User.findByIdAndDelete throws', async () => {
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
  mockCreate.mock.mockImplementationOnce(() => Promise.resolve({ _id: 'bannedDoc2' }));
  mockUserFindByIdAndDelete.mock.mockImplementationOnce(() =>
    Promise.reject(new Error('DB error'))
  );
  mockDeleteOne.mock.mockImplementationOnce(() => Promise.resolve());

  const deleteOneBefore = mockDeleteOne.mock.calls.length;

  await assert.rejects(
    () => banService.hardDeleteUser({ userId: 'abc123', moderatorId: 'mod1' }),
    /DB error/
  );

  // Give the fire-and-forget deleteOne a tick to run
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(mockDeleteOne.mock.calls.length, deleteOneBefore + 1);
  const rollbackQuery = mockDeleteOne.mock.calls[deleteOneBefore].arguments[0];
  assert.deepEqual(rollbackQuery, { _id: 'bannedDoc2' });
});
