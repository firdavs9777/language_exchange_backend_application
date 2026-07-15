/**
 * normalizeLocale — map raw locale inputs to the 19 supported push/notification
 * template locales (the JSON files in notification_templates/).
 *
 * Accepts BOTH input families:
 *   1. Device locale tags sent by the app ("zh-Hans-CN", "ko_KR", "pt_BR",
 *      "en-US", "fil-PH", "zh_Hant_TW", …) — BCP-47-ish, '-' or '_' separated.
 *   2. native_language display names stored on existing User docs
 *      ("Chinese (Simplified)", "Arabic", "Portuguese (Brazil)", …) — used by
 *      migrations/backfillPreferredLocale.js.
 *
 * Unknown/unsupported input → null. The notification renderer treats null as
 * "fall back to en" (services/notificationTemplateService.js render()), so
 * null is safe everywhere and means "we don't know / not supported".
 *
 * NOT the same thing as lib/normalizeLanguage.js — that helper is scoped to
 * the 8 language-room hub languages and intentionally folds Traditional
 * Chinese into 'zh'. Template locales distinguish zh vs zh_TW, so the two
 * maps must stay separate.
 */

// Must match the filenames in notification_templates/*.json exactly.
// test/normalizeLocale.test.js asserts this list against the directory.
const SUPPORTED_LOCALES = [
  'ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko',
  'pt', 'ru', 'tg', 'th', 'tl', 'tr', 'vi', 'zh', 'zh_TW',
];

const SUPPORTED_SET = new Set(SUPPORTED_LOCALES);

// ISO 639 subtag aliases/legacy codes → supported base code.
const SUBTAG_ALIASES = {
  fil: 'tl', // Filipino — modern code for Tagalog
  in: 'id',  // legacy Java code for Indonesian (some Android stacks)
  yue: 'zh_TW', // Cantonese — written with Traditional characters
};

// Display names (and native-script names) seen in prod native_language,
// lowercased. Derived from the full distinct-values list measured 2026-07-14.
// Unsupported prod values (Uzbek, Burmese, Odia, Bengali, Urdu, Kurdish,
// Ukrainian, Kinyarwanda, Pashto…) are intentionally absent → null → en.
const DISPLAY_NAME_ALIASES = {
  'english': 'en', 'english (us)': 'en', 'english (uk)': 'en',
  'english (australia)': 'en', 'english (canada)': 'en',
  'korean': 'ko', '한국어': 'ko',
  'japanese': 'ja', '日本語': 'ja',
  'chinese': 'zh', 'chinese (simplified)': 'zh', '中文': 'zh', '简体中文': 'zh',
  'chinese (traditional)': 'zh_TW', '繁體中文': 'zh_TW',
  'cantonese': 'zh_TW', // written form is Traditional characters
  'arabic': 'ar', 'العربية': 'ar',
  // Arabic varieties — notification templates only have MSA 'ar'.
  'arabic (msa)': 'ar', 'arabic (egyptian)': 'ar', 'arabic (levantine)': 'ar',
  'arabic (gulf)': 'ar', 'arabic (moroccan darija)': 'ar',
  'russian': 'ru', 'русский': 'ru',
  'spanish': 'es', 'español': 'es', 'spanish (mexico)': 'es',
  'spanish (spain)': 'es', 'spanish (argentina)': 'es',
  'french': 'fr', 'français': 'fr',
  'german': 'de', 'deutsch': 'de',
  'portuguese': 'pt', 'portuguese (brazil)': 'pt', 'portuguese (portugal)': 'pt', 'português': 'pt',
  'turkish': 'tr', 'türkçe': 'tr',
  'vietnamese': 'vi', 'tiếng việt': 'vi',
  'thai': 'th', 'ไทย': 'th',
  'indonesian': 'id', 'bahasa indonesia': 'id',
  'hindi': 'hi', 'हिन्दी': 'hi',
  'italian': 'it', 'italiano': 'it',
  'tagalog': 'tl', 'filipino': 'tl',
  'tajik': 'tg',
};

/**
 * Normalize any locale-ish input to a supported template locale code.
 * @param {string} value  device locale tag or language display name
 * @returns {string|null} one of SUPPORTED_LOCALES, or null when unknown
 */
function normalizeLocale(value) {
  if (!value || typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;

  // 1. Display-name / native-script lookup (covers backfill inputs).
  if (DISPLAY_NAME_ALIASES[key]) return DISPLAY_NAME_ALIASES[key];

  // 2. Locale-tag parse: "zh-Hans-CN" / "ko_KR" / "pt_BR" / "en" …
  const subtags = key.replace(/_/g, '-').split('-').filter(Boolean);
  if (subtags.length === 0) return null;

  let base = subtags[0];
  if (SUBTAG_ALIASES[base]) base = SUBTAG_ALIASES[base];

  // Base subtags are 2-3 alpha chars; anything else isn't a locale tag.
  if (!/^[a-z]{2,3}(_tw)?$/i.test(base)) return null;

  // Chinese needs script/region disambiguation: Traditional-script locales
  // (script Hant, or region TW/HK/MO with no explicit script) → zh_TW.
  if (base === 'zh') {
    const rest = subtags.slice(1);
    if (rest.includes('hant')) return 'zh_TW';
    if (rest.includes('hans')) return 'zh';
    if (rest.some((s) => ['tw', 'hk', 'mo'].includes(s))) return 'zh_TW';
    return 'zh';
  }
  if (base === 'zh_TW') return 'zh_TW'; // via SUBTAG_ALIASES (yue)

  return SUPPORTED_SET.has(base) ? base : null;
}

module.exports = { normalizeLocale, SUPPORTED_LOCALES };
