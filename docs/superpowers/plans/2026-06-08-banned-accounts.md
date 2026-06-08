# Banned Accounts — Hard Delete & Permanent Blacklist Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to hard-delete banned accounts and permanently prevent re-registration via the same email or social IDs (Google, Facebook, Apple).

**Architecture:** A new `BannedIdentity` collection stores identifiers from deleted banned users. `banService` gets two new functions: `checkBannedIdentity` (used at every auth entry point) and `hardDeleteUser` (creates BannedIdentity, deletes User). Two new admin endpoints expose the banned user list and the hard-delete action.

**Tech Stack:** Node.js, Express, Mongoose/MongoDB, Passport.js (Google + Facebook strategies), Node v25 built-in test runner (`node:test` with `--experimental-test-module-mocks`)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `models/BannedIdentity.js` | **Create** | Blacklist collection — stores email + social IDs of deleted banned users |
| `services/banService.js` | **Modify** | Add `checkBannedIdentity()` and `hardDeleteUser()` |
| `test/banService.test.js` | **Create** | Unit tests for the two new service functions |
| `controllers/admin.js` | **Modify** | Add `getBannedUsers()` and `hardDeleteUser()` controller functions |
| `routes/admin.js` | **Modify** | Register `GET /banned-users` and `DELETE /users/:id`; update imports |
| `controllers/auth.js` | **Modify** | Add `checkBannedIdentity` calls at 5 direct entry points + 2 Passport strategy callbacks + 2 callback controller error handlers |

---

## Task 1: BannedIdentity Model

**Files:**
- Create: `models/BannedIdentity.js`

- [ ] **Step 1: Create the model**

```js
// models/BannedIdentity.js
const mongoose = require('mongoose');

const BannedIdentitySchema = new mongoose.Schema(
  {
    email:          { type: String, index: true, sparse: true },
    googleId:       { type: String, index: true, sparse: true },
    facebookId:     { type: String, index: true, sparse: true },
    appleId:        { type: String, index: true, sparse: true },
    reason:         { type: String, default: null },
    bannedAt:       { type: Date, default: null },
    deletedAt:      { type: Date, default: null },
    moderatorId:    { type: String, default: null },
    originalUserId: { type: String, default: null },
  },
  { timestamps: false }
);

BannedIdentitySchema.pre('validate', function (next) {
  if (!this.email && !this.googleId && !this.facebookId && !this.appleId) {
    return next(new Error('At least one identity field is required'));
  }
  next();
});

module.exports = mongoose.model('BannedIdentity', BannedIdentitySchema);
```

- [ ] **Step 2: Commit**

```bash
git add models/BannedIdentity.js
git commit -m "feat(model): add BannedIdentity schema for permanent account blacklist"
```

---

## Task 2: banService — `checkBannedIdentity`

**Files:**
- Modify: `services/banService.js` (append after existing exports)
- Create: `test/banService.test.js`

> **Test note:** Node v25 requires the `--experimental-test-module-mocks` flag for `mock.module()`. All mock.module calls MUST appear before the first `require('../services/banService')` call — otherwise the service will load the real Mongoose models before the mocks are registered and the mocks will have no effect.

- [ ] **Step 1: Write the failing test**

Create `test/banService.test.js` with the COMPLETE file contents below (Tasks 2 and 3 tests are combined in one file because `mock.module` registrations must all precede the single `banService` require):

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

// ─── ALL mock.module calls MUST come before require('../services/banService') ───
// Node v25: mock.module intercepts the module at load time; registering after
// the service is loaded has no effect.

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

// ─── Load banService after all mocks are registered ───────────────────────────
const banService = require('../services/banService');

// ─── checkBannedIdentity tests ────────────────────────────────────────────────

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

// ─── hardDeleteUser tests ─────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/davis/Desktop/Personal/language_exchange_backend_application
node --experimental-test-module-mocks --test test/banService.test.js
```

Expected: fails with `banService.checkBannedIdentity is not a function` (and `banService.hardDeleteUser is not a function`)

- [ ] **Step 3: Add `checkBannedIdentity` and `hardDeleteUser` to `services/banService.js`**

First, add `BannedIdentity` to the require block at the top of `banService.js` (alongside the existing model requires):
```js
const BannedIdentity = require('../models/BannedIdentity');
```

Then append both functions at the end of the file:

```js
exports.checkBannedIdentity = async function ({ email, googleId, facebookId, appleId } = {}) {
  const conditions = [];
  if (email)      conditions.push({ email });
  if (googleId)   conditions.push({ googleId });
  if (facebookId) conditions.push({ facebookId });
  if (appleId)    conditions.push({ appleId });

  if (conditions.length === 0) return { banned: false };

  const match = await BannedIdentity.findOne({ $or: conditions });
  if (!match) return { banned: false };
  return { banned: true, reason: match.reason || null };
};

