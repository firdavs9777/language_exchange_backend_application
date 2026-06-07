# Flame Foundation Slice — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Flame backend's foundation slice inside `backend/` — scaffolding, error/auth/validation middleware, dual MongoDB connection, the User & RefreshToken models, full email/password auth flow (register/login/refresh/logout), and the core user CRUD endpoints — all mounted under `/flamebackend/v1/*` without touching BananaTalk code beyond an additive `server.js` patch.

**Architecture:** A self-contained Express sub-router under `backend/flame/` that binds its own Mongoose connection (`mongoose.createConnection(FLAME_MONGO_URI)`) so Flame's collections live in a separate database from BananaTalk. Auth uses its own JWT secret (`FLAME_JWT_SECRET`). Object storage reuses BananaTalk's DigitalOcean Spaces credentials but writes to its own bucket (`FLAME_SPACES_BUCKET`). Three-layer architecture per module: `routes → controllers → services`, with zod request validation at the edge and typed errors funneled through one error middleware.

**Tech Stack:** Node.js, Express 4, Mongoose 6 (using `createConnection`), bcryptjs, jsonwebtoken, zod, aws-sdk v2 (DigitalOcean Spaces), multer (file uploads), `node --test` + supertest + mongodb-memory-server (testing — matches BananaTalk's existing `npm test` runner).

**Scope (Plan 1):** Phases 1–4 of the design — `core/scaffolding` + `models (user, refresh_token)` + `auth (email/password)` + `users (profile CRUD + photo upload)`. Estimated 5–6 working days.

**Out of scope (deferred to Plan 2):** social auth (Google/Apple/Facebook), email verification, forgot-password, community module, chat module + Socket.IO, billing.

**Spec reference:** `docs/superpowers/specs/2026-06-07-flame-merge-design.md`

---

## File Structure

This plan creates these files under `backend/flame/`. BananaTalk files are untouched except `server.js` (additive patch only).

```
backend/
├── server.js                          ← MODIFY (additive patch; ~6 new lines)
├── .env.example                       ← MODIFY (add FLAME_* vars)
├── package.json                       ← MODIFY (add zod + dev deps)
└── flame/
    ├── README.md                      ← CREATE (orientation for engineers)
    ├── index.js                       ← CREATE (Express router, error middleware mount)
    ├── db.js                          ← CREATE (createConnection + getConn)
    ├── config/
    │   └── env.js                     ← CREATE (zod env validation)
    ├── utils/
    │   ├── errors.js                  ← CREATE (FlameError + subclasses)
    │   ├── password.js                ← CREATE (bcrypt wrapper)
    │   ├── jwt.js                     ← CREATE (sign/verify access + refresh)
    │   ├── s3.js                      ← CREATE (Spaces client for Flame bucket)
    │   └── logger.js                  ← CREATE (prefixed console wrapper)
    ├── middleware/
    │   ├── asyncHandler.js            ← CREATE (forward rejections to error mw)
    │   ├── error.js                   ← CREATE (the only error responder)
    │   ├── validate.js                ← CREATE (zod request validator)
    │   ├── auth.js                    ← CREATE (JWT bearer middleware)
    │   └── cors.js                    ← CREATE (FLAME_ALLOWED_ORIGINS-scoped CORS)
    ├── models/
    │   ├── User.js                    ← CREATE (mirrors Python User schema)
    │   └── RefreshToken.js            ← CREATE (with TTL index)
    ├── services/
    │   ├── authService.js             ← CREATE (register/login/refresh/logout)
    │   └── userService.js             ← CREATE (getMe/getById/updateMe/uploadPhoto)
    ├── controllers/
    │   ├── authController.js          ← CREATE (thin HTTP layer)
    │   └── userController.js          ← CREATE (thin HTTP layer)
    ├── routes/
    │   ├── auth.js                    ← CREATE (mounts auth controller)
    │   └── users.js                   ← CREATE (mounts user controller)
    └── __tests__/
        ├── helpers/
        │   ├── app.js                 ← CREATE (builds Express app for tests)
        │   └── db.js                  ← CREATE (mongodb-memory-server bootstrap)
        ├── errors.test.js             ← CREATE
        ├── password.test.js           ← CREATE
        ├── jwt.test.js                ← CREATE
        ├── validate.test.js           ← CREATE
        ├── auth.test.js               ← CREATE (integration)
        └── users.test.js              ← CREATE (integration)
```

**Why this layout:** Mirrors BananaTalk's `controllers/routes/models/services/middleware` so context-switching is cheap, but every file under `flame/` is self-contained — no `require('../../...')` reaching outside the folder.

---

## Phase 1 — Scaffolding (Day 1)

### Task 1: Dependencies & directory skeleton

**Files:**
- Modify: `package.json` (add `zod`, devDeps `supertest`, `mongodb-memory-server`)
- Create: `flame/README.md`
- Create: empty subdirs `flame/{config,utils,middleware,models,services,controllers,routes,__tests__,__tests__/helpers}/`

- [ ] **Step 1: Install runtime dep `zod`**

Run from `backend/`:
```bash
npm install zod@^3.23.0
```

- [ ] **Step 2: Install dev deps for testing**

```bash
npm install --save-dev supertest@^7.0.0 mongodb-memory-server@^10.1.0
```

- [ ] **Step 3: Create directory skeleton**

```bash
mkdir -p flame/{config,utils,middleware,models,services,controllers,routes,__tests__/helpers}
```

- [ ] **Step 4: Create `flame/README.md`**

```markdown
# Flame Backend (sub-app of BananaTalk repo)

Self-contained Express sub-application mounted at `/flamebackend/v1/*` on the
BananaTalk Node.js server.

**Isolation rules:**
- Nothing under `flame/` imports from `../controllers`, `../models`, `../routes`,
  `../services`, `../middleware`, or `../config` (except `process.env`).
- Flame's Mongoose models bind to `flameConn` (see `flame/db.js`), never to
  the global `mongoose` instance.
- Flame uses its own JWT secret (`FLAME_JWT_SECRET`) and its own DO Spaces
  bucket (`FLAME_SPACES_BUCKET`).

**Why:** Flame and BananaTalk are different products that share a Node process,
a domain, and DO Spaces credentials. Storage namespaces, JWT identities, and
Mongo databases are fully separate.

See `docs/superpowers/specs/2026-06-07-flame-merge-design.md` for the full design.
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json flame/README.md
git commit -m "feat(flame): scaffold flame/ directory + add zod & test deps"
```

---

### Task 2: Environment configuration with validation

**Files:**
- Create: `flame/config/env.js`
- Modify: `.env.example` (add `FLAME_*` vars)
- Test: `flame/__tests__/env.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/env.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('env validation throws on missing FLAME_MONGO_URI', () => {
  const saved = { ...process.env };
  delete process.env.FLAME_MONGO_URI;
  delete require.cache[require.resolve('../config/env')];
  assert.throws(() => require('../config/env'), /FLAME_MONGO_URI/);
  process.env = saved;
  delete require.cache[require.resolve('../config/env')];
});

test('env loads with all required vars set', () => {
  const saved = { ...process.env };
  process.env.FLAME_MONGO_URI = 'mongodb://localhost:27017/flame-test';
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 'flame-test-bucket';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'key';
  process.env.DO_SPACES_SECRET = 'secret';
  process.env.FLAME_ALLOWED_ORIGINS = 'https://flame.example.com';

  delete require.cache[require.resolve('../config/env')];
  const env = require('../config/env');
  assert.equal(env.FLAME_MONGO_URI, 'mongodb://localhost:27017/flame-test');
  assert.equal(env.FLAME_SPACES_BUCKET, 'flame-test-bucket');

  process.env = saved;
  delete require.cache[require.resolve('../config/env')];
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/env.test.js
```
Expected: both tests fail because `flame/config/env.js` doesn't exist.

- [ ] **Step 3: Create `flame/config/env.js`**

```js
const { z } = require('zod');

const schema = z.object({
  FLAME_MONGO_URI: z.string().min(1, 'FLAME_MONGO_URI required'),
  FLAME_JWT_SECRET: z.string().min(32, 'FLAME_JWT_SECRET must be >= 32 chars'),
  FLAME_JWT_REFRESH_SECRET: z.string().min(32, 'FLAME_JWT_REFRESH_SECRET must be >= 32 chars'),
  FLAME_JWT_ACCESS_TTL: z.string().default('15m'),
  FLAME_JWT_REFRESH_TTL: z.string().default('30d'),
  FLAME_SPACES_BUCKET: z.string().min(1, 'FLAME_SPACES_BUCKET required'),
  FLAME_ALLOWED_ORIGINS: z.string().default(''),
  FLAME_GOOGLE_CLIENT_ID: z.string().optional(),
  FLAME_APPLE_CLIENT_ID: z.string().optional(),
  // Shared with BananaTalk — validated but reused, not duplicated:
  SPACES_ENDPOINT: z.string().min(1, 'SPACES_ENDPOINT required (shared with BananaTalk)'),
  DO_SPACES_KEY: z.string().min(1, 'DO_SPACES_KEY required (shared with BananaTalk)'),
  DO_SPACES_SECRET: z.string().min(1, 'DO_SPACES_SECRET required (shared with BananaTalk)'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid Flame environment:\n${issues}`);
}

module.exports = parsed.data;
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/env.test.js
```
Expected: both tests pass.

- [ ] **Step 5: Add Flame vars to `.env.example`**

Append to `backend/.env.example`:
```
# === Flame backend (sub-app of BananaTalk; mounted at /flamebackend/v1/*) ===
FLAME_MONGO_URI=mongodb://localhost:27017/flame
FLAME_JWT_SECRET=replace-me-with-32+-random-chars-prod
FLAME_JWT_REFRESH_SECRET=replace-me-with-different-32+-random-chars
FLAME_JWT_ACCESS_TTL=15m
FLAME_JWT_REFRESH_TTL=30d
FLAME_SPACES_BUCKET=flame-uploads
FLAME_ALLOWED_ORIGINS=https://flame.example.com,http://localhost:3001
FLAME_GOOGLE_CLIENT_ID=
FLAME_APPLE_CLIENT_ID=
# SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET are shared with BananaTalk
```

- [ ] **Step 6: Commit**

```bash
git add flame/config/env.js flame/__tests__/env.test.js .env.example
git commit -m "feat(flame): add env config with zod validation"
```

---

### Task 3: Typed errors + asyncHandler + error middleware

**Files:**
- Create: `flame/utils/errors.js`
- Create: `flame/middleware/asyncHandler.js`
- Create: `flame/middleware/error.js`
- Test: `flame/__tests__/errors.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/errors.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FlameError, AuthError, NotFoundError, ValidationError,
} = require('../utils/errors');

test('FlameError carries code, message, status', () => {
  const e = new FlameError('X', 'm', 418);
  assert.equal(e.code, 'X');
  assert.equal(e.message, 'm');
  assert.equal(e.status, 418);
  assert.ok(e instanceof Error);
});

test('AuthError defaults to 401', () => {
  const e = new AuthError('INVALID', 'bad token');
  assert.equal(e.status, 401);
  assert.equal(e.code, 'INVALID');
});

test('NotFoundError defaults to 404 NOT_FOUND', () => {
  const e = new NotFoundError();
  assert.equal(e.status, 404);
  assert.equal(e.code, 'NOT_FOUND');
});

test('ValidationError defaults to 422 VALIDATION', () => {
  const e = new ValidationError('bad input');
  assert.equal(e.status, 422);
  assert.equal(e.code, 'VALIDATION');
});
```

- [ ] **Step 2: Run test (expect FAIL — module missing)**

```bash
node --test flame/__tests__/errors.test.js
```

- [ ] **Step 3: Create `flame/utils/errors.js`**

```js
class FlameError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'FlameError';
    this.code = code;
    this.status = status;
  }
}

class AuthError extends FlameError {
  constructor(code, message) { super(code, message, 401); this.name = 'AuthError'; }
}

class NotFoundError extends FlameError {
  constructor(message = 'Not found') { super('NOT_FOUND', message, 404); this.name = 'NotFoundError'; }
}

class ValidationError extends FlameError {
  constructor(message) { super('VALIDATION', message, 422); this.name = 'ValidationError'; }
}

class ConflictError extends FlameError {
  constructor(code, message) { super(code, message, 409); this.name = 'ConflictError'; }
}

module.exports = { FlameError, AuthError, NotFoundError, ValidationError, ConflictError };
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/errors.test.js
```

- [ ] **Step 5: Create `flame/middleware/asyncHandler.js`**

```js
// Wrap an async route handler so thrown rejections forward to Express's
// error pipeline. Without this we'd need try/catch in every controller.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

- [ ] **Step 6: Create `flame/middleware/error.js`**

```js
const { FlameError } = require('../utils/errors');
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  if (err instanceof FlameError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Unexpected error: log full, return generic
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
};
```

- [ ] **Step 7: Commit**

```bash
git add flame/utils/errors.js flame/middleware/asyncHandler.js flame/middleware/error.js flame/__tests__/errors.test.js
git commit -m "feat(flame): add typed errors + asyncHandler + error middleware"
```

---

### Task 4: Logger utility

**Files:**
- Create: `flame/utils/logger.js`

(No test — it's a 5-line console wrapper; testing console output adds noise without value.)

- [ ] **Step 1: Create `flame/utils/logger.js`**

```js
const prefix = '🔥 [flame]';

module.exports = {
  info:  (...args) => console.log(prefix, ...args),
  warn:  (...args) => console.warn(prefix, ...args),
  error: (...args) => console.error(prefix, ...args),
};
```

- [ ] **Step 2: Commit**

```bash
git add flame/utils/logger.js
git commit -m "feat(flame): add prefixed logger"
```

---

### Task 5: Flame Mongoose connection

**Files:**
- Create: `flame/db.js`
- Test: `flame/__tests__/db.test.js` (uses `mongodb-memory-server`)
- Create: `flame/__tests__/helpers/db.js` (shared in-memory bootstrap)

- [ ] **Step 1: Create `flame/__tests__/helpers/db.js`**

```js
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function start() {
  mongod = await MongoMemoryServer.create();
  process.env.FLAME_MONGO_URI = mongod.getUri();
  return process.env.FLAME_MONGO_URI;
}

async function stop() {
  if (mongod) await mongod.stop();
}

module.exports = { start, stop };
```

- [ ] **Step 2: Write failing test `flame/__tests__/db.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('connects to Flame DB and reports readyState=1', async (t) => {
  await dbHelper.start();
  // Set the rest of the required env so config/env loads cleanly
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 'test';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  const { connect, getConn } = require('../db');

  const conn = await connect();
  assert.equal(conn.readyState, 1);
  assert.equal(getConn(), conn);

  t.after(async () => {
    await conn.close();
    await dbHelper.stop();
  });
});
```

- [ ] **Step 3: Run test (expect FAIL)**

```bash
node --test flame/__tests__/db.test.js
```

- [ ] **Step 4: Create `flame/db.js`**

```js
const mongoose = require('mongoose');
const logger = require('./utils/logger');

let flameConn = null;

async function connect() {
  if (flameConn && flameConn.readyState === 1) return flameConn;

  const uri = process.env.FLAME_MONGO_URI;
  if (!uri) throw new Error('FLAME_MONGO_URI not set');

  flameConn = mongoose.createConnection(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  flameConn.on('connected',    () => logger.info('MongoDB connected'));
  flameConn.on('error',        (err) => logger.error(`Mongo error: ${err.message}`));
  flameConn.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await flameConn.asPromise();
  return flameConn;
}

function getConn() {
  if (!flameConn) throw new Error('Flame DB not initialized — call connect() first');
  return flameConn;
}

async function close() {
  if (flameConn) {
    await flameConn.close();
    flameConn = null;
  }
}

module.exports = { connect, getConn, close };
```

- [ ] **Step 5: Run test (expect PASS)**

```bash
node --test flame/__tests__/db.test.js
```

- [ ] **Step 6: Commit**

```bash
git add flame/db.js flame/__tests__/db.test.js flame/__tests__/helpers/db.js
git commit -m "feat(flame): add isolated Mongoose connection via createConnection"
```

---

### Task 6: CORS middleware (scoped to /flamebackend/v1)

**Files:**
- Create: `flame/middleware/cors.js`

- [ ] **Step 1: Create `flame/middleware/cors.js`**

```js
const cors = require('cors');

const allowed = (process.env.FLAME_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

module.exports = cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, native apps)
    if (!origin) return cb(null, true);
    if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed for Flame`));
  },
  credentials: true,
});
```

- [ ] **Step 2: Commit**

```bash
git add flame/middleware/cors.js
git commit -m "feat(flame): add scoped CORS middleware"
```

---

### Task 7: Validate middleware (zod)

**Files:**
- Create: `flame/middleware/validate.js`
- Test: `flame/__tests__/validate.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/validate.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { ValidationError } = require('../utils/errors');

test('validate.body passes valid input and assigns parsed value', () => {
  const mw = validate.body(z.object({ name: z.string() }));
  const req = { body: { name: 'Ada', extra: 'ignored' } };
  let nextCalled = false;
  mw(req, {}, (err) => { if (err) throw err; nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, { name: 'Ada' });  // zod strips extras
});

test('validate.body throws ValidationError on invalid input', () => {
  const mw = validate.body(z.object({ name: z.string() }));
  const req = { body: { name: 123 } };
  assert.throws(() => mw(req, {}, () => {}), (err) => err instanceof ValidationError);
});

test('validate.query parses query params', () => {
  const mw = validate.query(z.object({ page: z.coerce.number().int().positive() }));
  const req = { query: { page: '3' } };
  mw(req, {}, () => {});
  assert.equal(req.query.page, 3);
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/validate.test.js
```

- [ ] **Step 3: Create `flame/middleware/validate.js`**

```js
const { ValidationError } = require('../utils/errors');

function check(source, schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first.path.join('.');
      return next(new ValidationError(path ? `${path}: ${first.message}` : first.message));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = {
  body:   (schema) => check('body', schema),
  query:  (schema) => check('query', schema),
  params: (schema) => check('params', schema),
};
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/validate.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/middleware/validate.js flame/__tests__/validate.test.js
git commit -m "feat(flame): add zod-based request validation middleware"
```

---

### Task 8: Flame router skeleton + health endpoint

**Files:**
- Create: `flame/index.js`

- [ ] **Step 1: Create `flame/index.js`**

```js
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const errorMiddleware = require('./middleware/error');
const asyncHandler = require('./middleware/asyncHandler');
const { getConn } = require('./db');

const router = express.Router();

router.use(corsMiddleware);
router.use(express.json({ limit: '5mb' }));

// Flame health check (different from BananaTalk's /health)
router.get('/health', asyncHandler(async (_req, res) => {
  let dbStatus = 'unknown';
  try {
    const conn = getConn();
    dbStatus = conn.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'uninitialized';
  }
  res.json({ success: true, data: { service: 'flame', dbStatus, ts: new Date().toISOString() } });
}));

// Routes mounted in later tasks:
//   router.use('/auth',  require('./routes/auth'));
//   router.use('/users', require('./routes/users'));

// Error middleware MUST be last so it catches everything in this sub-app
router.use(errorMiddleware);

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add flame/index.js
git commit -m "feat(flame): add router skeleton with cors, json, health, error mw"
```

---

### Task 9: Patch `server.js` to mount Flame (the only BananaTalk file touched)

**Files:**
- Modify: `server.js` (additive only — no edits to existing code paths)

- [ ] **Step 1: Read current `server.js` around the imports and `connectDb()` call**

```bash
sed -n '1,30p' server.js
```
Note where `connectDb()` is called (around line 26) and where routes are mounted.

- [ ] **Step 2: Add Flame imports near the top of `server.js`**

Find the line `const connectDb = require('./config/db');` and add immediately after it:
```js
const flameRouter = require('./flame');
const flameDb = require('./flame/db');
```

- [ ] **Step 3: Add Flame DB init after the existing `connectDb()` call**

Find `connectDb();` (around line 26) and add immediately after it (wrapped in try/catch so Flame failures don't take down BananaTalk):
```js
flameDb.connect().catch((err) => {
  console.error('🔥 Flame disabled:', err.message);
});
```

- [ ] **Step 4: Mount the Flame router**

Find the LAST `app.use('/api/...', ...)` line in `server.js`, and add this line directly after it:
```js
app.use('/flamebackend/v1', flameRouter);
```

- [ ] **Step 5: Patch graceful shutdown to close Flame's connection**

Find the SIGTERM/shutdown handler that calls `await mongoose.connection.close();` (around line 390). Add immediately after it:
```js
try { await flameDb.close(); } catch (e) { console.error('Flame close error:', e.message); }
```

- [ ] **Step 6: Smoke test — start the server and curl the Flame health endpoint**

Set required Flame env in your local `.env` first (use throwaway values for FLAME_JWT_SECRET / FLAME_JWT_REFRESH_SECRET — both must be ≥32 chars), then:
```bash
npm run dev
# In another terminal:
curl -s http://localhost:5000/flamebackend/v1/health | jq .
```
Expected output:
```json
{
  "success": true,
  "data": { "service": "flame", "dbStatus": "connected", "ts": "..." }
}
```

- [ ] **Step 7: Verify BananaTalk routes still respond**

```bash
curl -s http://localhost:5000/health | jq .
```
Expected: BananaTalk's existing `/health` returns its normal payload, unchanged.

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "feat(flame): wire flame sub-app into server.js (additive patch)"
```

---

## Phase 2 — Models (Day 2)

### Task 10: User model

**Files:**
- Create: `flame/models/User.js`
- Test: `flame/__tests__/userModel.test.js`

The Python source `app/models/user.py` defines the canonical schema. Mongoose port mirrors it field-for-field, with explicit indexes and `getConn().model(...)` so it binds to Flame's DB.

- [ ] **Step 1: Write failing test `flame/__tests__/userModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('User model: create + unique email + geosphere index present', async (t) => {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  delete require.cache[require.resolve('../models/User')];
  const { connect, close } = require('../db');
  await connect();
  const User = require('../models/User');

  const u = await User.create({
    email: 'a@b.com', passwordHash: 'x',
    name: 'Ada', age: 30, gender: 'female', lookingFor: 'male',
    interests: ['hiking'],
  });
  assert.ok(u._id);
  assert.equal(u.email, 'a@b.com');

  // unique email
  await assert.rejects(
    User.create({ email: 'a@b.com', passwordHash: 'y', name: 'X', age: 22, gender: 'male', lookingFor: 'female', interests: ['x'] }),
    /duplicate/i
  );

  // geosphere index
  const indexes = await User.collection.indexes();
  const hasGeo = indexes.some(i => i.key && i.key.locationGeo === '2dsphere');
  assert.ok(hasGeo, 'expected 2dsphere index on locationGeo');

  t.after(async () => { await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run test (expect FAIL — module missing)**

```bash
node --test flame/__tests__/userModel.test.js
```

- [ ] **Step 3: Create `flame/models/User.js`**

```js
const mongoose = require('mongoose');
const { getConn } = require('../db');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const photoSchema = new mongoose.Schema({
  id:        { type: String, required: true },
  url:       { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
  order:     { type: Number, default: 0 },
}, { _id: false });

const coordSchema = new mongoose.Schema({
  latitude:  { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  city:        { type: String, default: null },
  state:       { type: String, default: null },
  country:     { type: String, default: null },
  coordinates: { type: coordSchema, default: null },
}, { _id: false });

const geoPointSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  minAge:           { type: Number, default: 18 },
  maxAge:           { type: Number, default: 50 },
  maxDistance:      { type: Number, default: 50 },
  showDistance:     { type: Boolean, default: true },
  showOnlineStatus: { type: Boolean, default: true },
}, { _id: false });

const notificationSettingsSchema = new mongoose.Schema({
  newMatches:  { type: Boolean, default: true },
  newMessages: { type: Boolean, default: true },
  superLikes:  { type: Boolean, default: true },
  promotions:  { type: Boolean, default: false },
}, { _id: false });

const userSettingsSchema = new mongoose.Schema({
  notificationsEnabled: { type: Boolean, default: true },
  discoveryEnabled:     { type: Boolean, default: true },
  darkMode:             { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true, minlength: 2, maxlength: 50 },
  age:          { type: Number, required: true, min: 18, max: 100 },
  gender:       { type: String, enum: GENDERS, required: true },
  lookingFor:   { type: String, enum: GENDERS, required: true },
  bio:          { type: String, maxlength: 500, default: null },
  interests:    { type: [String], default: [], validate: v => v.length <= 10 },
  photos:       { type: [photoSchema], default: [] },
  location:     { type: locationSchema, default: null },
  locationGeo:  { type: geoPointSchema, default: null },

  isOnline:    { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
  lastActive:  { type: Date, default: Date.now },

  preferences:          { type: preferencesSchema, default: () => ({}) },
  notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
  settings:             { type: userSettingsSchema, default: () => ({}) },

  // Auth-related
  verificationCode:         { type: String, default: null },
  verificationCodeExpires:  { type: Date, default: null },
  verificationAttempts:     { type: Number, default: 0 },
  passwordResetToken:       { type: String, default: null },
  passwordResetTokenExpires:{ type: Date, default: null },

  // Super like quota
  superLikesRemaining: { type: Number, default: 3 },
  superLikesDay:       { type: String, default: null }, // YYYY-MM-DD UTC

  // Premium
  isPremium:        { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },

  // Social auth
  googleId:   { type: String, default: null, sparse: true },
  appleId:    { type: String, default: null, sparse: true },
  facebookId: { type: String, default: null, sparse: true },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  collection: 'users',
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ appleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ isDeleted: 1 });
userSchema.index({ locationGeo: '2dsphere' });

module.exports = getConn().model('User', userSchema);
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/userModel.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/models/User.js flame/__tests__/userModel.test.js
git commit -m "feat(flame): add User model mirroring Python schema"
```

---

### Task 11: RefreshToken model (TTL-indexed)

**Files:**
- Create: `flame/models/RefreshToken.js`
- Test: `flame/__tests__/refreshTokenModel.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/refreshTokenModel.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

test('RefreshToken: unique jti + TTL index on expiresAt', async (t) => {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';

  delete require.cache[require.resolve('../db')];
  delete require.cache[require.resolve('../models/RefreshToken')];
  const { connect, close } = require('../db');
  await connect();
  const RefreshToken = require('../models/RefreshToken');

  await RefreshToken.create({
    userId: 'u1', tokenJti: 'j1', expiresAt: new Date(Date.now() + 86400000),
  });
  await assert.rejects(
    RefreshToken.create({ userId: 'u2', tokenJti: 'j1', expiresAt: new Date(Date.now() + 1000) }),
    /duplicate/i
  );

  const idx = await RefreshToken.collection.indexes();
  const ttl = idx.find(i => i.key && i.key.expiresAt === 1);
  assert.ok(ttl, 'expected index on expiresAt');
  assert.equal(ttl.expireAfterSeconds, 0, 'expected TTL index expireAfterSeconds=0');

  t.after(async () => { await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/refreshTokenModel.test.js
```

- [ ] **Step 3: Create `flame/models/RefreshToken.js`**

```js
const mongoose = require('mongoose');
const { getConn } = require('../db');

const schema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  tokenJti:  { type: String, required: true, unique: true },
  isRevoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  collection: 'refresh_tokens',
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = getConn().model('RefreshToken', schema);
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/refreshTokenModel.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/models/RefreshToken.js flame/__tests__/refreshTokenModel.test.js
git commit -m "feat(flame): add RefreshToken model with TTL index"
```

---

## Phase 3 — Auth utilities (Day 2.5)

### Task 12: Password utility

**Files:**
- Create: `flame/utils/password.js`
- Test: `flame/__tests__/password.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/password.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, compare } = require('../utils/password');

test('hash + compare round-trip works', async () => {
  const h = await hash('s3cret!');
  assert.notEqual(h, 's3cret!');
  assert.ok(h.startsWith('$2'));
  assert.equal(await compare('s3cret!', h), true);
  assert.equal(await compare('wrong', h), false);
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/password.test.js
```

- [ ] **Step 3: Create `flame/utils/password.js`**

```js
const bcrypt = require('bcryptjs');

const ROUNDS = 12;

module.exports = {
  hash:    (plain)        => bcrypt.hash(plain, ROUNDS),
  compare: (plain, hashed) => bcrypt.compare(plain, hashed),
};
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/password.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/utils/password.js flame/__tests__/password.test.js
git commit -m "feat(flame): add bcrypt password hash/compare util"
```

---

### Task 13: JWT utility

**Files:**
- Create: `flame/utils/jwt.js`
- Test: `flame/__tests__/jwt.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/jwt.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.FLAME_JWT_ACCESS_TTL = '5m';
process.env.FLAME_JWT_REFRESH_TTL = '7d';

const { signAccess, signRefresh, verifyAccess, verifyRefresh } = require('../utils/jwt');
const { AuthError } = require('../utils/errors');

test('access token round-trip', () => {
  const { token } = signAccess({ userId: 'u1' });
  const payload = verifyAccess(token);
  assert.equal(payload.userId, 'u1');
  assert.equal(payload.type, 'access');
  assert.equal(payload.iss, 'flame');
});

test('refresh token includes jti', () => {
  const { token, jti } = signRefresh({ userId: 'u1' });
  assert.ok(jti);
  const payload = verifyRefresh(token);
  assert.equal(payload.jti, jti);
  assert.equal(payload.type, 'refresh');
});

test('verifyAccess rejects refresh token', () => {
  const { token } = signRefresh({ userId: 'u1' });
  assert.throws(() => verifyAccess(token), (e) => e instanceof AuthError);
});

test('verifyAccess rejects tampered token', () => {
  const { token } = signAccess({ userId: 'u1' });
  const tampered = token.slice(0, -2) + 'XX';
  assert.throws(() => verifyAccess(tampered), (e) => e instanceof AuthError);
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/jwt.test.js
```

- [ ] **Step 3: Create `flame/utils/jwt.js`**

```js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AuthError } = require('./errors');

const ACCESS_SECRET  = process.env.FLAME_JWT_SECRET;
const REFRESH_SECRET = process.env.FLAME_JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.FLAME_JWT_ACCESS_TTL  || '15m';
const REFRESH_TTL    = process.env.FLAME_JWT_REFRESH_TTL || '30d';
const ISS            = 'flame';

function signAccess(payload) {
  const token = jwt.sign(
    { ...payload, type: 'access' },
    ACCESS_SECRET,
    { issuer: ISS, expiresIn: ACCESS_TTL },
  );
  return { token, expiresIn: ACCESS_TTL };
}

function signRefresh(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { ...payload, type: 'refresh', jti },
    REFRESH_SECRET,
    { issuer: ISS, expiresIn: REFRESH_TTL },
  );
  return { token, jti, expiresIn: REFRESH_TTL };
}

function verifyAccess(token) {
  try {
    const p = jwt.verify(token, ACCESS_SECRET, { issuer: ISS });
    if (p.type !== 'access') throw new AuthError('INVALID_TOKEN', 'Wrong token type');
    return p;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === 'TokenExpiredError') throw new AuthError('TOKEN_EXPIRED', 'Access token expired');
    throw new AuthError('INVALID_TOKEN', 'Invalid access token');
  }
}

function verifyRefresh(token) {
  try {
    const p = jwt.verify(token, REFRESH_SECRET, { issuer: ISS });
    if (p.type !== 'refresh') throw new AuthError('INVALID_TOKEN', 'Wrong token type');
    return p;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === 'TokenExpiredError') throw new AuthError('TOKEN_EXPIRED', 'Refresh token expired');
    throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
  }
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/jwt.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/utils/jwt.js flame/__tests__/jwt.test.js
git commit -m "feat(flame): add JWT access/refresh sign+verify util"
```

---

### Task 14: Auth middleware (bearer token verification)

**Files:**
- Create: `flame/middleware/auth.js`
- Test covered in integration tests later (Task 18+).

- [ ] **Step 1: Create `flame/middleware/auth.js`**

```js
const { verifyAccess } = require('../utils/jwt');
const { AuthError } = require('../utils/errors');
const User = require('../models/User');

// Lightweight middleware: verifies the access token, attaches { id } to req.user.
// Controllers fetch the full User only when they need the document (lazy load).
module.exports = async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new AuthError('MISSING_TOKEN', 'Bearer token required');
    }
    const token = header.slice(7);
    const payload = verifyAccess(token);
    req.user = { id: payload.userId };
    next();
  } catch (err) {
    next(err);
  }
};

// Variant that also loads the User document — for routes that need it on every call.
module.exports.withUser = async function authWithUser(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new AuthError('MISSING_TOKEN', 'Bearer token required');
    }
    const token = header.slice(7);
    const payload = verifyAccess(token);
    const user = await User.findById(payload.userId);
    if (!user || user.isDeleted) {
      throw new AuthError('USER_NOT_FOUND', 'User no longer exists');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add flame/middleware/auth.js
git commit -m "feat(flame): add JWT bearer auth middleware (lazy + withUser variants)"
```

---

### Task 15: S3 (DigitalOcean Spaces) upload utility

**Files:**
- Create: `flame/utils/s3.js`

The Flame S3 client uses BananaTalk's existing `SPACES_ENDPOINT/DO_SPACES_KEY/DO_SPACES_SECRET` but writes to `FLAME_SPACES_BUCKET`. **No `require` of `config/spaces.js`** — Flame builds its own client to preserve the isolation rule.

- [ ] **Step 1: Create `flame/utils/s3.js`**

```js
const AWS = require('aws-sdk');

const endpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);

const s3 = new AWS.S3({
  endpoint,
  accessKeyId:     process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
});

const BUCKET = process.env.FLAME_SPACES_BUCKET;

/**
 * Upload a buffer to Flame's Spaces bucket.
 * @param {Buffer} buffer
 * @param {string} key — object key (path inside the bucket)
 * @param {string} contentType
 * @returns {Promise<string>} public URL
 */
async function uploadBuffer(buffer, key, contentType) {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  };
  const result = await s3.upload(params).promise();
  return result.Location;
}

