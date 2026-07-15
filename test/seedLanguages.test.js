const { test } = require('node:test');
const assert = require('node:assert/strict');
const { languages } = require('../seeds/languages');
const { toIso } = require('../utils/languageCodes');

// ---------------------------------------------------------------------------
// Seeder safety audit (Scope C review requirement).
//
// The seeder is run against PROD, and users' native_language /
// language_to_learn hold catalog NAMES by value — so the seed file must
// never lose or rename a language that live users already picked. The
// seeder itself is now strictly additive ($setOnInsert upserts, see
// seeds/languages.js), and these tests pin the invariants:
//   1. every language present in prod (127 names, snapshot 2026-07-15)
//      stays in the seed file forever,
//   2. no duplicate codes or names,
//   3. every row has a flag,
//   4. every name normalizes via toIso OR is a documented 639-1-less
//      exception (feeds simply don't language-boost those).
// ---------------------------------------------------------------------------

// Snapshot of the prod `languages` collection (127 names, 2026-07-15).
// If a test fails because a name was removed from the seed: DO NOT edit
// this list — restore the seed entry. Removing a language users hold is
// a data migration, not a seed edit.
const PROD_LANGUAGE_NAMES_2026_07_15 = [
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
];

// Names with no ISO 639-1 base — mirror of the exception list in
// utils/languageCodes.js and test/languageCodes.test.js.
const NO_ISO_639_1 = new Set([
  'Dari', 'Hawaiian',
  'American Sign Language', 'British Sign Language',
  'Japanese Sign Language', 'Korean Sign Language',
]);

test('seed preserves every language currently in prod (127-name snapshot) — additive-only guarantee', () => {
  const seedNames = new Set(languages.map((l) => l.name));
  const missing = PROD_LANGUAGE_NAMES_2026_07_15.filter((n) => !seedNames.has(n));
  assert.deepEqual(missing, [],
    `Seed file lost prod languages (users hold these by value!): ${missing.join(', ')}`);
});

test('seed has no duplicate codes', () => {
  const codes = languages.map((l) => l.code);
  const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
  assert.deepEqual([...new Set(dupes)], [], `duplicate codes: ${dupes.join(', ')}`);
});

test('seed has no duplicate names', () => {
  const names = languages.map((l) => l.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual([...new Set(dupes)], [], `duplicate names: ${dupes.join(', ')}`);
});

test('every seed row has a non-empty code, name, nativeName and flag', () => {
  for (const lang of languages) {
    assert.ok(lang.code && lang.code.trim().length > 0, `empty code: ${JSON.stringify(lang)}`);
    assert.ok(lang.name && lang.name.trim().length > 0, `empty name: ${lang.code}`);
    assert.ok(lang.nativeName && lang.nativeName.trim().length > 0, `empty nativeName: ${lang.code}`);
    assert.ok(lang.flag && lang.flag.trim().length > 0, `missing flag: ${lang.code} (${lang.name})`);
  }
});

test('every seed name normalizes via toIso, except the documented 639-1-less set', () => {
  const missing = [];
  for (const lang of languages) {
    if (NO_ISO_639_1.has(lang.name)) continue;
    if (toIso(lang.name) === null) missing.push(lang.name);
  }
  assert.deepEqual(missing, [], `seed names without toIso grouping: ${missing.join(', ')}`);
});

test('Scope C variants are present with their exact flags', () => {
  const byName = Object.fromEntries(languages.map((l) => [l.name, l]));
  assert.equal(byName['English (Australia)']?.flag, '🇦🇺');
  assert.equal(byName['English (Canada)']?.flag, '🇨🇦');
  assert.equal(byName['Spanish (Argentina)']?.flag, '🇦🇷');
  assert.equal(byName['Portuguese (Portugal)']?.flag, '🇵🇹');
  assert.equal(byName['Arabic (Egyptian)']?.flag, '🇪🇬');
  assert.equal(byName['Arabic (Levantine)']?.flag, '🇱🇧');
  assert.equal(byName['Arabic (Gulf)']?.flag, '🇸🇦');
  assert.equal(byName['Arabic (Moroccan Darija)']?.flag, '🇲🇦');
  // Plain Arabic stays (83 prod users hold it; doubles as MSA).
  assert.ok(byName['Arabic'], 'plain "Arabic" must never leave the seed');
});
