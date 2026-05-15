# Step 20 — Scheduled Messaging Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all automated user-facing messages (inactivity emails, weekly digest, re-engagement push, VIP expiry push) into language-learning-specific copy, replace the existing weak SRS reminder with a tiered version including the actual due word, and add a new correction-accepted push notification.

**Architecture:** Pure backend changes. Edits split across email templates (`utils/emailTemplates.js`), push templates (`utils/notificationTemplates.js`), and the jobs/controllers that call them. Two new touchpoints: a tiered SRS review reminder (replacing the existing 5+-word reminder) and an event-driven correction-accepted push fired from the `acceptCorrection` controller.

**Tech Stack:** Node.js 18+, Express, MongoDB/Mongoose, Mailgun (email), Firebase FCM (push). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-15-scheduled-messaging-copy-design.md`

**Branch:** `feat/step20-messaging-copy` off `main`

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `utils/emailTemplates.js` | HTML email content + subjects | Rewrite `inactivityReminder`, `deactivationWarning`, `weeklyDigest` |
| `utils/notificationTemplates.js` | Push notification copy | Rewrite re-engagement + VIP expiring; add `getSrsReviewTemplate`, `getCorrectionAcceptedTemplate` |
| `jobs/notificationJobs.js` | Calls re-engagement template | Pass `user` to `getReengagementTemplate(user)` |
| `jobs/weeklyDigestJob.js` | Builds digest stats | Query Vocabulary + corrections; update activity gate |
| `jobs/learningJobs.js` | Hosts old SRS reminder | Replace `sendReviewReminders` with `sendSrsReviewReminders` (tiered copy + topWord) |
| `jobs/scheduler.js` | Time-of-day scheduling | Register `scheduleSrsReviewReminders()` for 9 AM KST daily |
| `controllers/advancedMessages.js` | Hosts `acceptCorrection` | Send correction-accepted push to corrector |

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/step20-messaging-copy
```

- [ ] **Step 2: Verify clean working tree on the new branch**

```bash
git status
```
Expected: `On branch feat/step20-messaging-copy`, working tree clean.

---

## Task 1: Inactivity reminder email — rewrite copy (7 day + 14 day paths)

**Files:**
- Modify: `utils/emailTemplates.js` — `inactivityReminder` function

**Spec source:** Section 1 (7 days) and Section 2 (14 days) of the design spec.

- [ ] **Step 1: Read the current function**

Open `utils/emailTemplates.js` and find `exports.inactivityReminder = (userName, daysSinceActive) => { ... }`. Note the existing signature, return shape (`{ subject, html, text }`), and where the body copy + subject lines live in the HTML/text strings.

- [ ] **Step 2: Update the function signature to accept target language**

New signature: `exports.inactivityReminder = (userName, daysSinceActive, targetLanguage) => { ... }`.

Inside the function, compute two display labels — one for body prose ("in X"), one for the subject possessive ("Your X practice"). These differ because the fallback string must read naturally in both contexts:
```js
const hasLang = targetLanguage && String(targetLanguage).trim();
const langLabel       = hasLang ? targetLanguage : 'your language';   // used mid-sentence
const langPossessive  = hasLang ? targetLanguage : 'language';        // used after "Your "
```

- [ ] **Step 3: Branch the copy on `daysSinceActive >= 14`**

For `daysSinceActive >= 14` use the 14-day copy below; otherwise (7 ≤ days < 14) use the 7-day copy.

**7-day copy:**
- Subject: `` `Your ${langPossessive} practice paused — pick up where you left off` ``
- HTML header text: `It's been a week`
- Body (paragraph 1): `Hi <strong>${userName}</strong>,`
- Body (paragraph 2): `It's been 7 days since your last session. That's right around when new vocabulary starts to slip — but you're still in the window where one short practice brings it back.`
- Body (paragraph 3): `` Easiest way in: open the AI Tutor and have a 5-minute conversation in ${langLabel}. No prep needed — just start talking. ``
- Body (paragraph 4): `Your saved words and open conversations will be there too.`
- CTA text: `Start a 5-minute session`
- CTA URL: `https://banatalk.com`
- Plain-text fallback: `Hi ${userName}, it's been 7 days since your last BananaTalk session. Open the AI Tutor for a 5-minute ${langLabel} conversation: https://banatalk.com`

