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
