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
