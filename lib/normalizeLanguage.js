// Canonical hub languages (must match Prompt.language ISO space + seedRooms).
const CANONICAL = ['en', 'ko', 'ja', 'zh', 'ar', 'es', 'de', 'fr'];

// Hardcoded alias map keyed to the ~8 seeded hub languages plus the top
// dirty prod variants (display names, ISO codes, and native scripts).
const ALIASES = {
  'english': 'en', 'english (us)': 'en', 'english (uk)': 'en', 'en': 'en',
  'korean': 'ko', 'ko': 'ko', '한국어': 'ko',
  'japanese': 'ja', 'ja': 'ja', '日本語': 'ja',
  'chinese': 'zh', 'chinese (simplified)': 'zh', 'chinese (traditional)': 'zh', 'zh': 'zh', '中文': 'zh',
  'arabic': 'ar', 'ar': 'ar',
  'spanish': 'es', 'es': 'es',
  'german': 'de', 'de': 'de',
  'french': 'fr', 'fr': 'fr',
};

function normalizeLanguage(value) {
  if (!value || typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return ALIASES[key] || null;
}

module.exports = { normalizeLanguage, CANONICAL, ALIASES };