**14-day copy:**
- Subject: `Your vocabulary deck has been waiting two weeks`
- HTML header text: `Two weeks away`
- Body (paragraph 1): `Hi <strong>${userName}</strong>,`
- Body (paragraph 2): `Two weeks off means some of the words you saved are overdue for review. The vocabulary is still in your deck — it just needs a session to stick.`
- Body (paragraph 3): `Open your study queue and spend 10 minutes. That's enough to get back on track.`
- CTA text: `Review my vocabulary`
- CTA URL: `https://banatalk.com`
- Plain-text fallback: `Hi ${userName}, two weeks since your last session. Your vocabulary deck is waiting. Open BananaTalk: https://banatalk.com`

Keep the existing `baseTemplate(content, accentColor)` wrapper and the existing app/Play store buttons block. Only the gradient/accent color, header text, body paragraphs, CTA, subject, and text fallback should change. The accent color may stay as the existing `'#f5576c'`.

- [ ] **Step 4: Update the caller in `jobs/inactivityEmailJob.js` to pass target language**

Both `sendInactivityReminder` calls (around lines 89 and 99 in the existing code) need user.language_to_learn passed through. Find the caller:

```js
await emailService.sendInactivityReminder(user, daysSinceActive);
```

Then update `services/emailService.js` `sendInactivityReminder` to forward the language. Open `services/emailService.js`, find:

```js
exports.sendInactivityReminder = async (user, daysSinceActive) => {
  ...
  const template = templates.inactivityReminder(user.name, daysSinceActive);
  ...
};
```

Change the template call to:
```js
const template = templates.inactivityReminder(user.name, daysSinceActive, user.language_to_learn);
```

And update the `User.find` query in `jobs/inactivityEmailJob.js` to include `language_to_learn` in the projection:

```js
}).select('name email lastActivityAt inactivityEmailsSent privacySettings language_to_learn');
```

- [ ] **Step 5: Smoke-test by calling the template directly**

```bash
node -e "const t = require('./utils/emailTemplates'); console.log(t.inactivityReminder('Alex', 7, 'Korean').subject); console.log(t.inactivityReminder('Alex', 14, 'Korean').subject); console.log(t.inactivityReminder('Alex', 7, null).subject);"
```
Expected stdout (exact lines):
```
Your Korean practice paused — pick up where you left off
Your vocabulary deck has been waiting two weeks
Your language practice paused — pick up where you left off
```
The third line is the no-language fallback path — reads naturally because `langPossessive` falls back to `language` (not `your target language`).

- [ ] **Step 6: Commit**

```bash
git add utils/emailTemplates.js services/emailService.js jobs/inactivityEmailJob.js
git commit -m "feat(email): rewrite inactivity reminders with target-language-specific copy"
```

---

## Task 2: Deactivation warning emails — rewrite copy (21 day + 28 day paths)

**Files:**
- Modify: `utils/emailTemplates.js` — `deactivationWarning` function

**Spec source:** Sections 3 (21 days) and 4 (28 days).

- [ ] **Step 1: Read the current function**

Find `exports.deactivationWarning = (userName, daysRemaining) => { ... }`. Inactivity job calls it with `daysRemaining: 14` for the 21-day path and `daysRemaining: 7` for the 28-day path.

- [ ] **Step 2: Branch the copy on `daysRemaining`**

If `daysRemaining > 7` (i.e. the 21-day-inactive case) use the 21-day copy. If `daysRemaining <= 7` (i.e. 28-day-inactive case) use the 28-day copy.

**21-day copy (daysRemaining=14):**
- Subject: `Everything you've built is still here`
- HTML header text: `Still here when you're ready`
- Body (paragraph 1): `Hi <strong>${userName}</strong>,`
- Body (paragraph 2): `Three weeks away. Your conversation history, vocabulary deck, and learning progress are all saved exactly where you left them.`
- Body (paragraph 3): `Language learning is a long game — it's fine to pause. Whenever you're ready to pick back up, just log in.`
- CTA text: `Log back in`
- Plain-text fallback: `Hi ${userName}, three weeks since your last BananaTalk session. Your account, conversations, and vocabulary are all saved. Log back in when you're ready: https://banatalk.com`

