# Scheduled Messaging Copy — Design Spec

Date: 2026-05-15
Author: design session
Status: approved — ready for implementation

---

## Problem

Every automated message BananaTalk sends to users reads like a generic SaaS template:
"New Update Just Dropped!", "We Really Miss You! 💕", "Smoother chat experience with faster message delivery." None of this is specific to language learning, and none of it gives the user a reason to act beyond vague social pressure.

Additionally, two high-value notification touchpoints are missing:
- No push when vocabulary words are due for SRS review (the study loop exists but nothing prompts users to use it)
- No push when a language partner accepts your correction (the accept action now exists via F1a but the corrector gets no feedback)

---

## Scope

### Files changed
| File | Change type |
|---|---|
| `utils/emailTemplates.js` | Rewrite inactivity, deactivation, weekly digest, promotional copy |
| `utils/notificationTemplates.js` | Rewrite re-engagement variants + VIP expiring; update `getReengagementTemplate` signature to accept user |
| `jobs/notificationJobs.js` | Pass user object to `getReengagementTemplate(user)` |
| `jobs/weeklyDigestJob.js` | Update `getUserWeeklyStats` to include vocab reviewed + vocab saved; update activity gate |
| `jobs/promotionalEmailJob.js` | Already updated (Step 19) — no change |
| `jobs/learningJobs.js` | Replace existing `sendReviewReminders()` with improved `sendSrsReviewReminders()` (new copy tiers, topWord, ≥1 threshold) |
| `jobs/scheduler.js` | Register SRS reminder via `scheduleXxx()` using `getMillisecondsUntil(9, 0)` — NOT in `startLearningJobs()` |
| `controllers/advancedMessages.js` | Add correction-accepted push notification in `acceptCorrection` endpoint |

### New jobs/notifications
| Name | Type | Trigger |
|---|---|---|
| SRS review reminder | Push notification | Daily 9AM KST, per-user, if ≥1 word due |
| Correction accepted | Push notification | Event-driven, on `acceptCorrection` call |

---

## Voice principles

Four rules that every message follows:

1. **Direct over dramatic** — "Your study queue has 8 words due" not "Your vocabulary is calling you! 📚✨"
2. **Language-learning specific** — every message ties to learning or practice, not generic social activity
3. **Specific over vague** — name the actual feature or action, not "new features to help you connect better"
4. **Warm but not clingy** — acknowledge absence without guilt-tripping; no fake emotional stakes

Banana emoji: header/logo use only. Not scattered through body copy.

---

## Email copy

### 1. Inactivity reminder — 7 days

**Subject:** `Your [target language] practice paused — pick up where you left off`

**HTML header text:** `It's been a week`

**Body:**
```
Hi [Name],

It's been 7 days since your last session. That's right around when new vocabulary
starts to slip — but you're still in the window where one short practice brings
it back.

Easiest way in: open the AI Tutor and have a 5-minute conversation in [target
language]. No prep needed — just start talking.

Your saved words and open conversations will be there too.
```

**CTA text:** `Start a 5-minute session`
**CTA URL:** `https://banatalk.com`

**Template function:** `emailTemplates.inactivityReminder(userName, daysSinceActive, targetLanguage)`
- `targetLanguage` comes from `user.language_to_learn`; falls back to `"your target language"` if not set

---

### 2. Inactivity reminder — 14 days

**Subject:** `Your vocabulary deck has been waiting two weeks`

**HTML header text:** `Two weeks away`

**Body:**
```
Hi [Name],

Two weeks off means some of the words you saved are overdue for review. The
vocabulary is still in your deck — it just needs a session to stick.

Open your study queue and spend 10 minutes. That's enough to get back on track.
```

**CTA text:** `Review my vocabulary`
**CTA URL:** `https://banatalk.com`

**Note:** Same template function as 7-day reminder, different copy path based on `daysSinceActive >= 14`.

---

### 3. Deactivation warning — 21 days

**Subject:** `Everything you've built is still here`

**HTML header text:** `Still here when you're ready`