async function deleteObject(key) {
  await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
}

module.exports = { uploadBuffer, deleteObject, bucket: BUCKET };
```

- [ ] **Step 2: Commit**

```bash
git add flame/utils/s3.js
git commit -m "feat(flame): add Spaces upload util (shared creds, isolated bucket)"
```

---

## Phase 4 — Auth service & endpoints (Days 3–4)

### Task 16: Auth service — register

**Files:**
- Create: `flame/services/authService.js` (register only in this task)
- Test: `flame/__tests__/authService.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/authService.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setupEnv() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken', '../services/authService', '../utils/jwt']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
}

test('authService.register creates user + tokens + persists refresh jti', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { user, tokens } = await authService.register({
    email: 'Ada@Example.com', password: 'Hunter2!!', name: 'Ada',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
  });

  assert.equal(user.email, 'ada@example.com'); // lowercased
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);

  const stored = await RefreshToken.find({ userId: user.id });
  assert.equal(stored.length, 1);

  t.after(async () => {
    const { close } = require('../db'); await close(); await dbHelper.stop();
  });
});

test('authService.register rejects duplicate email with ConflictError', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const { ConflictError } = require('../utils/errors');

  const args = { email: 'dup@x.com', password: 'Hunter2!!', name: 'A', age: 22, gender: 'male', lookingFor: 'female', interests: ['x'] };
  await authService.register(args);
  await assert.rejects(authService.register(args), (e) => e instanceof ConflictError);

  t.after(async () => {
    const { close } = require('../db'); await close(); await dbHelper.stop();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
node --test flame/__tests__/authService.test.js
```

- [ ] **Step 3: Create `flame/services/authService.js` (register only — other methods added in later tasks)**

```js
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const password = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const { ConflictError, AuthError, NotFoundError } = require('../utils/errors');

function toPublic(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    age: user.age,
    gender: user.gender,
    lookingFor: user.lookingFor,
    bio: user.bio,
    interests: user.interests,
    photos: user.photos,
    location: user.location,
    isOnline: user.isOnline,
    isVerified: user.isVerified,
    lastActive: user.lastActive,
    createdAt: user.createdAt,
    preferences: user.preferences,
  };
}

function refreshTtlMs() {
  const ttl = process.env.FLAME_JWT_REFRESH_TTL || '30d';
  // crude parser: supports "Nm", "Nh", "Nd"
  const m = /^(\d+)([mhd])$/.exec(ttl);
  if (!m) return 30 * 86400 * 1000;
  const n = parseInt(m[1], 10);
  return { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] * n;
}

async function mintTokenPair(user) {
  const access  = jwtUtil.signAccess({ userId: user._id.toString() });
  const refresh = jwtUtil.signRefresh({ userId: user._id.toString() });
  await RefreshToken.create({
    userId:    user._id.toString(),
    tokenJti:  refresh.jti,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  return {
    accessToken:  access.token,
    refreshToken: refresh.token,
    expiresIn:    access.expiresIn,
  };
}

async function register(input) {
  const passwordHash = await password.hash(input.password);
  let user;
  try {
    user = await User.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name,
      age: input.age,
      gender: input.gender,
      lookingFor: input.lookingFor,
      interests: input.interests,
      bio: input.bio,
    });
  } catch (e) {
    if (e.code === 11000) throw new ConflictError('EMAIL_TAKEN', 'Email is already registered');
    throw e;
  }
  const tokens = await mintTokenPair(user);
  return { user: toPublic(user), tokens };
}

module.exports = { register, toPublic, mintTokenPair };
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
node --test flame/__tests__/authService.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/services/authService.js flame/__tests__/authService.test.js
git commit -m "feat(flame): authService.register + token-pair minting"
```

---

### Task 17: Auth service — login, refresh, logout

**Files:**
- Modify: `flame/services/authService.js` (add `login`, `refreshTokens`, `logout`)
- Modify: `flame/__tests__/authService.test.js` (add tests)

- [ ] **Step 1: Append failing tests to `flame/__tests__/authService.test.js`**

Add these tests at the end of the file:
```js
test('login: returns tokens for correct password', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');

  await authService.register({
    email: 'login@x.com', password: 'Hunter2!!', name: 'L',
    age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
  });
  const { user, tokens } = await authService.login({ email: 'login@x.com', password: 'Hunter2!!' });
  assert.equal(user.email, 'login@x.com');
  assert.ok(tokens.accessToken);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('login: throws AuthError on wrong password', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const { AuthError } = require('../utils/errors');

  await authService.register({
    email: 'bad@x.com', password: 'right1!!', name: 'X',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });
  await assert.rejects(
    authService.login({ email: 'bad@x.com', password: 'wrong!!' }),
    (e) => e instanceof AuthError && e.code === 'INVALID_CREDENTIALS',
  );

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('refresh: rotates refresh token (old jti revoked)', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { tokens } = await authService.register({
    email: 'r@x.com', password: 'Hunter2!!', name: 'R',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });

  const before = await RefreshToken.findOne({ isRevoked: false });
  const newTokens = await authService.refreshTokens(tokens.refreshToken);
  assert.notEqual(newTokens.refreshToken, tokens.refreshToken);

  const oldAfter = await RefreshToken.findById(before._id);
  assert.equal(oldAfter.isRevoked, true);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('logout: revokes all of a user\'s refresh tokens', async (t) => {
  await setupEnv();
  const authService = require('../services/authService');
  const RefreshToken = require('../models/RefreshToken');

  const { user } = await authService.register({
    email: 'lo@x.com', password: 'Hunter2!!', name: 'L',
    age: 22, gender: 'male', lookingFor: 'female', interests: ['x'],
  });
  await authService.logout(user.id);
  const active = await RefreshToken.find({ userId: user.id, isRevoked: false });
  assert.equal(active.length, 0);

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run tests (expect FAIL — methods missing)**

```bash
node --test flame/__tests__/authService.test.js
```

- [ ] **Step 3: Extend `flame/services/authService.js`**

Add these functions and update the export at the bottom of the file:

```js
async function login({ email, password: plain }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.isDeleted) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const ok = await password.compare(plain, user.passwordHash);
  if (!ok) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  user.lastActive = new Date();
  user.isOnline = true;
  await user.save();
  const tokens = await mintTokenPair(user);
  return { user: toPublic(user), tokens };
}

async function refreshTokens(refreshToken) {
  const payload = jwtUtil.verifyRefresh(refreshToken);
  const stored = await RefreshToken.findOne({ tokenJti: payload.jti });
  if (!stored || stored.isRevoked) {
    throw new AuthError('REFRESH_REVOKED', 'Refresh token revoked');
  }
  const user = await User.findById(payload.userId);
  if (!user || user.isDeleted) {
    throw new NotFoundError('User no longer exists');
  }
  // Rotate: revoke the old jti, mint a fresh pair
  stored.isRevoked = true;
  await stored.save();
  const tokens = await mintTokenPair(user);
  return tokens;
}

async function logout(userId) {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } },
  );
  await User.updateOne({ _id: userId }, { $set: { isOnline: false } });
}

module.exports = { register, login, refreshTokens, logout, toPublic, mintTokenPair };
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
node --test flame/__tests__/authService.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/services/authService.js flame/__tests__/authService.test.js
git commit -m "feat(flame): authService.login + refresh rotation + logout"
```

---

### Task 18: Auth controller + routes (register, login, refresh, logout)

**Files:**
- Create: `flame/controllers/authController.js`
- Create: `flame/routes/auth.js`
- Modify: `flame/index.js` (mount `/auth`)
- Test: `flame/__tests__/auth.test.js` (integration via supertest)
- Helper: `flame/__tests__/helpers/app.js`

- [ ] **Step 1: Create `flame/__tests__/helpers/app.js`**

```js
const express = require('express');

// Builds a minimal Express app that mounts the Flame router. Used by
// integration tests so we don't depend on server.js or BananaTalk routes.
function buildApp() {
  // require AFTER env + DB are set up by the test
  delete require.cache[require.resolve('../../index')];
  const flameRouter = require('../../index');
  const app = express();
  app.use('/flamebackend/v1', flameRouter);
  return app;
}

module.exports = { buildApp };
```

- [ ] **Step 2: Write failing integration test `flame/__tests__/auth.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'sfo3.digitaloceanspaces.com';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken', '../services/authService',
   '../controllers/authController', '../routes/auth', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

const VALID_REG = {
  email: 'ada@x.com', password: 'Hunter2!!', name: 'Ada',
  age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
};

test('POST /auth/register → 201 + tokens', async (t) => {
  const app = await setup();
  const res = await request(app)
    .post('/flamebackend/v1/auth/register')
    .send(VALID_REG)
    .expect(201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'ada@x.com');
  assert.ok(res.body.data.tokens.accessToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/register → 422 on bad input (age < 18)', async (t) => {
  const app = await setup();
  const res = await request(app)
    .post('/flamebackend/v1/auth/register')
    .send({ ...VALID_REG, age: 15 })
    .expect(422);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/login → 200 with correct credentials', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);

  const res = await request(app)
    .post('/flamebackend/v1/auth/login')
    .send({ email: 'ada@x.com', password: 'Hunter2!!' })
    .expect(200);
  assert.ok(res.body.data.tokens.accessToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/login → 401 wrong password', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const res = await request(app)
    .post('/flamebackend/v1/auth/login')
    .send({ email: 'ada@x.com', password: 'wrong!!' })
    .expect(401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/refresh → 200 rotates token', async (t) => {
  const app = await setup();
  const reg = await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const refreshToken = reg.body.data.tokens.refreshToken;

  const res = await request(app)
    .post('/flamebackend/v1/auth/refresh')
    .send({ refreshToken })
    .expect(200);
  assert.ok(res.body.data.accessToken);
  assert.notEqual(res.body.data.refreshToken, refreshToken);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/logout → 200 (requires bearer token)', async (t) => {
  const app = await setup();
  const reg = await request(app).post('/flamebackend/v1/auth/register').send(VALID_REG).expect(201);
  const access = reg.body.data.tokens.accessToken;

  await request(app)
    .post('/flamebackend/v1/auth/logout')
    .set('Authorization', `Bearer ${access}`)
    .expect(200);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /auth/logout → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app).post('/flamebackend/v1/auth/logout').expect(401);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 3: Run tests (expect FAIL — controller + route missing)**

```bash
node --test flame/__tests__/auth.test.js
```

- [ ] **Step 4: Create `flame/controllers/authController.js`**

```js
const authService = require('../services/authService');

async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

async function refresh(req, res) {
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  res.json({ success: true, data: tokens });
}

async function logout(req, res) {
  await authService.logout(req.user.id);
  res.json({ success: true, message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };
```

- [ ] **Step 5: Create `flame/routes/auth.js`**

```js
const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const registerSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(8).max(128),
  name:       z.string().min(2).max(50),
  age:        z.number().int().min(18).max(100),
  gender:     z.enum(GENDERS),
  lookingFor: z.enum(GENDERS),
  bio:        z.string().max(500).optional(),
  interests:  z.array(z.string().min(1)).min(1).max(10),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const router = express.Router();

router.post('/register', validate.body(registerSchema), asyncHandler(ctrl.register));
router.post('/login',    validate.body(loginSchema),    asyncHandler(ctrl.login));
router.post('/refresh',  validate.body(refreshSchema),  asyncHandler(ctrl.refresh));
router.post('/logout',   auth,                          asyncHandler(ctrl.logout));

module.exports = router;
```

- [ ] **Step 6: Mount auth routes in `flame/index.js`**

In `flame/index.js`, replace the commented-out line `//   router.use('/auth',  require('./routes/auth'));` with:
```js
router.use('/auth', require('./routes/auth'));
```

- [ ] **Step 7: Run tests (expect PASS)**

```bash
node --test flame/__tests__/auth.test.js
```

- [ ] **Step 8: Manual smoke test against running server**

In one terminal: `npm run dev`

In another:
```bash
curl -s -X POST http://localhost:5000/flamebackend/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@x.com","password":"Hunter2!!","name":"Smoke","age":30,"gender":"male","lookingFor":"female","interests":["test"]}' | jq .
```
Expected: `success: true`, user + tokens returned. Re-running returns 409 conflict.

- [ ] **Step 9: Commit**

```bash
git add flame/controllers/authController.js flame/routes/auth.js flame/index.js flame/__tests__/auth.test.js flame/__tests__/helpers/app.js
git commit -m "feat(flame): auth endpoints (register, login, refresh, logout)"
```

---

## Phase 5 — User service & endpoints (Days 4–5)

### Task 19: User service — getMe, getById, updateMe

**Files:**
- Create: `flame/services/userService.js`
- Test: `flame/__tests__/userService.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/userService.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const dbHelper = require('./helpers/db');

async function setupAndRegister() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken',
   '../services/authService', '../services/userService']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const authService = require('../services/authService');
  const { user } = await authService.register({
    email: 'ada@x.com', password: 'Hunter2!!', name: 'Ada',
    age: 30, gender: 'female', lookingFor: 'male', interests: ['hiking'],
  });
  return user.id;
}

test('getMe returns the full profile', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const me = await userService.getMe(id);
  assert.equal(me.email, 'ada@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('getById returns public profile (no email, no passwordHash)', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const other = await userService.getById(id);
  assert.equal(other.name, 'Ada');
  assert.equal(other.email, undefined);
  assert.equal(other.passwordHash, undefined);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('updateMe patches mutable fields, ignores immutable', async (t) => {
  const id = await setupAndRegister();
  const userService = require('../services/userService');
  const updated = await userService.updateMe(id, { name: 'Ada L.', bio: 'hi', email: 'nope@x.com', passwordHash: 'pwn' });
  assert.equal(updated.name, 'Ada L.');
  assert.equal(updated.bio, 'hi');
  assert.equal(updated.email, 'ada@x.com'); // unchanged
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('getMe → NotFoundError for unknown id', async (t) => {
  await setupAndRegister();
  const userService = require('../services/userService');
  const { NotFoundError } = require('../utils/errors');
  await assert.rejects(userService.getMe('507f1f77bcf86cd799439011'), (e) => e instanceof NotFoundError);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

```bash
node --test flame/__tests__/userService.test.js
```

- [ ] **Step 3: Create `flame/services/userService.js`**

```js
const User = require('../models/User');
const { NotFoundError } = require('../utils/errors');
const { toPublic } = require('./authService');

// Fields the owner is allowed to update via PATCH /users/me
const MUTABLE_FIELDS = new Set([
  'name', 'age', 'bio', 'interests', 'gender', 'lookingFor',
  'preferences', 'notificationSettings', 'settings', 'location', 'locationGeo',
]);

// Public view (other users see this — no email, no auth fields)
function toPublicMinimal(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    age: user.age,
    gender: user.gender,
    lookingFor: user.lookingFor,
    bio: user.bio,
    interests: user.interests,
    photos: user.photos,
    isOnline: user.isOnline,
    lastActive: user.lastActive,
  };
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublic(user);
}

async function getById(userId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublicMinimal(user);
}

async function updateMe(userId, patch) {
  const update = {};
  for (const [k, v] of Object.entries(patch)) {
    if (MUTABLE_FIELDS.has(k)) update[k] = v;
  }
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublic(user);
}

module.exports = { getMe, getById, updateMe };
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
node --test flame/__tests__/userService.test.js
```

- [ ] **Step 5: Commit**

```bash
git add flame/services/userService.js flame/__tests__/userService.test.js
git commit -m "feat(flame): userService getMe/getById/updateMe"
```

---

### Task 20: User controller + routes (GET /me, GET /:id, PATCH /me)

**Files:**
- Create: `flame/controllers/userController.js`
- Create: `flame/routes/users.js`
- Modify: `flame/index.js` (mount `/users`)
- Test: `flame/__tests__/users.test.js`

- [ ] **Step 1: Write failing test `flame/__tests__/users.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const dbHelper = require('./helpers/db');

async function setup() {
  await dbHelper.start();
  process.env.FLAME_JWT_SECRET = 'a'.repeat(32);
  process.env.FLAME_JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.FLAME_JWT_ACCESS_TTL = '5m';
  process.env.FLAME_JWT_REFRESH_TTL = '7d';
  process.env.FLAME_SPACES_BUCKET = 't';
  process.env.SPACES_ENDPOINT = 'e';
  process.env.DO_SPACES_KEY = 'k';
  process.env.DO_SPACES_SECRET = 's';
  ['../db', '../models/User', '../models/RefreshToken',
   '../services/authService', '../services/userService',
   '../controllers/authController', '../controllers/userController',
   '../routes/auth', '../routes/users', '../index']
    .forEach(p => { try { delete require.cache[require.resolve(p)]; } catch {} });
  const { connect } = require('../db');
  await connect();
  const { buildApp } = require('./helpers/app');
  return buildApp();
}

const REG = {
  email: 'me@x.com', password: 'Hunter2!!', name: 'Me',
  age: 25, gender: 'female', lookingFor: 'male', interests: ['x'],
};

async function registerAndGetToken(app) {
  const r = await request(app).post('/flamebackend/v1/auth/register').send(REG).expect(201);
  return { token: r.body.data.tokens.accessToken, id: r.body.data.user.id };
}

test('GET /users/me → 200 returns full profile', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  const res = await request(app)
    .get('/flamebackend/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(res.body.data.email, 'me@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/me → 401 without bearer', async (t) => {
  const app = await setup();
  await request(app).get('/flamebackend/v1/users/me').expect(401);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/:id → 200 returns public profile (no email)', async (t) => {
  const app = await setup();
  const { token, id } = await registerAndGetToken(app);
  const res = await request(app)
    .get(`/flamebackend/v1/users/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(res.body.data.name, 'Me');
  assert.equal(res.body.data.email, undefined);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('PATCH /users/me → 200 updates allowed fields, ignores rest', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  const res = await request(app)
    .patch('/flamebackend/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ bio: 'updated', email: 'try-to-change@x.com' })
    .expect(200);
  assert.equal(res.body.data.bio, 'updated');
  assert.equal(res.body.data.email, 'me@x.com');
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('GET /users/:id → 422 for malformed ObjectId', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  await request(app)
    .get('/flamebackend/v1/users/not-an-id')
    .set('Authorization', `Bearer ${token}`)
    .expect(422);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

```bash
node --test flame/__tests__/users.test.js
```

- [ ] **Step 3: Create `flame/controllers/userController.js`**

```js
const userService = require('../services/userService');

async function getMe(req, res) {
  const me = await userService.getMe(req.user.id);
  res.json({ success: true, data: me });
}

async function getById(req, res) {
  const u = await userService.getById(req.params.id);
  res.json({ success: true, data: u });
}

async function updateMe(req, res) {
  const me = await userService.updateMe(req.user.id, req.body);
  res.json({ success: true, data: me });
}

module.exports = { getMe, getById, updateMe };
```

- [ ] **Step 4: Create `flame/routes/users.js`**

```js
const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId'),
});

const updateSchema = z.object({
  name:       z.string().min(2).max(50).optional(),
  age:        z.number().int().min(18).max(100).optional(),
  bio:        z.string().max(500).optional(),
  interests:  z.array(z.string().min(1)).min(1).max(10).optional(),
  gender:     z.enum(GENDERS).optional(),
  lookingFor: z.enum(GENDERS).optional(),
  // Other fields (preferences/settings/location) intentionally not exposed
  // in PATCH /users/me yet — they get dedicated routes in Plan 2.
}).strict();

const router = express.Router();

router.get('/me',   auth, asyncHandler(ctrl.getMe));
router.patch('/me', auth, validate.body(updateSchema), asyncHandler(ctrl.updateMe));
router.get('/:id',  auth, validate.params(objectIdSchema), asyncHandler(ctrl.getById));

module.exports = router;
```

- [ ] **Step 5: Mount user routes in `flame/index.js`**

In `flame/index.js`, replace the commented-out line `//   router.use('/users', require('./routes/users'));` with:
```js
router.use('/users', require('./routes/users'));
```

- [ ] **Step 6: Run tests (expect PASS)**

```bash
node --test flame/__tests__/users.test.js
```

- [ ] **Step 7: Commit**

```bash
git add flame/controllers/userController.js flame/routes/users.js flame/index.js flame/__tests__/users.test.js
git commit -m "feat(flame): user endpoints (GET /me, GET /:id, PATCH /me)"
```

---

### Task 21: Photo upload endpoint

**Files:**
- Modify: `flame/services/userService.js` (add `uploadPhoto`, `deletePhoto`)
- Modify: `flame/controllers/userController.js` (add `uploadPhoto`, `deletePhoto`)
- Modify: `flame/routes/users.js` (add POST /me/photos, DELETE /me/photos/:photoId)
- Test: extend `flame/__tests__/users.test.js`

- [ ] **Step 1: Append failing test to `flame/__tests__/users.test.js`**

Stub the S3 utility for tests (replace its uploadBuffer with a no-network fake). Add at the top of the test file (above the existing tests):
```js
// Stub Flame's S3 util so tests don't hit DigitalOcean.
const stubbedUrl = 'https://stub.example.com/photo-key.jpg';
require.cache[require.resolve('../utils/s3')] = {
  exports: {
    uploadBuffer: async (_buf, key) => `https://stub.example.com/${key}`,
    deleteObject: async () => {},
    bucket: 'stub-bucket',
  },
};
```

Then append at the end of the file:
```js
test('POST /users/me/photos → 201 adds photo to user', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);

  const res = await request(app)
    .post('/flamebackend/v1/users/me/photos')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', Buffer.from('fake-bytes'), { filename: 'p.jpg', contentType: 'image/jpeg' })
    .expect(201);
  assert.ok(res.body.data.id);
  assert.match(res.body.data.url, /^https:\/\/stub\.example\.com\//);
  assert.equal(res.body.data.isPrimary, true); // first photo is primary

  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});

test('POST /users/me/photos → 422 on bad content-type', async (t) => {
  const app = await setup();
  const { token } = await registerAndGetToken(app);
  await request(app)
    .post('/flamebackend/v1/users/me/photos')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', Buffer.from('fake'), { filename: 'p.gif', contentType: 'image/gif' })
    .expect(422);
  t.after(async () => { const { close } = require('../db'); await close(); await dbHelper.stop(); });
});
```

- [ ] **Step 2: Run tests (expect FAIL — endpoint missing)**

```bash
node --test flame/__tests__/users.test.js
```

- [ ] **Step 3: Extend `flame/services/userService.js`**

Add to the file:
```js
const crypto = require('crypto');
const s3 = require('../utils/s3');
const { ValidationError } = require('../utils/errors');

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PHOTOS_PER_USER = 9;

async function uploadPhoto(userId, file) {
  if (!file) throw new ValidationError('photo file is required');
  if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
    throw new ValidationError('Only JPEG, PNG, and WebP images are allowed');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ValidationError('Photo must be under 10MB');
  }
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  if (user.photos.length >= MAX_PHOTOS_PER_USER) {
    throw new ValidationError(`At most ${MAX_PHOTOS_PER_USER} photos allowed`);
  }
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
  const id = crypto.randomUUID();
  const key = `users/${userId}/photos/${id}.${ext}`;
  const url = await s3.uploadBuffer(file.buffer, key, file.mimetype);

  const photo = {
    id,
    url,
    isPrimary: user.photos.length === 0,  // first photo becomes primary
    order: user.photos.length,
  };
  user.photos.push(photo);
  await user.save();
  return photo;
}

async function deletePhoto(userId, photoId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  const photo = user.photos.find(p => p.id === photoId);
  if (!photo) throw new NotFoundError('Photo not found');
  // Best-effort delete from storage — don't block if it fails
  try {
    const key = photo.url.split('/').slice(3).join('/');  // crude: extract path from URL
    await s3.deleteObject(key);
  } catch (_) { /* ignore */ }
  user.photos = user.photos.filter(p => p.id !== photoId);
  if (photo.isPrimary && user.photos.length > 0) user.photos[0].isPrimary = true;
  await user.save();
}

// Update the exports block at the bottom:
module.exports = { getMe, getById, updateMe, uploadPhoto, deletePhoto };
```

(Remove the old `module.exports = { getMe, getById, updateMe };` line — the new export replaces it.)

- [ ] **Step 4: Extend `flame/controllers/userController.js`**

Add:
```js
async function uploadPhoto(req, res) {
  const photo = await userService.uploadPhoto(req.user.id, req.file);
  res.status(201).json({ success: true, data: photo });
}

async function deletePhoto(req, res) {
  await userService.deletePhoto(req.user.id, req.params.photoId);
  res.json({ success: true });
}

module.exports = { getMe, getById, updateMe, uploadPhoto, deletePhoto };
```

(Update the `module.exports` line.)

- [ ] **Step 5: Extend `flame/routes/users.js`**

At the top, add multer:
```js
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB hard cap at multer layer
});
```

Add these routes ABOVE `router.get('/:id', ...)` (so `/me/photos` is matched before `/:id`):
```js
router.post('/me/photos',
  auth,
  upload.single('photo'),
  asyncHandler(ctrl.uploadPhoto),
);

router.delete('/me/photos/:photoId',
  auth,
  asyncHandler(ctrl.deletePhoto),
);
```

- [ ] **Step 6: Run tests (expect PASS)**

```bash
node --test flame/__tests__/users.test.js
```

- [ ] **Step 7: Commit**

```bash
git add flame/services/userService.js flame/controllers/userController.js flame/routes/users.js flame/__tests__/users.test.js
git commit -m "feat(flame): photo upload + delete on /users/me"
```

---

## Phase 6 — End-to-end validation (Day 5–6)

### Task 22: Full happy-path smoke test against running server

**No code changes — manual verification that the foundation slice works against a real running server.**

- [ ] **Step 1: Make sure local `.env` has all FLAME_* vars set**

In `backend/.env`, set (use real DO Spaces creds if testing uploads, otherwise leave defaults — uploads will fail but other endpoints work):
```
FLAME_MONGO_URI=mongodb://localhost:27017/flame-dev
FLAME_JWT_SECRET=<32+ random chars>
FLAME_JWT_REFRESH_SECRET=<different 32+ random chars>
FLAME_SPACES_BUCKET=flame-uploads-dev
FLAME_ALLOWED_ORIGINS=http://localhost:3001
```

- [ ] **Step 2: Start the server**

```bash
npm run dev
```
Expected logs include:
- BananaTalk: `✅ MongoDB Connected:`
- Flame: `🔥 [flame] MongoDB connected`

- [ ] **Step 3: Health check**

```bash
curl -s http://localhost:5000/flamebackend/v1/health | jq .
```
Expected: `{ success: true, data: { service: 'flame', dbStatus: 'connected', ... } }`

- [ ] **Step 4: Register**

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/flamebackend/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e@flame.test","password":"Hunter2!!","name":"E2E","age":28,"gender":"female","lookingFor":"male","interests":["tdd"]}' \
  | jq -r '.data.tokens.accessToken')
echo "Token: ${TOKEN:0:30}..."
```

- [ ] **Step 5: GET /users/me with the token**

```bash
curl -s http://localhost:5000/flamebackend/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .data.email
```
Expected: `"e2e@flame.test"`

- [ ] **Step 6: PATCH /users/me**

```bash
curl -s -X PATCH http://localhost:5000/flamebackend/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bio":"hello from e2e"}' | jq .data.bio
```
Expected: `"hello from e2e"`

- [ ] **Step 7: Login with same credentials**

```bash
curl -s -X POST http://localhost:5000/flamebackend/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e@flame.test","password":"Hunter2!!"}' | jq .data.user.bio
```
Expected: `"hello from e2e"` (the patched value)

- [ ] **Step 8: Verify BananaTalk endpoints still work**

```bash
curl -s http://localhost:5000/health | jq .status
```
Expected: BananaTalk's existing health payload returns unchanged.

- [ ] **Step 9: Run the full Flame test suite one more time**

```bash
node --test flame/__tests__/*.test.js
```
Expected: all tests pass.

- [ ] **Step 10: Commit (if any docs/comments need updating from manual testing — otherwise skip)**

```bash
git status   # confirm clean tree
```

- [ ] **Step 11: Update CLAUDE.md / README if present**

If `backend/CLAUDE.md` exists, add one line under the project structure section:
```
- `flame/` — Flame backend sub-app, mounted at /flamebackend/v1/* (see docs/superpowers/specs/2026-06-07-flame-merge-design.md)
```

- [ ] **Step 12: Final commit if docs were updated**

```bash
git add CLAUDE.md   # only if changed
git commit -m "docs: note flame/ sub-app in project structure"
```

---

## Definition of done (Plan 1)

The foundation slice ships when ALL of the following are true:

- [ ] `node --test flame/__tests__/*.test.js` passes locally
- [ ] BananaTalk's existing `npm test` (if any) still passes — no regressions
- [ ] `GET /flamebackend/v1/health` returns `{ success: true, data: { service: 'flame', dbStatus: 'connected' }}` against a real running server
- [ ] Manual flow works end-to-end: register → login → refresh → GET /me → PATCH /me → logout
- [ ] BananaTalk's `/health` and at least one other BananaTalk endpoint return unchanged payloads (no regression from the `server.js` patch)
- [ ] All commits pushed; no work-in-progress on disk

---

## What's NOT in this plan (Plan 2)

Plan 2 will be written after Plan 1 ships and the foundation is validated in a real environment. Plan 2 will cover:

- **Auth extensions:** Google / Apple / Facebook social auth; email verification (with mail provider); forgot-password / reset-password flow; change-password endpoint.
- **Community module:** posts (CRUD + image attachments), comments, likes, feed pagination.
- **Chat module:** conversations, messages (HTTP), Socket.IO `/flame` namespace mirroring BananaTalk's hardened patterns (multi-device map, heartbeat, reconnect grace, token-bucket rate limiter, offline queue, typing timeouts, user cache, modular handler registration).
- **Models added during Plan 2:** Conversation, Message, Match, Swipe, Block, Report, Device, Sticker.
- **CORS/health/shutdown polish** if Plan 1 revealed any rough edges.

---

## Self-review (run before handing off)

**Spec coverage:**
- `core` (config, errors, middleware, asyncHandler) → Tasks 2, 3, 4, 6, 7
- Dual DB connection → Task 5
- `models` (User, RefreshToken) → Tasks 10, 11
- Auth utilities (password, JWT) → Tasks 12, 13
- Auth middleware → Task 14
- S3/Spaces shared creds + isolated bucket → Task 15
- Auth endpoints (register/login/refresh/logout) → Tasks 16, 17, 18
- User endpoints (getMe, getById, updateMe, photos) → Tasks 19, 20, 21
- `server.js` additive patch → Task 9
- End-to-end validation → Task 22

**Out of scope (Plan 2):** social auth, email verification, forgot-password, change-password, community, chat, billing, all non-User models. Each is explicitly listed in "What's NOT in this plan."

**Placeholder scan:** no TBD/TODO/"add appropriate" patterns.

**Type/name consistency:**
- `authService.toPublic(user)` defined in Task 16, reused in Task 19's `userService.js`. ✓
- `authService.mintTokenPair(user)` defined in Task 16, no later renames. ✓
- `flame/db.js` exports `{ connect, getConn, close }` — used consistently in Tasks 5, 9, and all test files. ✓
- `flame/utils/s3.js` exports `{ uploadBuffer, deleteObject, bucket }` — used in Task 21. ✓
- Mongoose field names use camelCase throughout (`passwordHash`, `lookingFor`, `locationGeo`, etc.) — translation from Python's snake_case is consistent in User model (Task 10), authService (Task 16), userService (Task 19), and tests.