**28-day copy (daysRemaining=7):**
- Subject: `One login keeps your BananaTalk account active`
- HTML header text: `Account notice`
- Body (paragraph 1): `Hi <strong>${userName}</strong>,`
- Body (paragraph 2): `Your account stays active with a single login. The conversations and vocabulary you've saved will be waiting.`
- Body (paragraph 3): `Takes 10 seconds.`
- CTA text: `Keep my account`
- Plain-text fallback: `Hi ${userName}, log in once to keep your BananaTalk account active. Your saved conversations and vocabulary will be there: https://banatalk.com`

Remove **all** prior threatening language about deactivation. The job does not actually deactivate accounts (the `DEACTIVATION` threshold in `inactivityEmailJob.js` is marked optional and unused).

- [ ] **Step 3: Smoke-test**

```bash
node -e "const t = require('./utils/emailTemplates'); console.log(t.deactivationWarning('Alex', 14).subject); console.log(t.deactivationWarning('Alex', 7).subject);"
```
Expected:
```
Everything you've built is still here
One login keeps your BananaTalk account active
```

- [ ] **Step 4: Commit**

```bash
git add utils/emailTemplates.js
git commit -m "feat(email): rewrite deactivation warnings — drop misleading threat language"
```

---

## Task 3: Weekly digest email — template + stats

**Files:**
- Modify: `utils/emailTemplates.js` — `weeklyDigest` function
- Modify: `jobs/weeklyDigestJob.js` — `getUserWeeklyStats` + activity gate

**Spec source:** Section 5.

- [ ] **Step 1: Update `getUserWeeklyStats` in `jobs/weeklyDigestJob.js`**

Replace the existing function (lines ~12–55) with:

```js
const getUserWeeklyStats = async (userId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
    const Vocabulary = require('../models/Vocabulary');

    const [wordsReviewed, wordsSaved, messagesSent, correctionsExchanged] = await Promise.all([
      Vocabulary.countDocuments({
        user: userId,
        'reviewStats.lastReviewedAt': { $gte: oneWeekAgo },
      }),
      Vocabulary.countDocuments({
        user: userId,
        createdAt: { $gte: oneWeekAgo },
      }),
      Message.countDocuments({
        sender: userId,
        createdAt: { $gte: oneWeekAgo },
      }),
      Message.countDocuments({
        $or: [{ sender: userId }, { receiver: userId }],
        'corrections.0': { $exists: true },
        updatedAt: { $gte: oneWeekAgo },
      }),
    ]);

    return { wordsReviewed, wordsSaved, messagesSent, correctionsExchanged };
  } catch (error) {
    console.error(`Error getting stats for user ${userId}:`, error);
    return { wordsReviewed: 0, wordsSaved: 0, messagesSent: 0, correctionsExchanged: 0 };
  }
};
```

- [ ] **Step 2: Update the activity gate**

Find the `hasActivity` check (around line 90) and replace with:
```js
const hasActivity =
  userStats.wordsReviewed > 0 ||
  userStats.wordsSaved > 0 ||
  userStats.messagesSent > 0;
```

Remove the `momentLikes` and `newFollowers` checks — they were placeholders returning 0 and are not learning activity.

- [ ] **Step 3: Update `weeklyDigest` template in `utils/emailTemplates.js`**

The function currently has signature `exports.weeklyDigest = (userName, stats = {}) => { ... }`. Keep the signature but change what's rendered.

New copy:
- Subject: `Your language learning week`
- HTML header text: `Your week on BananaTalk`
- Greeting line: `Hi <strong>${userName}</strong>, here's what you did this week:`
- Stats block (replace the existing stats grid):
  ```html
  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
    <tr>
      <td style="padding: 10px; text-align: center; width: 50%;">
        <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.wordsReviewed || 0}</div>
        <div style="font-size: 13px; color: #777;">words reviewed</div>
      </td>
      <td style="padding: 10px; text-align: center; width: 50%;">
        <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.wordsSaved || 0}</div>
        <div style="font-size: 13px; color: #777;">new words saved</div>
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.messagesSent || 0}</div>
        <div style="font-size: 13px; color: #777;">messages with partners</div>
      </td>
      <td style="padding: 10px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #333;">${stats.correctionsExchanged || 0}</div>
        <div style="font-size: 13px; color: #777;">corrections exchanged</div>
      </td>
    </tr>
  </table>
  ```
