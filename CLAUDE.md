# CLAUDE.md — BananaTalk Backend

Working agreements for any Claude session in this repo. Read this end-to-end at the start of every session. Updated 2026-05-14.

---

## Project context

BananaTalk is a language-exchange mobile app at ~1K active users. The product is honest about the friendship / dating / cultural-exchange spectrum that language exchange actually occupies — competing with HelloTalk and Tandem, neither of whom acknowledge the social reality of the surface.

**Architecture:** a Flutter mobile client (iOS + Android + web) talks to this Node.js/Express backend over JWT-authenticated REST. Persistence is MongoDB Atlas. The backend runs on a DigitalOcean droplet behind GitHub Actions auto-deploy from `main`. Voice rooms use LiveKit; transactional email is Mailgun; push notifications are FCM via Firebase Admin SDK; AI features (chat, story, photo, pronunciation) hit OpenAI directly. Audio/image uploads land in DigitalOcean Spaces.

**Monetization:** VIP subscription at $7.99/month via native Apple App Store + Google Play (no RevenueCat). Apple takes 30% year 1, 15% year 2+; Google equivalent. Daily quotas gate AI Study chips for non-VIP users; voice rooms and waves have separate per-tier caps. The unit economics work above ~7% free→VIP conversion.

**Active areas:** AI Study (Step 9-13A — tutor chips with quotas, gated by the atomic `consumeQuota` pattern), Community (Step 14 in planning — voice room block enforcement + anonymous profile views + functional admin reporting). Recent waves are documented under `docs/superpowers/plans/` and `docs/superpowers/recon/`. The product process docs (Flutter repo, `docs/AI_STUDY_PROCESS.md` + `docs/COMMUNITY_PROCESS.md`) describe the user-facing surfaces.

---

## Working agreements

