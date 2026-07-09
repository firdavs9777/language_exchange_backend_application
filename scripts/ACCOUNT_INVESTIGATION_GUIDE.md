# 🔍 Account Investigation Guide

## Quick Start: Check Any Account

```bash
# Check specific account
node scripts/checkAccountDeletionHistory.js <email>

# Example:
node scripts/checkAccountDeletionHistory.js nozil@mail.ru
```

---

## 1️⃣ See ALL Deleted Accounts

```bash
node scripts/auditDeletedAccounts.js
```

**Shows:**
- ✅ All logged deletions (AdminAuditLog)
- ⚠️ Unlogged suspicious deletions
- 📊 Statistics (user vs admin deletes)

**Output example:**
```
Found 88 accounts showing "User not found" errors

TOP 20 MOST SUSPICIOUS DELETIONS:

1. admin@sub2api.org
   First "User not found": Sat Jun 27 2026 17:33:45
   Total errors: 62

2. admin@qq.com
   First "User not found": Wed Jun 24 2026 11:16:28
   Total errors: 15

... (18 more)
```

---

## 2️⃣ Check Specific Account History

```bash
node scripts/checkAccountDeletionHistory.js <email>
```

**Example: nozil@mail.ru**

```bash
node scripts/checkAccountDeletionHistory.js nozil@mail.ru
```

**Output shows:**

```
📊 ACCOUNT STATUS:
  ✅ Account EXISTS (not deleted)
  Created: Thu Jul 09 2026 14:53:24
  Email Verified: true
  Registration Complete: false

📋 AUDIT LOG ENTRIES:
  No audit log entries found

🔐 SECURITY LOG (Login Attempts on Missing Account):
  Found 6 "User not found" events:
  
  1. Thu Jul 09 2026 12:44:23 GMT+0900 (Korean Standard Time)
     IP: unknown
     
  (... 5 more attempts)

📈 SUMMARY:
  ⚠️ Account Deleted But Not Logged
     First "User not found" error: Thu Jul 09 2026 12:44:23
     Unknown deletion mechanism
```

---

## 3️⃣ Restore Deleted Account

```bash
node scripts/restoreDeletedAccount.js <email>
```

**Example:**

```bash
node scripts/restoreDeletedAccount.js fatima2255000@gmail.com
```

**Output:**

```
✅ SUCCESS!

📊 ACCOUNT RESTORED:
  Email: fatima2255000@gmail.com
  User ID: (auto-discovered from logs)
  Status: ✅ Active

🔗 All Associated Data:
  ✅ Previous messages will be linked
  ✅ Previous moments will be linked
  ✅ Previous conversations will be linked

📞 What to tell the user:
  ✅ Account has been restored
  ✅ All previous data is still there
  ⏳ Click "Forgot Password" to set new password
  ✅ Then complete profile setup
```

---

## 📊 Understanding the Data

### Account Status Legend

| Status | Meaning |
|--------|---------|
| ✅ EXISTS | Account is active, user can login |
| ❌ DELETED | Account removed, "User not found" errors in logs |
| ⏳ SUSPENDED | Account exists but flagged (not implemented yet) |

### Error Types

| Error | Meaning |
|-------|---------|
| "User not found" | Account doesn't exist (was deleted) |
| "Invalid password" | User tried to login with wrong password |
| "Invalid credentials" | Wrong email/password combination |

### Timeline Info

Shows when the account was first affected and when last attempted access occurred.

---

## 🔍 Investigation Examples

### Example 1: User Lost Access
**Check:**
```bash
node scripts/checkAccountDeletionHistory.js user@gmail.com
```

**Interpretation:**
- If "User not found" errors → Account was deleted
- If "Invalid password" errors → User forgot password (not deleted)
- If no errors → Account never attempted login

**Action:**
- For deleted: `node scripts/restoreDeletedAccount.js user@gmail.com`
- For password issue: Tell user to use "Forgot Password"

---

### Example 2: Suspicious Deletion
**Pattern:** 62 "User not found" errors in one week

**Likely Cause:**
- Automated scanning/bot testing
- Test account that was deleted
- Old admin account cleanup

