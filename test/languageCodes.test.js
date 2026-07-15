const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toIso } = require('../utils/languageCodes');

// ---------------------------------------------------------------------------
// toIso — FULL languages-collection coverage. The `languages` collection
// (seeds/languages.js, 127+ names, verified against prod 2026-07-15) is the
// real source of truth for what users can pick as native_language /
// language_to_learn. Every name with an ISO 639-1 code must normalize so
// feed ranking (For You, reels two-bucket) and matching group variant
// speakers with their base language.
// ---------------------------------------------------------------------------

// Names with NO ISO 639-1 code (639-3 only) — deliberately unmapped; feeds
// simply don't language-boost them. Keep this list in sync with the
// exception note in utils/languageCodes.js.
const NO_ISO_639_1 = new Set([
  'Dari',                      // prs
  'Hawaiian',                  // haw
  'American Sign Language',    // ase
  'British Sign Language',     // bfi
  'Japanese Sign Language',    // jsl
  'Korean Sign Language',      // kvk
]);

const ALL_LANGUAGE_NAMES = [
  'English', 'Korean', 'Tagalog', 'Filipino', 'Arabic', 'Japanese',
  'Vietnamese', 'Thai', 'Indonesian', 'Malay', 'Burmese',
  'Chinese (Traditional)', 'Chinese (Simplified)', 'Hindi', 'Bengali',
  'Tamil', 'Telugu', 'Marathi', 'Urdu', 'Nepali', 'Sinhala', 'Spanish',
  'Portuguese', 'Portuguese (Brazil)', 'French', 'German', 'Italian',
  'Russian', 'Ukrainian', 'Dutch', 'Swedish', 'Polish', 'Norwegian',
  'Danish', 'Finnish', 'Greek', 'Hungarian', 'Khmer', 'Lao', 'Turkish',
  'English (US)', 'Cantonese', 'English (UK)', 'Punjabi', 'Gujarati',
  'Kannada', 'Malayalam', 'Odia', 'Assamese', 'Sindhi', 'Kashmiri',
  'Dhivehi', 'Hebrew', 'Persian', 'Pashto', 'Dari', 'Kurdish', 'Swahili',
  'Amharic', 'Tigrinya', 'Oromo', 'Somali', 'Afrikaans', 'Zulu', 'Xhosa',
  'Romanian', 'Setswana', 'Czech', 'Kinyarwanda', 'Luganda', 'Malagasy',
  'Yoruba', 'Chichewa', 'Igbo', 'Hausa', 'Wolof', 'Fula', 'Kazakh',
  'Kyrgyz', 'Uzbek', 'Turkmen', 'Tajik', 'Mongolian', 'Georgian',
  'Azerbaijani', 'Bulgarian', 'Armenian', 'Serbian', 'Croatian', 'Slovak',
  'Slovenian', 'Bosnian', 'Macedonian', 'Belarusian', 'Estonian',
  'Lithuanian', 'Latvian', 'Catalan', 'Galician', 'Basque', 'Occitan',
  'Icelandic', 'Luxembourgish', 'Frisian', 'Faroese', 'Irish', 'Welsh',
  'Scottish Gaelic', 'Breton', 'Maltese', 'Albanian', 'Maori', 'Samoan',
  'Tongan', 'Fijian', 'Hawaiian', 'Haitian Creole', 'Quechua', 'Guarani',
  'Esperanto', 'Latin', 'American Sign Language', 'British Sign Language',
  'Japanese Sign Language', 'Korean Sign Language', 'Sesotho', 'Shona',
  // Seeded but not yet in prod (pending seeder re-run):
  'Spanish (Mexico)', 'French (Canada)', 'Portuguese (Portugal)',
  'English (Australia)', 'English (Canada)', 'Spanish (Argentina)',
  'Arabic (Egyptian)', 'Arabic (Levantine)', 'Arabic (Gulf)',
  'Arabic (Moroccan Darija)',
];

test('toIso: every 639-1-capable language in the languages collection normalizes', () => {
  const missing = [];
  for (const name of ALL_LANGUAGE_NAMES) {
    if (NO_ISO_639_1.has(name)) continue;
    if (toIso(name) === null) missing.push(name);
  }
  assert.deepEqual(missing, [], `unmapped languages: ${missing.join(', ')}`);
});

test('toIso: documented 639-3-only exceptions return null (no accidental mapping)', () => {
  for (const name of NO_ISO_639_1) {
    assert.equal(toIso(name), null, name);
  }
});

test('toIso: regional variants group with their base language (matching semantics)', () => {
  assert.equal(toIso('Portuguese (Brazil)'), 'pt');
  assert.equal(toIso('Portuguese (Portugal)'), 'pt');
  assert.equal(toIso('English (US)'), 'en');
  assert.equal(toIso('English (UK)'), 'en');
  assert.equal(toIso('Chinese (Traditional)'), 'zh');
  assert.equal(toIso('Chinese (Simplified)'), 'zh');
  assert.equal(toIso('Cantonese'), 'zh');
  assert.equal(toIso('Spanish (Mexico)'), 'es');
  assert.equal(toIso('Spanish (Spain)'), 'es');
  assert.equal(toIso('Spanish (Argentina)'), 'es');
  assert.equal(toIso('French (Canada)'), 'fr');
  assert.equal(toIso('English (Australia)'), 'en');
  assert.equal(toIso('English (Canada)'), 'en');
});

test('toIso: Arabic varieties all group to base ar (no fragmentation)', () => {
  assert.equal(toIso('Arabic'), 'ar'); // plain Arabic doubles as MSA
  assert.equal(toIso('Arabic (MSA)'), 'ar');
  assert.equal(toIso('Arabic (Egyptian)'), 'ar');
  assert.equal(toIso('Arabic (Levantine)'), 'ar');
  assert.equal(toIso('Arabic (Gulf)'), 'ar');
  assert.equal(toIso('Arabic (Moroccan Darija)'), 'ar');
});

test('rooms normalizeLanguage: new variants join the base-language hub', () => {
  const { normalizeLanguage } = require('../lib/normalizeLanguage');
  assert.equal(normalizeLanguage('English (Australia)'), 'en');
  assert.equal(normalizeLanguage('English (Canada)'), 'en');
  assert.equal(normalizeLanguage('Spanish (Argentina)'), 'es');
  assert.equal(normalizeLanguage('Arabic (Egyptian)'), 'ar');
  assert.equal(normalizeLanguage('Arabic (Levantine)'), 'ar');
  assert.equal(normalizeLanguage('Arabic (Gulf)'), 'ar');
  assert.equal(normalizeLanguage('Arabic (Moroccan Darija)'), 'ar');
});

test('normalizeLocale: new variant display names resolve to a template locale', () => {
  const { normalizeLocale } = require('../lib/normalizeLocale');
  assert.equal(normalizeLocale('English (Australia)'), 'en');
  assert.equal(normalizeLocale('English (Canada)'), 'en');
  assert.equal(normalizeLocale('Spanish (Argentina)'), 'es');
  assert.equal(normalizeLocale('Arabic (Egyptian)'), 'ar');
  assert.equal(normalizeLocale('Arabic (Moroccan Darija)'), 'ar');
});

test('toIso: ISO-code pass-through and unknowns unchanged (regression)', () => {
  assert.equal(toIso('en'), 'en');
  assert.equal(toIso('EN'), 'en');
  assert.equal(toIso(''), null);
  assert.equal(toIso('Klingon'), null);
});