**Cadence.** Drive uninterrupted through plans. Surface only at task boundaries (G1 — the manual smoke gate) or on a genuine blocker (missing env var, file path doesn't exist, scope conflict). Don't stop mid-task to ask permission for things the plan already authorized.

**Recon → Plan → Execute → Smoke → Merge.** Never skip a step. Each step gets its own commit (or commit set). The recon makes the plan honest; the plan makes the execution mechanical; the smoke makes the merge safe.

**Plans are docs, not chat messages.** Plans live at `docs/superpowers/plans/YYYY-MM-DD-stepNN-name-plan.md`. Recons at `docs/superpowers/recon/YYYY-MM-DD-stepNN-name-recon.md`. Both committed before execution. The chat is for clarifying questions; the markdown is the contract.

**No execution without an approved plan.** Plan revisions happen on a `feat/stepNN-shortname-planning` branch, separate from the `feat/stepNN-shortname` execution branch. The user approves the plan before any code changes start.

**Scope discipline.** A wave handles a defined set of issues. Out-of-scope items go to `docs/manual-todos.md` under Queued engineering. No "while I'm here let me also fix..." Surface anything that looks like scope creep before expanding.

---

## Commit conventions

Conventional commits: `feat(area): subject` / `fix(area): subject` / `docs(area): subject` / `chore: subject` / `refactor: subject`. Areas in active use here: `tutor`, `vip`, `privacy`, `safety`, `analytics`, `plans`, `recon`, `manual-todos`.

- **Subject**: present tense, lowercase first letter after the colon, no trailing period, max 72 chars.
- **Body**: wrap at 72. Explain what + why + edge cases handled. Reference audit issues by number, plan task IDs, recon findings.
- **No `Co-Authored-By` lines.** No marketing copy. No emoji in commit messages.
- **Each plan task = one commit.** Don't bundle tasks. Don't split a task across commits unless the plan explicitly says so.
- **Multi-line bodies use HEREDOC** to preserve formatting: `git commit -m "$(cat <<'EOF' ... EOF\n)"`.

Examples (real, from the log):

```
feat(vip): atomic consumeQuota + getQuotasSnapshot helpers
fix(tutor): filter pronunciation: prefix from daily plan grammar drill topic
feat(privacy): AudioCache orphan-blob purge job
docs(plans): Step 14 safety wave plan revision 3
```

---

## Branch naming

- **Feature work:** `feat/stepNN-shortname` (e.g. `feat/step13a-vip-gating`, `feat/step14-safety-wave`)
- **Planning:** `feat/stepNN-shortname-planning` — separate from execution; plan revisions happen here, never on the execution branch
- **Hotfix:** `fix/short-description`
- **Chore:** `chore/short-description` (this file, docs cleanups, etc.)
- **Merge to main:** always `--no-ff` to preserve branch history. Delete the local feature branch after merge.
- **Both repos use the same branch name** for a wave so the cross-repo correspondence is obvious.

---

## Tech stack defaults

When introducing something new in this repo, use the existing tool. Don't reinvent.

- **Runtime:** Node.js (any LTS) + Express + Mongoose.
- **Database:** MongoDB Atlas. No Postgres, no MySQL, no Redis (other than the in-process cache utilities). No new persistence layers.
- **Authentication:** JWT. The canonical middlewares are `middleware/auth.js#protect` (strict, 401 on failure) and `middleware/auth.js#optionalAuth` (soft, sets `req.user = null` on failure). The canonical authorization middleware is `middleware/auth.js#authorize('admin')` — there's only one binary role: `user` or `admin`.
- **Email:** Mailgun via `utils/sendEmail.js` (wraps the API client) + `services/emailService.js` (typed helpers per use case) + `utils/emailTemplates.js` (subject/text/html per template). Admin email goes to `process.env.ADMIN_EMAIL || 'bananatalkmain@gmail.com'`.
- **Push notifications:** FCM via `services/fcmService.js` / `services/notificationService.js`. Per-user preferences live on `User.notificationPreferences`.
- **File storage:** DigitalOcean Spaces via `services/storageService.js` (`uploadToSpaces`, `deleteFromSpaces`). NOT S3 directly. NOT Firebase Storage. Spaces is S3-compatible but go through the helper.
- **Voice rooms:** LiveKit. Server SDK via `services/livekitService.js` (token minting) + `services/livekitAdminService.js` (`endRoom`, `disconnectParticipant`). Socket events live in `socket/voiceRoomHandler.js`. Heartbeat is 20s client → 60s server stale threshold → 30s host grace timer.
- **AI:** OpenAI direct via `services/aiProviderService.js#chatCompletion` and `services/speechService.js` (Whisper + TTS). Don't use third-party wrappers (no LangChain, no Vercel AI SDK).
- **Subscriptions:** native Apple App Store Server Notifications + Google Play Real-time Developer Notifications. Webhooks in `routes/purchases.js` + `controllers/iosPurchase.js` + `controllers/androidPurchase.js`. Expiry handled by `jobs/subscriptionExpiryJob.js`. NOT RevenueCat.
- **Scheduled jobs:** `jobs/scheduler.js` registers all background work via setTimeout loops keyed off KST midnight. Plug new jobs into `startScheduler()`.
- **Logging:** `console.log` for routine work, `logSecurityEvent` for security-relevant events (auth failures, reports, bans). No third-party log aggregator.
- **Cost-aware caching:** `utils/cache.js` (in-process, TTL-bounded). Used by `getBlockedUserIds` (120s TTL) — mirror this pattern for any per-user lookup that fans out across the codebase.

---

## Anti-patterns — don't do these

- **Don't add RevenueCat or any subscription wrapper.** Native APIs only.
- **Don't introduce new HTTP status codes.** 4xx/5xx semantics are already covered. No 402, no custom codes. Use 429 + a structured body for quota exhaustion (see `checkTutorQuota` middleware for the pattern).
- **Don't add new dependencies without explicit user approval.** When in doubt, find an existing pattern. The repo already has more than enough surface area.
- **Don't create schema fields without implementation.** No aspirational `recording_enabled`-style fields. If you can't ship the feature this wave, don't ship the schema. (The existing `VoiceRoom.settings.recordingEnabled` is the exact mistake this rule exists to prevent.)
- **Don't ship features documented in markdown but not in code.** The product process docs should describe what's actually working. Aspirational behavior gets marked ❌ in the §3 status tables.
- **Don't refactor unrelated code during a feature wave.** Refactoring is its own wave with its own plan. Cleanups can ride a feature commit only if they're touching the same line.
- **Don't use `process.env.X || 'fallback'` inline more than once per file.** Extract to a `const` at the top so the fallback is single-sourced.
- **Don't catch errors silently.** Either handle + log + recover, or let it bubble. `catch (e) {}` is forbidden.
- **Don't add TODOs to `main`.** Open TODOs go to `docs/manual-todos.md`. Code comments that say "TODO" without a queued task are noise.
- **Don't trust client-side time/identity/money.** Server is source of truth for "what day is it" (UTC midnight resets), user IDs, and quota counts.
- **Don't use the sync-counter pattern for shared mutable state.** `this.field += 1; await this.save()` is race-prone. Use `findOneAndUpdate` with a pipeline update or `$inc` for any counter that could race across concurrent requests. `User.consumeQuota` is the canonical pattern.

---

## Decision-making defaults

- **Time / identity / money: server is source of truth.** Never trust client-side timestamps, user IDs, or quota counts. Server resolves UTC date, computes caps, writes records.
- **Fail closed on auth, fail open on telemetry.** A failed auth check rejects the request (403). A failed analytics fire is debug-logged and swallowed — never blocks the user.
- **Atomic over sync-then-update.** Use MongoDB atomic operators (`$inc`, `$set`, `findOneAndUpdate` with `$expr` + pipeline) for any counter that could race. The pre-Step-13A sync-counter pattern (`field += 1; save()`) is legacy; don't add new ones.
- **Prefer existing primitives.** `getBlockedUserIds` for block enforcement (`utils/blockingUtils.js` — bidirectional, cached 120s). `consumeQuota` for daily limits (`models/User.js` — atomic check-and-increment + snapshot). `sendEmail` for email (`utils/sendEmail.js`). Don't reinvent.
- **Privacy: server-resolve preferences.** Don't trust the client to send a privacy flag like `isAnonymous`. Read the user's preference on the server from `privacySettings` and resolve there.

---

## How to write a plan

Plans live at `docs/superpowers/plans/YYYY-MM-DD-stepNN-name-plan.md`. The canonical format is `2026-05-14-step14-safety-wave-plan.md` (revision 3). Required sections, in order:

1. **Header** — Goal + Architecture + Tech Stack + Recon reference + Branches + Estimated commits + Pacing note
2. **Hard constraints** — out of scope, no new deps, repo branches, commit-message style. Restate every wave so it doesn't drift.
3. **Edge cases handled** — enumerate explicitly. "X happens when Y → behavior is Z."
4. **Design decisions** — numbered, each with rationale and rejected alternatives. The rejected-alternatives section is the meta-skill; it forces the writer to explain *why not the other options*.
5. **File structure** — Modify / Create columns per repo. List every file that gets touched.
6. **Critical decisions** — separate from design decisions; these are architectural choices baked into the implementation (e.g., "atomic check-and-increment via pipeline update").
7. **Numbered tasks** — `B1`, `B2`, ... for backend; `F1`, `F2`, ... for Flutter; `G1` for the manual smoke. Each task has explicit Steps (Read / Modify / Verify / Commit).
8. **Verification commands per task** — `node -c`, `flutter analyze`, `npm test`. Show expected output.
9. **Conventional-commit-format messages drafted, not placeholders.** The executor pastes; the reviewer reads in `git log` later.
10. **Final G1 task** with manual smoke checklist (curl + physical device + telemetry verification).
11. **Cadence guidance + Risk/rollback** at the end. Risk section names the highest-risk task explicitly + the rollback path.
12. **Appendices** — "what's NOT in this wave" restated + any operational notes (env vars to set, manual one-time steps).

If the executor discovers something that wants to expand scope during execution, it goes to `docs/manual-todos.md` Queued engineering, not into the current plan.

---

## How to write a recon

Recons live at `docs/superpowers/recon/YYYY-MM-DD-stepNN-name-recon.md`. The canonical format is `2026-05-14-step14-safety-wave-recon.md`. Required:

1. **Cross-cutting findings up front.** Existing infrastructure to reuse, primitives that the plan should mirror. Saves the planner from reinventing.
2. **Per-issue sections** — for each item under investigation, give file paths, line numbers, and actual code snippets. "What exists today" + "what's missing" + implications.
3. **Edge cases the plan must address** — these flow into the plan's Edge cases section.
4. **Three-option comparison for any meaningful design choice.** Don't pre-decide; lay out A/B/C with tradeoffs so the user can push back.
5. **Punted findings** — things found out of scope. Name them, file them to `docs/manual-todos.md` Queued engineering, and reference the file path in the recon.

Recon is read-only. No fixes proposed. No plan drafted. Just facts.

---

## Manual TODOs queue

`docs/manual-todos.md` has three sections:

- **👤 Humans only** — Firebase Console config, App Store submissions, OpenAI billing dashboard, physical-device smoke tests. Things only a real person can do.
- **🛠️ Queued engineering** — bugs/improvements found during recon that are out of scope for the current wave. The next agent session picks these up.
- **✅ Completed** — archive of done items (rare; mostly we just delete or move to Completed when a wave ships).

When a recon finds a bug out of scope, the recon's "Punted findings" section names it AND adds an entry to `manual-todos.md` Queued engineering. When a plan is approved, only the in-scope items execute; out-of-scope stays queued.

---

## Smoke test discipline

Every wave's G1 task has a real smoke checklist. Categories:

- **Backend curl smoke (15 min)** — token + endpoint test, dev server (`npm run dev`), `jq` verification of response shape.
- **Physical device smoke (30-60 min)** — iOS physical + Android physical, real user flows. Sandbox purchases on simulator/emulator are flaky and don't exercise the actual webhook race.
- **Telemetry verification** — Firebase DebugView for analytics events, email inbox for transactional, OpenAI dashboard for cost spikes.
- **Database verification** — query the actual records changed. `mongo` shell + `db.users.findOne(...)` etc.

Smoke test is non-negotiable. **Don't merge without it.** A passing CI is not a smoke test. "Looks fine in simulator" is not a smoke test.

---

## What to surface to the user

The agent drives uninterrupted through tasks. Surface only when:

- A required environment variable or external state is missing (Firebase Console settings, OpenAI API key, Mongo connection string).
- A plan task discovers the scope was wrong — the recon was inaccurate, the plan needs revision before continuing.
- The G1 smoke checklist is reached and needs the user to run physical device tests / inspect Firebase DebugView.
- Genuine blocker: file doesn't exist, dependency conflict, security concern.

**Do NOT surface for:**

- Routine questions about file paths (use `grep` / `Read`).
- Permission to make obvious changes the plan already approved.
- "Should I commit now?" — yes, after each plan task per the plan.
- "Should I run tests?" — yes, per the Verify step in each task.

---

## Things specific to this project

- **`User.regularUserLimitations` / `User.visitorLimitations` daily counters (`messagesSentToday`, etc.) are LEGACY.** They use the sync-counter pattern (`field += 1; save()`) which is race-prone. New daily quotas use the atomic `consumeQuota` pattern from Step 13A. Don't extend the legacy fields; add new ones via the atomic helper.
- **The `Wave.js` 24h cooldown index has a known bug** — the `partialFilterExpression` captures `Date.now()` once at server boot, so the 24h window doesn't roll forward. Documented in audit issue #1 / queued in `manual-todos.md` for the bug wave. Don't copy this pattern.
- **LiveKit pricing is unbounded for VIP.** A single heavy VIP user could rack up $2k+/month on a $7.99 subscription. Don't add new VIP voice-room features without thinking about the cost ceiling. Audit issue #10 / queued.
- **The `VoiceRoom.settings.recordingEnabled` field exists in the schema with ZERO implementation.** No LiveKit Egress wired, no playback, no GDPR participant notification. Don't toggle it on or build UI for it without the user's explicit approval — the GDPR notification requirements alone make this a real legal liability.
- **`AI_QUOTA_ENABLED` env var is the emergency kill switch** for the Step 13A tutor chip quotas. Set to `false` + restart to disable enforcement without a code deploy. Defaults to `true` if unset.
- **Auto-deploy from `main`.** GitHub Actions pushes to the DigitalOcean droplet on every merge to main. Merging is a deploy. Test before merging.
- **The `protect` middleware is the auth boundary.** It does `findById(decoded.id)` (NOT `.lean()`) — so `req.user` is a full Mongoose doc with instance methods. Don't break this assumption; downstream code calls `req.user.isVIP()`, `req.user.getQuotasSnapshot()`, etc.

---

## Reference shortlist

- **Canonical plan format:** `docs/superpowers/plans/2026-05-14-step14-safety-wave-plan.md`
- **Canonical recon format:** `docs/superpowers/recon/2026-05-14-step14-safety-wave-recon.md`
- **Product process docs (Flutter repo, paired surface):** `docs/AI_STUDY_PROCESS.md`, `docs/COMMUNITY_PROCESS.md`
- **Manual TODOs queue (Flutter repo):** `docs/manual-todos.md`
- **Atomic counter pattern:** `models/User.js#consumeQuota`
- **Block enforcement primitive:** `utils/blockingUtils.js#getBlockedUserIds`
- **Email infrastructure:** `utils/sendEmail.js` + `services/emailService.js`
- **Scheduled jobs entrypoint:** `jobs/scheduler.js#startScheduler`
