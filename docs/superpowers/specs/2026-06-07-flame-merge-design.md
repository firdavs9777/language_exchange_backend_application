# Flame Backend Port into BananaTalk Repo — Design

**Date:** 2026-06-07
**Status:** Design approved, ready for implementation plan
**Owner:** firdavs9777

## Goal

Port the Python (FastAPI) Flame backend at `~/Desktop/Flame/flame_backend` into the existing BananaTalk Node.js/Express repo as a self-contained sub-application, served under `https://api.bananatalk.com/flamebackend/v1/*`. Flame must:

- Share the BananaTalk Node.js server process, domain, and infrastructure.
- Use its own MongoDB database (separate connection, separate cluster).
- Run alongside BananaTalk with **zero changes to existing BananaTalk code** beyond a minimal additive patch to `server.js`.
- Apply architectural upgrades during the port (cleaner separation, validation at the edge, typed errors, explicit indexes) — no behavior changes beyond architecture cleanup.
- **Skip the billing module in this phase** (deferred). Six modules in scope: core, auth, users, models, community, chat.

## Non-goals

- Touching, refactoring, or "improving" any BananaTalk file outside the additive `server.js` patch.
- Sharing users, auth, models, or data between Flame and BananaTalk.
- Reusing Python source code or running a Python process — this is a Node.js rewrite.
- Porting Flame's billing module (deferred).
- Adding new Flame features that did not exist in the Python version.
- Optimizing performance beyond standard Mongoose pool settings and explicit indexes.

## Scope summary

- ~7,600 lines of Python → idiomatic Node.js/Express across 6 modules.
- Realtime chat ported from raw `websockets` to a Socket.IO namespace (`/flame`) on the existing `io` instance, matching BananaTalk's realtime style.
- Estimated effort: **~9–13 working days** of focused work (~2 weeks elapsed).

## Architecture

### File layout

```
backend/
├── server.js                          ← +~6 lines (described below)
├── controllers/ routes/ models/ ...   ← BananaTalk, UNTOUCHED
└── flame/                             ← Entire Flame app, self-contained
    ├── index.js                       ← exports a single Express router mounted at /flamebackend/v1
    ├── db.js                          ← mongoose.createConnection() → flameConn; export connect()/getConn()
    ├── config/
    │   └── env.js                     ← reads & validates FLAME_* env vars at startup
    ├── middleware/
    │   ├── auth.js                    ← Flame JWT verification (FLAME_JWT_SECRET)
    │   ├── error.js                   ← Flame-only error handler
    │   ├── validate.js                ← zod request-shape validation
    │   ├── cors.js                    ← scoped CORS (FLAME_ALLOWED_ORIGINS)
    │   └── asyncHandler.js            ← wraps controllers, forwards rejections to error.js
    ├── models/                        ← Each model bound via getConn().model(...)
    │   ├── User.js
    │   ├── Conversation.js  Message.js
    │   ├── Post.js  Comment.js
    │   └── (additional Flame schemas)
    ├── controllers/
    │   ├── authController.js
    │   ├── userController.js
    │   ├── chatController.js
    │   └── communityController.js
    ├── routes/
    │   ├── auth.js        → /auth/*
    │   ├── users.js       → /users/*
    │   ├── chat.js        → /chat/*
    │   └── community.js   → /community/*
    ├── services/                      ← business logic, no Express dependency
    │   ├── authService.js
    │   ├── userService.js
    │   ├── chatService.js
    │   ├── postService.js
    │   └── commentService.js
    ├── sockets/
    │   ├── index.js                   ← registerFlameSockets(io): mounts /flame namespace
    │   └── chatSocket.js              ← per-connection chat handlers
    └── utils/
        ├── errors.js                  ← FlameError / AuthError / NotFoundError / ValidationError
        ├── logger.js
        └── s3.js                      ← Flame's own S3/Spaces client
```

**Rationale:** mirrors BananaTalk's mental model (controllers / routes / models / services) so context-switching between the two apps is cheap, but every file under `flame/` only knows about Flame. No cross-imports between `flame/` and the rest of `backend/`.

### `server.js` integration

The only file in BananaTalk's tree that changes. All additions, no edits to existing logic:

```js
// New imports
const flameRouter = require('./flame');
const { connect: connectFlameDb } = require('./flame/db');
const registerFlameSockets = require('./flame/sockets');

// ... existing express + io setup ...

connectDb();                  // existing — BananaTalk DB
await connectFlameDb();       // NEW — Flame DB (separate mongoose.createConnection)

// After existing BananaTalk routes are mounted:
app.use('/flamebackend/v1', flameRouter);   // NEW

// After io is created:
registerFlameSockets(io);     // NEW — io.of('/flame')
```