- CTA: `See your full progress` → `https://banatalk.com/profile/stats`
- Plain-text fallback: `` `Hi ${userName}! Your week on BananaTalk: ${stats.wordsReviewed || 0} words reviewed, ${stats.wordsSaved || 0} new words saved, ${stats.messagesSent || 0} messages exchanged, ${stats.correctionsExchanged || 0} corrections exchanged.` ``

Keep the existing baseTemplate wrapper. Drop the prior `momentLikes`/`newFollowers` stats from the HTML — they are no longer collected.

- [ ] **Step 4: Smoke-test both pieces**

```bash
node -e "const t = require('./utils/emailTemplates'); const r = t.weeklyDigest('Alex', { wordsReviewed: 12, wordsSaved: 3, messagesSent: 8, correctionsExchanged: 2 }); console.log(r.subject); console.log(r.text);"
```
Expected first line: `Your language learning week`
Expected second line contains: `12 words reviewed`, `3 new words saved`, `8 messages exchanged`, `2 corrections exchanged`.

- [ ] **Step 5: Commit**

```bash
git add utils/emailTemplates.js jobs/weeklyDigestJob.js
git commit -m "feat(digest): replace social stats with learning stats (vocab reviewed/saved, corrections)"
```

---

## Task 4: Re-engagement push template — accept user, new copy

**Files:**
- Modify: `utils/notificationTemplates.js` — `getReengagementTemplate`
- Modify: `jobs/notificationJobs.js` — pass `user` to the template call

**Spec source:** Section 6.

- [ ] **Step 1: Update `getReengagementTemplate` in `utils/notificationTemplates.js`**

Replace the function (currently lines 126–151) with:

```js
const getReengagementTemplate = (user = {}) => {
  const lang =
    (user.language_to_learn && String(user.language_to_learn).trim()) ||
    'your language';

  const messages = [
    {
      title: `Still working on ${lang}?`,
      body: 'Your study deck and practice partners are waiting on BananaTalk',
    },
    {
      title: 'Quick practice session?',
      body: `5 minutes with the AI Tutor is enough to keep your ${lang} moving`,
    },
    {
      title: 'Vocabulary fades without review',
      body: 'Your saved words are ready — open BananaTalk to keep them fresh',
    },
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return {
    ...randomMessage,
    data: {
      type: 'system',
      screen: 'home',
    },
  };
};
```

- [ ] **Step 2: Update the caller in `jobs/notificationJobs.js`**

Find (around line 128):
```js
const notification = templates.getReengagementTemplate();
```
Replace with:
```js
const notification = templates.getReengagementTemplate(user);
```

Verify the `inactiveUsers` query already includes `language_to_learn` in the projection. If `.select(...)` is used to restrict fields, add `language_to_learn`. Otherwise the full document is loaded and no change is needed.

- [ ] **Step 3: Smoke-test**

```bash
node -e "const t = require('./utils/notificationTemplates'); for (let i=0; i<6; i++) console.log(JSON.stringify(t.getReengagementTemplate({ language_to_learn: 'Korean' })));"
```
Expected: Each line is a JSON object with `title`, `body`, `data`. Title should rotate among the 3 variants. Variants 1 and 2 must include the word `Korean`.

```bash
node -e "const t = require('./utils/notificationTemplates'); console.log(t.getReengagementTemplate().title);"
```
Expected: One of the three variants. Variant 1 fallback would read `Still working on your language?`.

- [ ] **Step 4: Commit**

```bash
git add utils/notificationTemplates.js jobs/notificationJobs.js
git commit -m "feat(push): re-engagement copy uses target language; drops generic 'we miss you' tone"
```

---

## Task 5: VIP-expiring push — rewrite copy

**Files:**
- Modify: `utils/notificationTemplates.js` — `getSubscriptionExpiringTemplate`

**Spec source:** Section 7.

- [ ] **Step 1: Replace the function**

Replace the existing `getSubscriptionExpiringTemplate` (currently lines 158–168) with:

