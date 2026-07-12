// utils/languageCodes.js
//
// Name <-> ISO 639-1 code normalization for language values stored on User
// (native_language, language_to_learn) and Moment (language).
//
// Source of truth: FilterOptions.allLanguages in the Flutter app
// (lib/pages/moments/filter/moment_filter_model.dart), which enumerates the
// ~40 languages selectable in the app. Prod Mongo data holds a mix of full
// English names (e.g. 'Chinese (Simplified)', 'English', 'Arabic', 'Korean'),
// ISO codes (e.g. 'en'), and empty strings.

// Name -> ISO 639-1 code (lowercase keys; lookups are case-insensitive).
const NAME_TO_ISO = {
  // Popular languages first (mirrors Flutter list order)
  'english': 'en',
  'korean': 'ko',
  'japanese': 'ja',
  'chinese': 'zh',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'russian': 'ru',
  // Additional languages (alphabetically, per Flutter list)
  'arabic': 'ar',
  'bengali': 'bn',
  'czech': 'cs',
  'danish': 'da',
  'dutch': 'nl',
  'finnish': 'fi',
  'greek': 'el',
  'hebrew': 'he',
  'hindi': 'hi',
  'hungarian': 'hu',
  'indonesian': 'id',
  'malay': 'ms',
  'norwegian': 'no',
  'persian': 'fa',
  'polish': 'pl',
  'romanian': 'ro',
  'swedish': 'sv',
  'tajik': 'tg',
  'thai': 'th',
  'turkish': 'tr',
  'ukrainian': 'uk',
  'urdu': 'ur',
  'vietnamese': 'vi',
  // Prod-observed variants not in the Flutter list verbatim, but map onto
  // the same underlying ISO code.
  'chinese (simplified)': 'zh',
  'chinese (traditional)': 'zh',
  'english (us)': 'en',
  'filipino': 'tl',
};

// Valid ISO 639-1 codes accepted as pass-through (the values of NAME_TO_ISO,
// deduplicated). Kept as its own set so callers can validate a code without
// re-deriving it from the name map.
const VALID_ISO_CODES = new Set(Object.values(NAME_TO_ISO));

/**
 * Normalize a language value (full name or ISO 639-1 code) to a lowercase
 * ISO 639-1 code.
 *
 * - Trims whitespace and is case-insensitive.
 * - Passes through already-valid ISO codes (e.g. 'en' -> 'en', 'EN' -> 'en').
 * - Maps known full names (e.g. 'English' -> 'en', 'Chinese (Simplified)' -> 'zh').
 * - Returns null for empty/unknown values (e.g. '', 'Klingon').
 *
 * @param {string} nameOrCode
 * @returns {string|null}
 */
function toIso(nameOrCode) {
  if (typeof nameOrCode !== 'string') return null;

  const trimmed = nameOrCode.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Already a valid ISO code.
  if (VALID_ISO_CODES.has(lower)) return lower;

  // Known full name.
  if (NAME_TO_ISO[lower]) return NAME_TO_ISO[lower];

  return null;
}

module.exports = { toIso, NAME_TO_ISO, VALID_ISO_CODES };
