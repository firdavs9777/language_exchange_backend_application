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
  // Regional language variants offered by the languages collection
  // (seeds/languages.js). For matching/ranking purposes a variant speaker
  // IS a base-language speaker: a "Portuguese (Brazil)" native matches
  // 'pt' content and learners. The app renders variant-specific FLAGS
  // (Brazil vs Portugal) client-side; this normalization is only grouping.
  'portuguese (brazil)': 'pt',
  'portuguese (portugal)': 'pt',
  'english (uk)': 'en',
  'english (australia)': 'en',
  'english (canada)': 'en',
  'cantonese': 'zh',
  'spanish (mexico)': 'es',
  'spanish (spain)': 'es',
  'spanish (argentina)': 'es',
  'french (canada)': 'fr',
  // Arabic varieties (ar-EG/ar-LV/ar-GU/ar-MA in seeds/languages.js) —
  // all group to base 'ar'; plain "Arabic" doubles as MSA.
  'arabic (msa)': 'ar',
  'arabic (egyptian)': 'ar',
  'arabic (levantine)': 'ar',
  'arabic (gulf)': 'ar',
  'arabic (moroccan darija)': 'ar',

  // FULL languages-collection coverage (127 names, seeds/languages.js —
  // the real source of truth for what users can pick; the old ~40-name
  // Flutter filter list above is a subset). Every name with an ISO 639-1
  // code normalizes, so feed ranking/matching works for every pickable
  // language. Exceptions WITHOUT a 639-1 code stay unmapped and
  // deliberately return null (feeds simply don't language-boost them):
  // Dari (prs), Hawaiian (haw), and the four sign languages
  // (ase/bfi/jsl/kvk) — all ISO 639-3 only. Enforced by
  // test/languageCodes.test.js.
  'tagalog': 'tl',
  'burmese': 'my',
  'khmer': 'km',
  'lao': 'lo',
  'tamil': 'ta',
  'telugu': 'te',
  'marathi': 'mr',
  'nepali': 'ne',
  'sinhala': 'si',
  'punjabi': 'pa',
  'gujarati': 'gu',
  'kannada': 'kn',
  'malayalam': 'ml',
  'odia': 'or',
  'assamese': 'as',
  'sindhi': 'sd',
  'kashmiri': 'ks',
  'dhivehi': 'dv',
  'pashto': 'ps',
  'kurdish': 'ku',
  'swahili': 'sw',
  'amharic': 'am',
  'tigrinya': 'ti',
  'oromo': 'om',
  'somali': 'so',
  'afrikaans': 'af',
  'zulu': 'zu',
  'xhosa': 'xh',
  'setswana': 'tn',
  'sesotho': 'st',
  'shona': 'sn',
  'kinyarwanda': 'rw',
  'luganda': 'lg',
  'malagasy': 'mg',
  'yoruba': 'yo',
  'chichewa': 'ny',
  'igbo': 'ig',
  'hausa': 'ha',
  'wolof': 'wo',
  'fula': 'ff',
  'kazakh': 'kk',
  'kyrgyz': 'ky',
  'uzbek': 'uz',
  'turkmen': 'tk',
  'mongolian': 'mn',
  'georgian': 'ka',
  'azerbaijani': 'az',
  'bulgarian': 'bg',
  'armenian': 'hy',
  'serbian': 'sr',
  'croatian': 'hr',
  'slovak': 'sk',
  'slovenian': 'sl',
  'bosnian': 'bs',
  'macedonian': 'mk',
  'belarusian': 'be',
  'estonian': 'et',
  'lithuanian': 'lt',
  'latvian': 'lv',
  'catalan': 'ca',
  'galician': 'gl',
  'basque': 'eu',
  'occitan': 'oc',
  'icelandic': 'is',
  'luxembourgish': 'lb',
  'frisian': 'fy',
  'faroese': 'fo',
  'irish': 'ga',
  'welsh': 'cy',
  'scottish gaelic': 'gd',
  'breton': 'br',
  'maltese': 'mt',
  'albanian': 'sq',
  'maori': 'mi',
  'samoan': 'sm',
  'tongan': 'to',
  'fijian': 'fj',
  'haitian creole': 'ht',
  'quechua': 'qu',
  'guarani': 'gn',
  'esperanto': 'eo',
  'latin': 'la',
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