```js
const getSubscriptionExpiringTemplate = (daysLeft) => {
  const daySuffix = daysLeft === 1 ? 'day' : 'days';
  return {
    title: `Your VIP access ends in ${daysLeft} ${daySuffix}`,
    body: 'Unlimited AI Tutor sessions, full translation, and voice practice will stop. Tap to renew.',
    data: {
      type: 'system',
      screen: 'subscription',
      daysLeft: daysLeft.toString(),
    },
  };
};
```

- [ ] **Step 2: Smoke-test**

```bash
node -e "const t = require('./utils/notificationTemplates'); console.log(t.getSubscriptionExpiringTemplate(3).title); console.log(t.getSubscriptionExpiringTemplate(1).title);"
```
Expected:
```
Your VIP access ends in 3 days
Your VIP access ends in 1 day
```

- [ ] **Step 3: Commit**

```bash
git add utils/notificationTemplates.js
git commit -m "feat(push): VIP-expiring names specific benefits (AI Tutor, translation, voice)"
```

---

## Task 6: New SRS review template (tiered by due count)

**Files:**
- Modify: `utils/notificationTemplates.js` — add `getSrsReviewTemplate`

**Spec source:** Section 8 (copy tiers).

- [ ] **Step 1: Add the new function**

Add this function before the `module.exports` block in `utils/notificationTemplates.js`:

```js
/**
 * SRS review reminder template — tiered by due-word count.
 * @param {Number} dueCount - Number of vocabulary words due for review
 * @param {String} topWord - The oldest-due word (used only when dueCount === 1)
 * @returns {Object} - { title, body, data }
 */
const getSrsReviewTemplate = (dueCount, topWord) => {
  let title;
  let body;

  if (dueCount === 1) {
    title = `"${topWord}" is ready for review`;
    body = 'Open BananaTalk to practice it before it fades';
  } else if (dueCount <= 5) {
    title = `${dueCount} words are due for review`;
    body = 'A quick session keeps your vocabulary sharp';
  } else {
    title = `${dueCount} words are waiting in your study queue`;
    body = 'Spend 10 minutes today — your deck is ready';
  }

  return {
    title,
    body,
    data: {
      type: 'system',
      screen: 'vocabulary_review',
      dueCount: dueCount.toString(),
    },
  };
};
```

- [ ] **Step 2: Add to the `module.exports` block**

Find the `module.exports = { ... }` at the bottom and add `getSrsReviewTemplate,` to the list.

- [ ] **Step 3: Smoke-test all three tiers**

```bash
node -e "const t = require('./utils/notificationTemplates'); console.log(t.getSrsReviewTemplate(1, 'annyeong').title); console.log(t.getSrsReviewTemplate(3).title); console.log(t.getSrsReviewTemplate(12).title);"
```
Expected:
```
"annyeong" is ready for review
3 words are due for review
12 words are waiting in your study queue
```

- [ ] **Step 4: Commit**

```bash
git add utils/notificationTemplates.js
git commit -m "feat(push): add tiered SRS review template (1 / 2–5 / 6+ words due)"
```

---

## Task 7: Replace `sendReviewReminders` with `sendSrsReviewReminders`

**Files:**
- Modify: `jobs/learningJobs.js` — replace `sendReviewReminders` function and update exports

**Spec source:** Section 8 (implementation).

- [ ] **Step 1: Delete the old `sendReviewReminders` function**

Remove the function at lines 252–306 of `jobs/learningJobs.js` (the existing `sendReviewReminders` that uses the 5+-word threshold and the static "Time to Review! 📚" copy).

- [ ] **Step 2: Add the replacement function in the same location**

