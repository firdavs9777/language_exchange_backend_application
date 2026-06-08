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
  moderatorId:    { type: String },       // stored as string (user doc will be gone)
  originalUserId: { type: String },       // same reason
}
```

- `sparse: true` on social ID fields — index only covers documents where the field exists.
- Schema-level validation: at least one of `email`, `googleId`, `facebookId`, `appleId` must be present.

---

## API Endpoints

### `GET /api/v1/admin/banned-users`
**Access:** Admin only  
**Purpose:** Dedicated list of all currently banned user accounts.

**Query params:**
- `page` (default: 1), `limit` (default: 20)
- `search` — optional name/email filter

**Response fields per user:**
`_id`, `name`, `email`, `username`, `images`, `isBanned`, `banReason`, `bannedAt`, `googleId`, `facebookId`, `appleId`, `createdAt`

---

### `DELETE /api/v1/admin/users/:id`
**Access:** Admin only  
**Purpose:** Permanently delete a banned account and add identifiers to the blacklist.

**Steps (in order):**
1. Fetch user by `id` — return `404` if not found.
2. Verify `isBanned === true` — return `400` if not banned (force ban-first workflow).
3. Create `BannedIdentity` document from user's `email`, `googleId`, `facebookId`, `appleId`, `banReason`, `bannedAt`.
4. Hard-delete user from DB (`User.findByIdAndDelete`).
5. Write `AdminAuditLog` entry with action `user_hard_deleted`.
6. Return `{ success: true }`.

---

## Registration & Login Block Checks

A shared helper added to `banService.js`:

```js
banService.checkBannedIdentity({ email, googleId, facebookId, appleId })
// Returns: { banned: true, reason } | { banned: false }
// Uses a single $or query — one DB call per check
```

**Entry points that call this helper:**

| Entry Point | Identifiers Checked |
|---|---|
| `sendVerificationCode` | `email` |
| `register` | `email` |
| `login` | `email` |
| `googleMobileLogin` / `googleCallback` | `googleId`, `email` |
| `facebookCallback` | `facebookId`, `email` |
| `appleMobileLogin` | `appleId`, `email` |

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
| `routes/admin.js` | Add `GET /banned-users`, `DELETE /users/:id` |
| `controllers/auth.js` | Add `checkBannedIdentity` calls at 6 entry points |

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
