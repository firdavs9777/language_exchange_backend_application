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