```js
/**
 * Send tiered vocabulary review reminders.
 * Replaces the old 5+-word static-copy version.
 * Sends to all users with ≥1 due word; copy is tiered (1 / 2–5 / 6+).
 */
const sendSrsReviewReminders = async () => {
  console.log('[LearningJobs] Sending SRS review reminders...');

  try {
    const Vocabulary = require('../models/Vocabulary');
    const notificationService = require('../services/notificationService');
    const templates = require('../utils/notificationTemplates');

    const now = new Date();

    // Aggregate: users with due words + count + top (oldest) due word
    const usersWithDueWords = await Vocabulary.aggregate([
      {
        $match: {
          nextReview: { $lte: now },
          isArchived: false,
          isMastered: false,
        },
      },
      { $sort: { nextReview: 1 } },
      {
        $group: {
          _id: '$user',
          dueCount: { $sum: 1 },
          topWord: { $first: '$word' },
        },
      },
      { $match: { dueCount: { $gte: 1 } } },
    ]);

    if (usersWithDueWords.length === 0) {
      console.log('[LearningJobs] No users have due words.');
      return;
    }

    // Filter to users who have reminders enabled and at least one FCM token
    const eligibleUsers = await User.find({
      _id: { $in: usersWithDueWords.map(u => u._id) },
      'notificationSettings.vocabularyReviewReminders': true,
      'fcmTokens.0': { $exists: true },
    }).select('_id');

    const eligibleSet = new Set(eligibleUsers.map(u => u._id.toString()));
    let sent = 0;
    let skipped = 0;

    for (const due of usersWithDueWords) {
      if (!eligibleSet.has(due._id.toString())) {
        skipped++;
        continue;
      }
      const notification = templates.getSrsReviewTemplate(due.dueCount, due.topWord);
      await notificationService.send(due._id, 'system', notification);
      sent++;
    }

    console.log(`[LearningJobs] SRS reminders: sent ${sent}, skipped ${skipped}`);
  } catch (error) {
    console.error('[LearningJobs] sendSrsReviewReminders error:', error);
  }
};
```

- [ ] **Step 3: Update the `module.exports` block**

Find the `module.exports = { ... }` at the bottom. Remove `sendReviewReminders` if it's exported. Add `sendSrsReviewReminders`.

- [ ] **Step 4: Grep for any other references to `sendReviewReminders`**

```bash
grep -rn "sendReviewReminders" --include="*.js" --exclude-dir=node_modules .
```
If any callers other than `jobs/learningJobs.js` itself reference it, update them to call `sendSrsReviewReminders` instead, or delete them if dead. Expected: no live callers outside `learningJobs.js` (Task 8 will register the scheduler).

- [ ] **Step 5: Commit**

```bash
git add jobs/learningJobs.js
git commit -m "feat(learning): replace sendReviewReminders with tiered sendSrsReviewReminders"
```

---

## Task 8: Schedule SRS reminders at 9 AM KST daily

**Files:**
- Modify: `jobs/scheduler.js` — add `scheduleSrsReviewReminders()` function and register in `startScheduler`

**Spec source:** Section 8 (scheduler wiring).

- [ ] **Step 1: Add `scheduleSrsReviewReminders` to `jobs/scheduler.js`**

Add the function near the other `schedule*` functions (e.g., after `scheduleNotificationCleanup`):

```js
/**
 * Schedule SRS review reminders (daily at 9:00 AM KST)
 */
const scheduleSrsReviewReminders = () => {
  const { sendSrsReviewReminders } = require('./learningJobs');

  const runJob = async () => {
    console.log('\n⏰ Running scheduled SRS review reminders...');
    try {
      await sendSrsReviewReminders();
    } catch (error) {
      console.error('Scheduled SRS review reminders failed:', error);
    }
    setTimeout(runJob, 24 * 60 * 60 * 1000);
  };

  const msUntilNextRun = getMillisecondsUntil(9, 0);
  console.log(`📅 SRS review reminders scheduled in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);
  setTimeout(runJob, msUntilNextRun);
};
```

- [ ] **Step 2: Register in `startScheduler`**

In the `startScheduler` function (around line 392), add a call to `scheduleSrsReviewReminders();` after `scheduleSubscriptionReminders();` (both are 9 AM daily — keep them together):

```js
  // Notification jobs
  scheduleTokenCleanup();
  scheduleReengagement();
  scheduleSubscriptionReminders();
  scheduleSrsReviewReminders();  // ← new
  scheduleNotificationCleanup();