**Body:**
```
Hi [Name],

Three weeks away. Your conversation history, vocabulary deck, and learning
progress are all saved exactly where you left them.

Language learning is a long game — it's fine to pause. Whenever you're ready
to pick back up, just log in.
```

**CTA text:** `Log back in`

**Note:** Remove all threatening deactivation language — the job does not actually deactivate accounts (DEACTIVATION threshold is marked optional and unused). Misleading threat language damages trust.

---

### 4. Deactivation final warning — 28 days

**Subject:** `One login keeps your BananaTalk account active`

**HTML header text:** `Account notice`

**Body:**
```
Hi [Name],

Your account stays active with a single login. The conversations and vocabulary
you've saved will be waiting.

Takes 10 seconds.
```

**CTA text:** `Keep my account`

---

### 5. Weekly digest — learning-focused

**Subject:** `Your language learning week`

**HTML header text:** `Week of [start date] – [end date]`

**Body structure:**
```
Hi [Name], here's what you did this week:

[N] words reviewed        [N] new words saved to your deck
[N] messages exchanged    [N] corrections exchanged

[Streak line — only if ≥2 consecutive active weeks:]
That's [N] weeks in a row — consistency is how languages stick.
```

**CTA text:** `See your full progress`

**Stats to collect (update `getUserWeeklyStats`):**
| Stat | Source |
|---|---|
| `wordsReviewed` | `Vocabulary` — count docs where `user === userId` and `reviewStats.lastReviewedAt >= oneWeekAgo` (field set on every `processReview()` call — exact signal, not a proxy) |
| `wordsSaved` | `Vocabulary` — count docs where `user === userId` and `createdAt >= oneWeekAgo` |
| `messagesSent` | `Message` — count docs where `sender === userId` and `createdAt >= oneWeekAgo` (keep existing) |
| `correctionsExchanged` | `Message` — count docs where (`sender === userId` OR `receiver === userId`) and `'corrections.0': { $exists: true }` and `updatedAt >= oneWeekAgo` |

**Activity gate:** Send if any of `wordsReviewed > 0`, `wordsSaved > 0`, `messagesSent > 0`. Remove moment likes and follower counts from gate (not learning activity).

---

## Push notification copy

### 6. Re-engagement — 3 rotating variants

**Current function signature:** `getReengagementTemplate()`
**New signature:** `getReengagementTemplate(user = {})`

Uses `user.language_to_learn` where available; falls back to `"your language"`.

**Variant 1:**
- Title: `Still working on [language]?`
- Body: `Your study deck and practice partners are waiting on BananaTalk`

**Variant 2:**
- Title: `Quick practice session?`
- Body: `5 minutes with the AI Tutor is enough to keep your [language] moving`

**Variant 3:**
- Title: `Vocabulary fades without review`
- Body: `Your saved words are ready — open BananaTalk to keep them fresh`

**Caller update (`notificationJobs.js`):**
```js
// Before:
const notification = templates.getReengagementTemplate();
// After:
const notification = templates.getReengagementTemplate(user);
```

---

### 7. VIP expiring — 3 days out

**Current:**
- Title: `VIP Subscription Expiring`
- Body: `Your VIP subscription expires in [N] day(s). Renew now to keep your benefits!`

**New:**
- Title: `Your VIP access ends in [N] day[s]`
- Body: `Unlimited AI Tutor sessions, full translation, and voice practice will stop. Tap to renew.`

**Template function:** `getSubscriptionExpiringTemplate(daysLeft)` — update in place.

---

## New touchpoints

### 8. SRS review reminder — daily push (NEW)

**Trigger:** Daily at 9AM KST. Only sent to users with ≥1 vocabulary word where `nextReview <= now AND isArchived: false AND isMastered: false`.

**Copy — 3 tiers based on count:**

| Due count | Title | Body |
|---|---|---|
| Exactly 1 | `"[word]" is ready for review` | `Open BananaTalk to practice it before it fades` |
| 2–5 | `[N] words are due for review` | `A quick session keeps your vocabulary sharp` |
| 6+ | `[N] words are waiting in your study queue` | `Spend 10 minutes today — your deck is ready` |