**Check:**
```bash
# Look at that specific account
node scripts/checkAccountDeletionHistory.js admin@sub2api.org

# View all admin accounts
node scripts/auditDeletedAccounts.js | grep admin
```

---

### Example 3: User Trying to Regain Access
**Pattern:** "User not found" errors over 3 months

**Likely Cause:**
- User account was deleted
- User keeps trying to login
- Never got informed account was deleted

**Check:**
```bash
node scripts/checkAccountDeletionHistory.js user@email.com
```

**Action:**
```bash
# If account is gone, restore it
node scripts/restoreDeletedAccount.js user@email.com

# Tell user:
# "We found your account was deleted. 
#  It's now restored. Use 'Forgot Password' 
#  to set a new password."
```

---

## 🛠️ Common Scenarios

### Scenario 1: Support Ticket - "I Can't Login"

```bash
# 1. Check their account
node scripts/checkAccountDeletionHistory.js user@email.com

# 2. If deleted, restore it
node scripts/restoreDeletedAccount.js user@email.com

# 3. Tell user to:
#    - Click "Forgot Password"
#    - Check email for reset code
#    - Set new password
```

### Scenario 2: Verify Mass Deletion Didn't Happen

```bash
# Check stats
node scripts/auditDeletedAccounts.js

# Look for:
# - Spike in deletions on specific date
# - Batch patterns (many in same hour)
# - Specific deletion reason
```

### Scenario 3: Audit - Show Deletion History

```bash
# Get everyone who was deleted
node scripts/auditDeletedAccounts.js

# Shows:
# - Total deleted: 88
# - Logged vs unlogged
# - Timeline of deletions
# - Top accounts affected
```

---

## 📝 Data Available in Logs

### From AdminAuditLog
```
- action: DELETE, user_hard_deleted, USER_SELF_DELETE
- timestamp: When deletion occurred
- moderator: Who deleted (admin user ID or self)
- reason: Why deleted
- details: Additional info
```

### From SecurityLog
```
- email: User email
- userId: User ID attempting login
- action: LOGIN_FAILED, etc
- reason: "User not found", "Invalid password", etc
- ipAddress: Where login attempt came from
- timestamp: When attempt occurred
```

### From Users Collection
```
- email: User email
- _id: Unique user ID
- createdAt: When account was created
- isEmailVerified: Email verification status
- lastActivityAt: Last login/activity time
```

---

## 🔐 Security Notes

- ✅ **Email addresses are indexed** - quick lookups
- ✅ **All deletions logged** - going forward (after today's update)
- ✅ **Password hashes secure** - not exposed in logs
- ✅ **IP addresses tracked** - can spot unusual patterns

---

## ⚙️ All Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `checkAccountDeletionHistory.js` | Check specific account | `node scripts/checkAccountDeletionHistory.js <email>` |
| `auditDeletedAccounts.js` | See all deleted accounts | `node scripts/auditDeletedAccounts.js` |
| `restoreDeletedAccount.js` | Restore deleted account | `node scripts/restoreDeletedAccount.js <email>` |
| `checkDeletionOplog.js` | Check MongoDB oplog | `node scripts/checkDeletionOplog.js` |

---

## ❓ FAQ

**Q: Can I see WHO deleted the account?**
A: If logged in AdminAuditLog, yes. If not logged (before today), check who had admin access at that time.

**Q: Can I restore ANYONE's account?**
A: Yes, as long as their original user ID is in the security logs or other collections.

**Q: How far back does the history go?**
A: Security logs show all attempts. AdminAuditLog shows new deletions (added today).

**Q: Why are some accounts deleted with no log?**
A: They were deleted before audit logging was implemented (before today's update).

**Q: Can accounts delete themselves?**
A: Yes, users can request account deletion. Now it's logged (added today).

---

## 📞 Support Workflow

1. **User emails:** "I can't login"
2. **You run:** `node scripts/checkAccountDeletionHistory.js user@email.com`
3. **You see:** Account was deleted
4. **You run:** `node scripts/restoreDeletedAccount.js user@email.com`
5. **You tell user:** "Your account has been restored. Click 'Forgot Password' to set a new password."
6. **User:** Resets password and logs in ✅

---

**Need to check an account? Pick a script above and run it!** 🚀
