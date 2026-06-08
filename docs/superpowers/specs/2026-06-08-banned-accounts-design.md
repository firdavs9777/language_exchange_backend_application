# Banned Accounts — Hard Delete & Permanent Blacklist

**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Backend only — no frontend changes required

---

## Problem

When an admin bans a user, the account is blocked but the user record stays in the database. There is no way to:
1. View a dedicated list of banned accounts with their ban metadata.
2. Permanently delete a banned account while ensuring the same person cannot re-register using the same email or linked social accounts (Google, Facebook, Apple).

---

## Solution Overview

Introduce a `BannedIdentity` collection that acts as a permanent blacklist. When an admin hard-deletes a banned user, their identifiers (email + social IDs) are written to this collection before the user document is removed. All registration and OAuth login entry points check this collection and reject matches with a `403`.

---

## Data Model: `BannedIdentity`

**File:** `models/BannedIdentity.js`

```js
{
  email:          { type: String, index: true, sparse: true },
  googleId:       { type: String, index: true, sparse: true },
  facebookId:     { type: String, index: true, sparse: true },
  appleId:        { type: String, index: true, sparse: true },
  reason:         { type: String },
  bannedAt:       { type: Date },         // copied from User.bannedAt
  deletedAt:      { type: Date },         // timestamp of hard delete
  moderatorId:    { type: String },       // stored as String(ObjectId) — user doc will be gone
  originalUserId: { type: String },       // same reason
}
```

- `sparse: true` on social ID fields — index only covers documents where the field exists.
- Schema-level validation enforced via a Mongoose `pre('validate')` hook (a top-level `validate:` key is per-field only and would be silently ignored):
  ```js
  BannedIdentitySchema.pre('validate', function(next) {
    if (!this.email && !this.googleId && !this.facebookId && !this.appleId) {
      next(new Error('At least one identity field is required'));
    } else {
      next();
    }
  });
  ```
- `moderatorId` stored as `String(req.user.id)` — a raw string because the User document will be deleted and an ObjectId ref would become an unpopulatable dangling reference.
- For Apple users who hide their email, `User.email` is the synthetic `${appleId}@privaterelay.appleid.com` address. `appleId` is the authoritative block key for Apple users — the `$or` query checks it independently of email presence.

---

## API Endpoints

### `GET /api/v1/admin/banned-users`
**Access:** Admin only  
**Purpose:** Dedicated list of currently banned accounts, exposing OAuth IDs that the generic `GET /admin/users` endpoint does not return (needed to show which social accounts will be blacklisted on delete).

**Query params:**
- `page` (default: 1), `limit` (default: 20)
- `search` — optional name/email filter

**Response fields per user:**
`_id`, `name`, `email`, `username`, `images`, `isBanned`, `banReason`, `bannedAt`, `googleId`, `facebookId`, `appleId`, `createdAt`

---

### `DELETE /api/v1/admin/users/:id`
**Access:** Admin only  
**Purpose:** Permanently delete a banned account and add identifiers to the blacklist.

**Guard:** Only banned users (`isBanned === true`) can be hard-deleted. To hard-delete a previously unbanned user, re-ban them first, then delete.

**Steps:**
1. Fetch user by `id` — return `404` if not found.
2. Verify `isBanned === true` — return `400` if not banned.
3. Create `BannedIdentity` document with all fields: `email`, `googleId`, `facebookId`, `appleId`, `reason` (from `banReason`), `bannedAt`, `deletedAt: new Date()`, `moderatorId: String(req.user.id)`, `originalUserId: String(user._id)`.
4. Hard-delete user from DB (`User.findByIdAndDelete`).
5. Write `AdminAuditLog` entry with action `user_hard_deleted`.
6. Return `{ success: true }`.

**Atomicity:** MongoDB does not guarantee cross-collection atomicity without a session transaction. Implementation wraps steps 3–4 in a try/catch: if `User.findByIdAndDelete` fails after `BannedIdentity` was created, attempt `BannedIdentity.deleteOne({ originalUserId })` rollback and re-throw. If the rollback also fails, the user remains blacklisted (safe — over-blocks rather than under-blocks) and the error is logged.

---

## Registration & Login Block Checks

A shared helper added to `banService.js`:

```js
banService.checkBannedIdentity({ email, googleId, facebookId, appleId })
// Returns: { banned: true, reason } | { banned: false }
// Uses a single $or query — one DB call per check
// Fields absent or undefined are excluded from the $or clause
```

**Entry points and placement:**

| Entry Point | Where check is placed | Identifiers Checked |
|---|---|---|
| `sendVerificationCode` | Top of controller, before `User.findOne` | `email` |
| `register` | Top of controller, before `User.findOne` | `email` |
| `login` | Top of controller, before `User.findOne` | `email` |
| `googleMobileLogin` | Top of controller, before `User.findOne` | `googleId`, `email` |
| **`GoogleStrategy` callback** | Inside Passport strategy, before `User.findOne` | `googleId`, `email` |
| **`FacebookStrategy` callback** | Inside Passport strategy, before `User.findOne` | `facebookId`, `email` |
| `appleMobileLogin` | Top of controller, before `User.findOne` | `appleId`, `email` |

> **Note on OAuth strategies:** For `googleCallback` and `facebookCallback`, the user lookup and creation happen inside the Passport strategy callback (registered at startup), not in the exported controller. The block check must be placed at the top of the `GoogleStrategy` and `FacebookStrategy` async callbacks — before any `User.findOne` or `User.create` call — otherwise a new User document would be created before the check runs.
>
> **Error propagation from Passport strategies:** When a ban is detected inside a strategy callback, use a sentinel error: `const err = new Error('banned'); err.code = 'BANNED'; return done(err, null);`. The `facebookCallback` and `googleCallback` controllers must be updated to check `if (err?.code === 'BANNED') return next(new ErrorResponse('This account has been permanently suspended and cannot be reactivated.', 403));` before the existing generic error handler — otherwise the client receives a 500 instead of a 403.

**Error returned to client on match:**
```
HTTP 403: "This account has been permanently suspended and cannot be reactivated."
```

---

## Files Changed

| File | Change |
|---|---|
| `models/BannedIdentity.js` | New model |
| `services/banService.js` | Add `checkBannedIdentity()`, add `hardDeleteUser()` |
| `controllers/admin.js` | Add `getBannedUsers()`, add `hardDeleteUser()` |
| `routes/admin.js` | Add `GET /banned-users`, `DELETE /users/:id`; update imports to include `getBannedUsers`, `hardDeleteUser` |
| `controllers/auth.js` | Add `checkBannedIdentity` calls at `sendVerificationCode`, `register`, `login`, `googleMobileLogin`, `appleMobileLogin` + inside `GoogleStrategy` and `FacebookStrategy` Passport callbacks; update `facebookCallback` and `googleCallback` error handlers to detect `err.code === 'BANNED'` and return 403 |

---

## What Does NOT Change

- Flutter frontend — no changes needed. Existing `403` handling covers the new block responses.
- The existing `ban` / `unban` flow — unchanged.
- `GET /admin/users?banned=true` — remains available as the general search endpoint.

---

## Non-Goals

- Device fingerprint blocking (out of scope).
- Automatic deletion of banned accounts (admin must explicitly delete).
- Unbanning a hard-deleted account (not supported — use ban/unban for reversible actions).