exports.hardDeleteUser = async function ({ userId, moderatorId }) {
  const user = await User.findById(userId);

  if (!user) {
    return { ok: false, error: 'User not found' };
  }

  if (!user.isBanned) {
    return { ok: false, error: 'User is not banned — ban the account first' };
  }

  await BannedIdentity.create({
    email:          user.email || null,
    googleId:       user.googleId || null,
    facebookId:     user.facebookId || null,
    appleId:        user.appleId || null,
    reason:         user.banReason || null,
    bannedAt:       user.bannedAt || null,
    deletedAt:      new Date(),
    moderatorId:    String(moderatorId),
    originalUserId: String(user._id),
  });

  try {
    await User.findByIdAndDelete(userId);
  } catch (err) {
    BannedIdentity.deleteOne({ originalUserId: String(userId) }).catch((rbErr) =>
      console.error('[banService] hardDeleteUser rollback failed:', rbErr.message)
    );
    throw err;
  }

  AdminAuditLog.logAction({
    moderator: moderatorId,
    action: 'user_hard_deleted',
    target: userId,
    reason: user.banReason || null,
    source: 'manual',
  }).catch((err) =>
    console.error('[banService] hardDeleteUser audit log failed:', err.message)
  );

  return { ok: true };
};
```

- [ ] **Step 4: Run all tests**

```bash
node --experimental-test-module-mocks --test test/banService.test.js
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/banService.js test/banService.test.js
git commit -m "feat(service): add checkBannedIdentity and hardDeleteUser to banService"
```

---

## Task 3: Admin Controller — `getBannedUsers` and `hardDeleteUser`

**Files:**
- Modify: `controllers/admin.js`

- [ ] **Step 1: Add `getBannedUsers` to `controllers/admin.js`**

Add after `exports.searchUsers` (around line 62). `BannedIdentity` is NOT needed in this file — `getBannedUsers` queries `User` directly and `hardDeleteUser` delegates to `banService`. Do NOT add a BannedIdentity require.

```js
/**
 * @desc    List all currently banned user accounts (with OAuth IDs for blacklist preview).
 * @route   GET /api/v1/admin/banned-users
 * @access  Admin
 */
exports.getBannedUsers = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const filter = { isBanned: true };
  if (req.query.search && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ email: rx }, { name: rx }, { username: rx }];
  }

  const BANNED_USER_FIELDS =
    '_id name email username images isBanned banReason bannedAt googleId facebookId appleId createdAt';

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(BANNED_USER_FIELDS)
      .sort({ bannedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: users,
    pagination: { total, page, limit, hasMore: skip + users.length < total },
  });
});
```

- [ ] **Step 2: Add `hardDeleteUser` to `controllers/admin.js`**

```js
/**
 * @desc    Permanently delete a banned user account and blacklist their identifiers.
 * @route   DELETE /api/v1/admin/users/:id
 * @access  Admin
 */
exports.hardDeleteUser = asyncHandler(async (req, res, next) => {
  const result = await banService.hardDeleteUser({
    userId: req.params.id,
    moderatorId: req.user.id,
  });

  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    return next(new ErrorResponse(result.error, status));
  }

  res.status(200).json({ success: true, message: 'Account permanently deleted and blacklisted.' });
});
```

> `banService` is already required at the top of `controllers/admin.js` — no new require needed.

- [ ] **Step 3: Commit**

```bash
git add controllers/admin.js
git commit -m "feat(admin): add getBannedUsers and hardDeleteUser controllers"
```

---

## Task 4: Admin Routes

**Files:**
- Modify: `routes/admin.js`

- [ ] **Step 1: Update imports and register new routes**

Open `routes/admin.js`. The current import block looks like:
```js
const {
  searchUsers,
  getUserDetail,
  banUser,
  unbanUser,
  changeRole,
  getAuditLog,
  getStats,
  getAIUsage,
  getAIUsageLogs,
  getActivity,
} = require('../controllers/admin');
```

Replace with:
```js
const {
  searchUsers,
  getUserDetail,
  banUser,
  unbanUser,
  changeRole,
  getAuditLog,
  getStats,
  getAIUsage,
  getAIUsageLogs,
  getActivity,
  getBannedUsers,
  hardDeleteUser,
} = require('../controllers/admin');
```

Then add the two new routes after the existing user routes (after the `unban` line):
```js
router.get('/banned-users', getBannedUsers);
router.delete('/users/:id', hardDeleteUser);
```

- [ ] **Step 2: Commit**

```bash
git add routes/admin.js
git commit -m "feat(routes): register GET /admin/banned-users and DELETE /admin/users/:id"
```

---

## Task 5: Auth Block Checks — Direct Entry Points

**Files:**
- Modify: `controllers/auth.js`

- [ ] **Step 0: Add `banService` require to `controllers/auth.js`**

Find the block of service/utility requires near the top of `controllers/auth.js`. Add:
```js
const banService = require('../services/banService');
```

This line must be added — `auth.js` does not currently require `banService`.

- [ ] **Step 1: `sendVerificationCode` (email only)**

Find `exports.sendVerificationCode` (~line 721). The function starts with:
```js
exports.sendVerificationCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
```

After `const { email } = req.body;` and any email-format validation, before the first `User.findOne`, add:
```js
  const banCheck = await banService.checkBannedIdentity({ email });
  if (banCheck.banned) {
    return next(new ErrorResponse('This account has been permanently suspended and cannot be reactivated.', 403));
  }