**Implementation:**
- **Replace** existing `sendReviewReminders()` in `jobs/learningJobs.js` with `sendSrsReviewReminders()`. Do not add alongside — two competing SRS reminder jobs will double-notify users. Remove the old function and its scheduler registration.
- Aggregate query: group by user, collect `dueCount` (total) and `topWord` (word field of oldest-due item via `$sort: { nextReview: 1 }, $first`), filter `dueCount >= 1`
  ```js
  Vocabulary.aggregate([
    { $match: { nextReview: { $lte: now }, isArchived: false, isMastered: false } },
    { $sort: { nextReview: 1 } },
    { $group: { _id: '$user', dueCount: { $sum: 1 }, topWord: { $first: '$word' } } },
    { $match: { dueCount: { $gte: 1 } } }
  ])
  ```
- Send via `notificationService.send(userId, 'system', notification)`
- Gate: `notificationSettings.vocabularyReviewReminders !== false` AND `notificationSettings.enabled !== false` AND user has ≥1 FCM token — matches existing `sendReviewReminders()` gate pattern exactly
- **Scheduler:** Register in `jobs/scheduler.js` as `scheduleSrsReviewReminders()` using `getMillisecondsUntil(9, 0)` with 24-hour repeat — same pattern as `scheduleInactivityJob()`. Do NOT wire into `startLearningJobs()` (that function uses fixed-interval setIntervals, not time-of-day scheduling).

**Template function:** `getSrsReviewTemplate(dueCount, topWord)` — add to `notificationTemplates.js`
- `topWord`: the `word` field of the oldest-due vocabulary item (for the count=1 case)
- Three copy tiers: exactly 1 / 2–5 / 6+

---

### 9. Correction accepted — event push (NEW)

**Trigger:** When `acceptCorrection` endpoint is called successfully (`controllers/advancedMessages.js`).

**Push recipient:** The corrector (`correction.corrector`) — not the receiver.

**Copy:**
- Title: `[receiverName] accepted your correction`
- Body: `Your fix helped — they accepted it in your conversation`

**Implementation:** In `advancedMessages.js`, the `acceptCorrection` controller calls `await message.acceptCorrection(correctionId)` which mutates the subdoc and saves internally — there is no `correction` variable in scope after that call. Capture the corrector ID **before** calling the model method:

```js
// Before calling message.acceptCorrection():
const correction = message.corrections.id(correctionId);
if (!correction) return next(new ErrorResponse('Correction not found', 404));
const correctorId = correction.corrector;
const accepterName = req.user.name || 'Someone';

await message.acceptCorrection(correctionId); // existing call

// After save — notify corrector:
const notification = templates.getCorrectionAcceptedTemplate(accepterName);
await notificationService.send(correctorId, 'system', notification);
```

`notificationService` has no `createNotification` method — use `notificationService.send(userId, type, notificationObject)` which is the correct API used throughout the codebase.

**Template:** `getCorrectionAcceptedTemplate(accepterName)` — add to `notificationTemplates.js`

---

## What is NOT in scope

- Email HTML template visual redesign (layout, colors — out of scope for this wave)
- Transactional push notifications (new like, new comment, new follower, profile visit, wave/match) — these are event-driven and personalized already; functional as-is
- Auth emails (welcome, password change, new sign-in) — functional, not user-retention messages
- Admin report emails — internal only

---

## Acceptance criteria

| # | Criterion |
|---|---|
| A1 | 7-day inactivity email subject references target language (or "your target language" fallback) |
| A2 | No deactivation threat language in 21-day or 28-day emails |
| A3 | Weekly digest shows vocab stats (words reviewed + saved), not moment likes |
| A4 | Re-engagement push variants reference `language_to_learn` where set |
| A5 | VIP expiring push names AI Tutor + translation specifically |
| A6 | SRS reminder sent only to users with ≥1 due word; correct copy tier (1 / 2–5 / 6+); replaces old `sendReviewReminders()`, no duplicate sends |
| A7 | Correction accepted push sent to corrector (not receiver) after F1a accept action |
| A8 | No new notifications sent to users with `notificationSettings.enabled: false` |