```

- [ ] **Step 3: Add `scheduleSrsReviewReminders` to the module exports**

Find the `module.exports = { ... }` at the bottom of `scheduler.js` and add `scheduleSrsReviewReminders` to the list.

- [ ] **Step 4: Quick syntax check by requiring the file**

```bash
node -e "require('./jobs/scheduler'); console.log('scheduler.js loads OK');"
```
Expected: `scheduler.js loads OK`

- [ ] **Step 5: Commit**

```bash
git add jobs/scheduler.js
git commit -m "feat(scheduler): wire SRS review reminders at 9 AM KST daily"
```

---

## Task 9: New correction-accepted push template

**Files:**
- Modify: `utils/notificationTemplates.js` — add `getCorrectionAcceptedTemplate`

**Spec source:** Section 9.

- [ ] **Step 1: Add the new function**

Add to `utils/notificationTemplates.js` before the `module.exports` block:

```js
/**
 * Correction-accepted notification template.
 * Sent to the user who wrote the correction when the receiver accepts it.
 * @param {String} accepterName - Name of the user who accepted the correction
 * @param {Object} data - Optional { messageId, conversationId }
 * @returns {Object} - { title, body, data }
 */
const getCorrectionAcceptedTemplate = (accepterName, data = {}) => {
  return {
    title: `${accepterName} accepted your correction`,
    body: 'Your fix helped — they accepted it in your conversation',
    data: {
      type: 'correction_accepted',
      messageId: data.messageId || '',
      conversationId: data.conversationId || '',
      screen: 'chat',
    },
  };
};
```

- [ ] **Step 2: Add to the `module.exports` block**

Add `getCorrectionAcceptedTemplate,` to the exports list.

- [ ] **Step 3: Smoke-test**

```bash
node -e "const t = require('./utils/notificationTemplates'); console.log(JSON.stringify(t.getCorrectionAcceptedTemplate('Jina', { messageId: 'abc' })));"
```
Expected: JSON containing `"title":"Jina accepted your correction"` and `"messageId":"abc"`.

- [ ] **Step 4: Commit**

```bash
git add utils/notificationTemplates.js
git commit -m "feat(push): add correction-accepted notification template"
```

---

## Task 10: Wire correction-accepted push in `acceptCorrection` controller

**Files:**
- Modify: `controllers/advancedMessages.js` — `acceptCorrection`

**Spec source:** Section 9 (implementation).

- [ ] **Step 1: Read the current `acceptCorrection` controller**

Open `controllers/advancedMessages.js` and find `exports.acceptCorrection` (around line 100). The current code looks like:

```js
exports.acceptCorrection = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);
  if (!message) return next(new ErrorResponse('Message not found', 404));
  // ...
  await message.acceptCorrection(req.params.correctionId);
  res.status(200).json({ success: true, data: message });
});
```

Capture the **exact** existing structure first. The variable name for the message and the correctionId param key may differ — adapt accordingly.

- [ ] **Step 2: Insert the corrector-capture + post-save push**

Before the `await message.acceptCorrection(...)` line, capture the corrector:

```js
const correction = message.corrections.id(req.params.correctionId);
if (!correction) return next(new ErrorResponse('Correction not found', 404));
const correctorId = correction.corrector;
const accepterName = req.user.name || 'Someone';
```

After the existing `await message.acceptCorrection(req.params.correctionId);` call (and before `res.status(200).json(...)`), add:

```js
// Notify the corrector — don't fail the request if push fails
try {
  // Don't notify a self-correction (corrector === accepter)
  if (correctorId && correctorId.toString() !== req.user._id.toString()) {
    const templates = require('../utils/notificationTemplates');
    const notificationService = require('../services/notificationService');
    const notification = templates.getCorrectionAcceptedTemplate(accepterName, {
      messageId: message._id.toString(),
    });
    await notificationService.send(correctorId, 'system', notification);
  }
} catch (err) {
  console.error('[acceptCorrection] notify corrector failed:', err.message);
}
```

The `try/catch` ensures push failures don't break the accept response. The self-correction guard handles the (rare) edge case where a user accepts their own correction.

- [ ] **Step 3: Verify imports at top of file**

If `templates` and `notificationService` are not already required at the top of `advancedMessages.js`, the inline `require(...)` calls above will load them on-demand. Either approach is fine; check existing file conventions to decide whether to hoist to the top or keep inline. If other handlers in the file use top-level requires, hoist for consistency.

- [ ] **Step 4: Syntax check**

```bash
node -e "require('./controllers/advancedMessages'); console.log('advancedMessages.js loads OK');"
```
Expected: `advancedMessages.js loads OK`.

- [ ] **Step 5: Commit**

```bash
git add controllers/advancedMessages.js
git commit -m "feat(corrections): push notify corrector when receiver accepts correction"
```

---

## Task 11: End-to-end syntax + load check

**Files:** none (verification only)

- [ ] **Step 1: Verify the whole app still loads**

```bash
node -e "require('./server.js'); setTimeout(() => process.exit(0), 1000);" 2>&1 | head -30
```
Expected: server boot output (DB connect, scheduler messages), no `SyntaxError` or `Cannot find module`. The 1-second timeout exits cleanly.

If errors appear, fix them before moving on. Common issues:
- Missing export from `notificationTemplates.js`
- `getMillisecondsUntil` not in scope inside the new schedule function (it's defined at top of `scheduler.js`, so it should be — verify)
- `require` cycle in the `scheduler.js → learningJobs.js` lazy require (the lazy `require` inside `scheduleSrsReviewReminders` avoids it)

- [ ] **Step 2: Run the SRS job manually (optional sanity check)**

```bash
node -e "
require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const { sendSrsReviewReminders } = require('./jobs/learningJobs');
  await sendSrsReviewReminders();
  await mongoose.disconnect();
});
"
```
Expected: Logs `Sending SRS review reminders...` then either `No users have due words.` or `SRS reminders: sent X, skipped Y`. No errors.

This is a real run against production data — pushes will fire if any users have due words and reminders enabled. If you want to avoid sending real pushes, skip this step. The syntax check in Step 1 is sufficient for plan completion.

---

## Task 12: Merge to main and push

**Files:** none (git operations)

- [ ] **Step 1: Verify all commits land on the branch**

```bash
git log main..feat/step20-messaging-copy --oneline
```
Expected: 10 commits — one per task (Tasks 1-10).

- [ ] **Step 2: Merge to main with `--no-ff`**

```bash
git checkout main
git merge --no-ff feat/step20-messaging-copy -m "feat(step20): scheduled messaging copy rewrite + SRS reminder + correction-accepted push