```

- [ ] **Step 2: `register` (email only)**

Find `exports.register` (~line 357). After the required-fields validation block, before `const user = await User.findOne({ email })`, add the same pattern with `{ email }`.

- [ ] **Step 3: `login` (email only)**

Find `exports.login` (~line 457). After `if (!email || !password)` check, before `const user = await User.findOne(...)`, add the same pattern with `{ email }`.

- [ ] **Step 4: `googleMobileLogin` (googleId + email)**

Find `exports.googleMobileLogin` (~line 1406). After the token is verified and these variables are extracted:
```js
const { sub: googleId, email, name, picture } = payload;
```
Add:
```js
  const banCheck = await banService.checkBannedIdentity({ googleId, email });
  if (banCheck.banned) {
    return next(new ErrorResponse('This account has been permanently suspended and cannot be reactivated.', 403));
  }
```

- [ ] **Step 5: `appleMobileLogin` (appleId + email)**

Find `exports.appleMobileLogin` (~line 147). After:
```js
const { sub: appleId, email } = appleResponse;
```
Add:
```js
  const banCheck = await banService.checkBannedIdentity({ appleId, email: email || null });
  if (banCheck.banned) {
    return next(new ErrorResponse('This account has been permanently suspended and cannot be reactivated.', 403));
  }
```

- [ ] **Step 6: Commit**

```bash
git add controllers/auth.js
git commit -m "feat(auth): block permanently-deleted accounts at email/mobile OAuth entry points"
```

---

## Task 6: Auth Block Checks — Passport Strategy Callbacks

**Files:**
- Modify: `controllers/auth.js`

These checks go **inside** the Passport strategy async callbacks (registered at the top of the file with `passport.use(...)`), before any `User.findOne` or `User.create` call.

- [ ] **Step 1: `FacebookStrategy` callback**

Find the `FacebookStrategy` callback (~line 35). The exact code to find:
```js
    const email = emails && emails[0] ? emails[0].value : null;
        
    // Try to find existing user by Facebook ID first
    let user = await User.findOne({ facebookId: id });
```

Replace with:
```js
    const email = emails && emails[0] ? emails[0].value : null;

    const banCheck = await banService.checkBannedIdentity({ facebookId: id, email });
    if (banCheck.banned) {
      const err = new Error('This account has been permanently suspended and cannot be reactivated.');
      err.code = 'BANNED';
      return done(err, null);
    }

    // Try to find existing user by Facebook ID first
    let user = await User.findOne({ facebookId: id });
```

- [ ] **Step 2: Update `facebookCallback` error handler**

Find `exports.facebookCallback` (~line 274). The exact code to find:
```js
    if (err) {
      console.error('Facebook auth callback error:', err);
      logSecurityEvent('FACEBOOK_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Facebook authentication failed', 500));
    }
```

Replace with:
```js
    if (err) {
      if (err.code === 'BANNED') {
        return next(new ErrorResponse(err.message, 403));
      }
      console.error('Facebook auth callback error:', err);
      logSecurityEvent('FACEBOOK_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Facebook authentication failed', 500));
    }
```

- [ ] **Step 3: `GoogleStrategy` callback**

Find the `GoogleStrategy` callback (~line 93). The exact code to find:
```js
    const email = emails && emails[0] ? emails[0].value : null;
        
    // Try to find existing user by Google ID first
    let user = await User.findOne({ googleId: id });
```

Replace with:
```js
    const email = emails && emails[0] ? emails[0].value : null;

    const banCheck = await banService.checkBannedIdentity({ googleId: id, email });
    if (banCheck.banned) {
      const err = new Error('This account has been permanently suspended and cannot be reactivated.');
      err.code = 'BANNED';
      return done(err, null);
    }

    // Try to find existing user by Google ID first
    let user = await User.findOne({ googleId: id });
```

- [ ] **Step 4: Update `googleCallback` error handler**

Find `exports.googleCallback` (~line 315). The exact code to find:
```js
    if (err) {
      console.error('Google auth callback error:', err);
      logSecurityEvent('GOOGLE_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Google authentication failed', 500));
    }
```

Replace with:
```js
    if (err) {
      if (err.code === 'BANNED') {
        return next(new ErrorResponse(err.message, 403));
      }
      console.error('Google auth callback error:', err);
      logSecurityEvent('GOOGLE_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Google authentication failed', 500));
    }
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/davis/Desktop/Personal/language_exchange_backend_application
node --experimental-test-module-mocks --test test/banService.test.js
```

Expected: all 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add controllers/auth.js
git commit -m "feat(auth): block permanently-deleted accounts in Passport Google/Facebook strategy callbacks"
```

---

## Final Verification

- [ ] **Confirm app loads without errors**

```bash
node -e "
  process.env.JWT_SECRET='test';
  process.env.NODE_ENV='test';
  const app = require('./app');
  console.log('App loaded successfully');
  process.exit(0);
" 2>&1 | tail -5
```

Expected: `App loaded successfully`

- [ ] **Run all tests one final time**

```bash
node --experimental-test-module-mocks --test test/banService.test.js
```

Expected: 7/7 PASS