**Loading order:** `connectFlameDb()` resolves before `require('./flame')` runs (eager init), so model files can safely call `getConn().model(...)` at the top level. This matches how BananaTalk's `connectDb()` already works.

**Graceful shutdown:** the existing SIGTERM handler gains one line — `await flameConn.close()` — so Flame writes aren't dropped on deploy.

**Health endpoint:** the existing `/health` route adds a `dbFlameStatus` field that pings the Flame connection. Same endpoint, no new route.

**Failure isolation:** `connectFlameDb()` is wrapped in try/catch. If Flame fails to start (bad env, unreachable Mongo), the server logs `"Flame disabled: <reason>"` and BananaTalk continues serving normally. No Flame failure can take down BananaTalk.

### Dual database connection

`flame/db.js`:

```js
const mongoose = require('mongoose');

let flameConn = null;

async function connect() {
  if (flameConn) return flameConn;

  flameConn = mongoose.createConnection(process.env.FLAME_MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  flameConn.on('connected',    () => console.log('🔥 Flame MongoDB connected'));
  flameConn.on('error',        (err) => console.log(`🔴 Flame Mongo Error: ${err.message}`));
  flameConn.on('disconnected', () => console.log('🟡 Flame MongoDB disconnected'));

  await flameConn.asPromise();
  return flameConn;
}

function getConn() {
  if (!flameConn) throw new Error('Flame DB not initialized');
  return flameConn;
}

module.exports = { connect, getConn };
```

Every Flame model binds to this connection, not the global Mongoose instance:

```js
// flame/models/User.js
const mongoose = require('mongoose');
const { getConn } = require('../db');

const userSchema = new mongoose.Schema({ /* ... */ }, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });

module.exports = getConn().model('User', userSchema);
```

Two `User` collections (one per DB), zero cross-talk, structurally impossible to query the wrong database.

### URL convention

All Flame URLs live under one prefix and follow REST conventions:

```
https://api.bananatalk.com/flamebackend/v1/auth/login
https://api.bananatalk.com/flamebackend/v1/auth/refresh
https://api.bananatalk.com/flamebackend/v1/users/me
https://api.bananatalk.com/flamebackend/v1/users/:id
https://api.bananatalk.com/flamebackend/v1/community/posts
https://api.bananatalk.com/flamebackend/v1/community/posts/:id/comments
https://api.bananatalk.com/flamebackend/v1/chat/conversations
https://api.bananatalk.com/flamebackend/v1/chat/conversations/:id/messages
```

**Conventions:**

- **Versioning** — `/v1` in the URL, not in folder names. v2 can mount alongside without disturbing v1.
- **Resources** — plural nouns, nested for sub-resources, verbs only for non-CRUD actions (`/auth/login`, `/auth/refresh`).
- **Response envelope** — `{ success: boolean, data: ..., error: { code, message } }`. Consistent across every endpoint.
- **Pagination** — `?page=1&limit=20`, response includes `{ data, meta: { page, limit, total } }`.
- **Errors** — `{ success: false, error: { code: 'AUTH_INVALID_TOKEN', message: 'human readable' } }`. Stack traces never leak in production.

### Auth — fully separate from BananaTalk

Two independent JWT systems on one server:

| Concern | BananaTalk | Flame |
|---|---|---|
| Secret | `JWT_SECRET` | `FLAME_JWT_SECRET` |
| Refresh secret | (existing) | `FLAME_JWT_REFRESH_SECRET` |
| Issuer claim | `bananatalk` | `flame` |
| Middleware | `middleware/auth.js` | `flame/middleware/auth.js` |
| User collection | BananaTalk DB → `users` | Flame DB → `users` |
| OAuth client IDs | (existing) | `FLAME_GOOGLE_CLIENT_ID`, `FLAME_APPLE_CLIENT_ID` |

A Flame token presented to a BananaTalk route fails signature verification → 401. Vice versa. Cross-contamination is structurally impossible, not just convention.

### WebSockets — share `io`, isolate via namespace

Rather than spinning up a second WS server, Flame mounts a namespace on BananaTalk's existing `io` instance:

```js
// flame/sockets/index.js
module.exports = function registerFlameSockets(io) {
  const flameNs = io.of('/flame');

  flameNs.use(async (socket, next) => {
    // verify FLAME_JWT_SECRET from socket.handshake.auth.token
    // attach socket.user, then next()
  });

  flameNs.on('connection', (socket) => {
    require('./chatSocket')(flameNs, socket);
  });
};
```

Clients connect via `io('/flame', { auth: { token } })`. BananaTalk clients continue using the default namespace `/`. Same server, same port, fully isolated event bus and auth middleware.

Porting from Python's raw `websockets` to Socket.IO gains reconnection, ack support, and room semantics — the main pain points of the FastAPI version.

## Module port plan

| Flame Python module | Node.js destination | Complexity | Upgrades applied |
|---|---|---|---|
| `app/core` | `flame/config/env.js`, `flame/middleware/error.js`, `flame/utils/*` | Low | Centralized env validation (zod), single error formatter |
| `app/auth` | `flame/middleware/auth.js`, `flame/controllers/authController.js`, `flame/services/authService.js` | Medium | Controllers/services split, refresh-token rotation |
| `app/models` | `flame/models/*.js` | Medium | Explicit indexes per model, `ref`/`populate` instead of Beanie `Link` |
| `app/users` | `flame/controllers/userController.js`, `flame/routes/users.js`, `flame/services/userService.js` | Low | Edge validation, no fat models |
| `app/community` | `flame/controllers/communityController.js`, `flame/services/{postService,commentService}.js` | Medium | Posts/comments split at service layer, optimistic counters via `$inc` |
| `app/chat` | `flame/controllers/chatController.js`, `flame/sockets/chatSocket.js`, `flame/services/chatService.js` | High | WS → Socket.IO namespace `/flame` |
| ~~`app/billing`~~ | — | — | **Deferred to a later phase** |

### Architecture upgrades applied across all modules

- **3-layer separation**: `routes → controllers → services`. Routes validate + call controller. Controllers parse req/res + call service. Services hold business logic, testable without Express.
- **Validation at the edge**: every route gets a zod schema. Bad input never reaches a controller.
- **No fat models**: Mongoose schemas hold schema + indexes only; no business logic methods.
- **One error path**: services throw typed errors (`AuthError`, `NotFoundError`, `ValidationError`); `error.js` middleware turns them into the response envelope.
- **No top-level try/catch boilerplate**: an `asyncHandler` wrapper around controllers forwards rejections to the error middleware.
- **Explicit indexes**: every queried field gets a declared index in the model file.

### Shared infrastructure ported alongside the modules

- **Image & video upload (DigitalOcean Spaces / S3)** — implemented as `flame/utils/s3.js`, ported once during the `core` step. Used by `users` (avatars), `community` (post media), and `chat` (attachments). Not a standalone module.

  **Credentials are shared with BananaTalk, storage is isolated.** The Flame S3 client reuses the existing BananaTalk env vars `SPACES_ENDPOINT`, `DO_SPACES_KEY`, `DO_SPACES_SECRET` (same DigitalOcean account), but writes to a **separate bucket** identified by a new env var `FLAME_SPACES_BUCKET`. Effect: one set of credentials to rotate, but Flame and BananaTalk objects can never collide, and either bucket can be wiped/migrated independently.

  Implementation note: `flame/utils/s3.js` does not `require('../../config/spaces.js')` — it constructs its own `AWS.S3` instance from the same env vars. This preserves the "no cross-imports from `flame/` into BananaTalk code" rule, at the cost of one duplicated 5-line client setup.

  Video handling in this phase is upload + store only (no server-side transcoding), matching the Python source which uses Pillow for images and stores other media as-is.

- **Redis** — optional. Used in Python Flame for caching and rate limiting. Decision deferred to the `core` step: include if the original logic genuinely depends on it, otherwise drop and use in-memory rate limiting for v1.

### Port order

Each module ships behind a smoke test before the next one starts — we never have 7,600 lines half-ported.

1. **core + db + shared utils (s3, optional redis)** (scaffolding)
2. **models** (everyone depends on these)
3. **auth** (everything else gates on it)
4. **users** (simplest CRUD; validates the stack end-to-end)
5. **community** (medium complexity, no realtime)
6. **chat** (realtime, hardest)

## Error handling

```js
// flame/utils/errors.js
class FlameError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
class AuthError       extends FlameError { constructor(c, m) { super(c, m, 401); } }
class NotFoundError   extends FlameError { constructor(m='Not found') { super('NOT_FOUND', m, 404); } }
class ValidationError extends FlameError { constructor(m) { super('VALIDATION', m, 422); } }
```