- Rewrite inactivity (7d/14d), deactivation (21d/28d), weekly digest copy with language-learning-specific tone
- Drop misleading deactivation-threat language
- Weekly digest shows learning stats (vocab reviewed/saved, corrections) instead of social stats
- Re-engagement push now uses user.language_to_learn
- VIP-expiring push names specific benefits (AI Tutor, translation, voice)
- Replace static sendReviewReminders with tiered sendSrsReviewReminders (1 / 2-5 / 6+ word copy + topWord)
- New correction-accepted push fired from acceptCorrection controller"
```

- [ ] **Step 3: Push to origin**

```bash
git push origin main
```

Backend auto-deploys. No Flutter changes — no app rebuild needed.

- [ ] **Step 4: Post-merge sanity**

```bash
git log --oneline -5
```
Expected: Top line is the merge commit `feat(step20): scheduled messaging copy rewrite + SRS reminder + correction-accepted push`.

---

## Acceptance criteria (from spec)

| # | Criterion | Verified in |
|---|---|---|
| A1 | 7-day inactivity email subject references target language (or fallback) | Task 1 Step 5 smoke |
| A2 | No deactivation threat language in 21-day or 28-day emails | Task 2 Step 2 copy |
| A3 | Weekly digest shows vocab stats, not moment likes | Task 3 Step 4 smoke |
| A4 | Re-engagement push variants reference `language_to_learn` where set | Task 4 Step 3 smoke |
| A5 | VIP expiring push names AI Tutor + translation specifically | Task 5 Step 1 body string |
| A6 | SRS reminder ≥1 due word, correct tier; replaces old job (no duplicate sends) | Task 7 Step 4 grep verifies no other callers |
| A7 | Correction accepted push sent to corrector after F1a accept | Task 10 Step 2 logic |
| A8 | No new notifications sent when `notificationSettings.enabled: false` | Task 7 gate (vocabularyReviewReminders === true); Task 10 uses notificationService.send which respects notification settings |

---

## Out of scope (do not expand into during this wave)

- HTML template visual redesign (colors, layout)
- Transactional pushes (likes, comments, follows, profile visits, waves) — they are functional as-is
- Auth emails (welcome, password change, sign-in)
- Streak reminder copy (`sendStreakReminders` still exists in `learningJobs.js` — leave it)
- A/B testing the new copy
- Per-user notification quiet hours

If encountered during execution, log to `manual-todos.md` and keep moving.