Services throw these. Controllers don't catch — `asyncHandler` wraps them so rejections bubble to:

```js
// flame/middleware/error.js
module.exports = (err, req, res, next) => {
  if (err instanceof FlameError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  }
  console.error('🔴 Flame unhandled error:', err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } });
};
```

Mounted at the end of the Flame router, so it only catches errors from `/flamebackend/v1/*`. BananaTalk's error handling is unaffected.

## Testing

- **Smoke tests per module** — one happy-path integration test per route using Jest + supertest, against `mongodb-memory-server` bound to `flameConn`. Goal: "this endpoint isn't broken," not 100% coverage.
- **Unit tests per service** — services are pure-ish (take a Mongoose model + inputs), easy to test without HTTP.
- **No new tests on BananaTalk** — we don't refactor it, no new test obligations there.

## Deployment

Zero new infrastructure:

- Same Node process, same `pm2` / Docker container.
- Same domain `api.bananatalk.com`, same nginx (the `/flamebackend/v1` prefix routes naturally).
- **New requirement:** Flame's MongoDB cluster reachable from the server. If it isn't already, that's a network/firewall task before first deploy.
- Health check at `/health` reports both DBs; alerts on either being down.

## Environment variables

All new vars are `FLAME_` prefixed so they can't collide with BananaTalk's existing config:

```
FLAME_MONGO_URI=
FLAME_JWT_SECRET=
FLAME_JWT_REFRESH_SECRET=
FLAME_REDIS_URL=          # optional; only if Flame needs caching/rate limiting
FLAME_SPACES_BUCKET=      # Flame's own bucket; SPACES_ENDPOINT/DO_SPACES_KEY/DO_SPACES_SECRET are shared with BananaTalk
FLAME_GOOGLE_CLIENT_ID=
FLAME_APPLE_CLIENT_ID=
FLAME_ALLOWED_ORIGINS=    # comma-separated for CORS scoped to /flamebackend/v1
```

All loaded and validated in `flame/config/env.js` at startup. Missing required vars cause `connectFlameDb()` to throw, the server logs `"Flame disabled: missing env"`, and BananaTalk continues serving.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Flame startup error takes down BananaTalk | Wrap `connectFlameDb()` in try/catch; log and continue without Flame |
| Cross-contamination between databases | Models bind via `getConn().model(...)`, never `mongoose.model(...)` — wrong-DB queries are structurally impossible |
| Token confusion between apps | Separate JWT secrets; Flame tokens fail signature check on BananaTalk routes and vice versa |
| Global `express.json()` breaks future webhook signature verification | Mount per-route `express.raw()` in the relevant route file when webhooks are added (billing is deferred for now) |
| Mongoose model loading order | Eager init: `await connectFlameDb()` before `require('./flame')` in `server.js` |
| Different CORS needs between apps | Scoped CORS middleware on `/flamebackend/v1` reading `FLAME_ALLOWED_ORIGINS`, independent of global CORS |
| Socket.IO namespace collision | `/flame` namespace is isolated from default `/`; separate auth middleware |
| 7,600-line port losing momentum | Strict per-module ship cadence — each module passes its smoke test before the next starts |

## Effort estimate

| Task | Days |
|---|---|
| Set up dual-DB infra + `/flamebackend/v1/*` mount + `server.js` patch | 0.5 |
| Port `core` (config, env validation, error handling, middleware, s3 util, optional redis) | 1.5–2 |
| Port `models` | 1 |
| Port `auth` (JWT, social login) | 1–2 |
| Port `users` (incl. avatar upload wiring) | 1 |
| Port `community` (posts, comments, likes, post images) | 1–2 |
| Port `chat` (incl. Socket.IO namespace, attachments) | 2–3 |
| Tests, smoke check on `api.bananatalk.com/flamebackend/v1/*` | 1–2 |
| **Total** | **~9–13 working days (~2 weeks elapsed)** |

## Open questions for implementation phase

- Exact field-level diff between Python schemas and the Node.js Mongoose schemas — to be enumerated during the `models` step, not now.
- Whether Flame's existing Redis usage (caching, rate limiting) is required from day one or can be deferred — to be decided when porting `core`.
- Whether Flame's image-upload pipeline keeps existing object-storage keys (so existing URLs continue to work) or starts fresh in the new `FLAME_SPACES_BUCKET` — to be confirmed before porting upload code. If existing keys must survive, a one-time copy from the Python-era bucket into `FLAME_SPACES_BUCKET` is required.
