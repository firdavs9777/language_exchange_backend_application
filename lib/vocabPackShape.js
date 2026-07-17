/**
 * VocabPack data-file shape validation — pure, no I/O. (H9)
 *
 * seeds/vocabPacks.js reads migrations/vocabPacksData.json and refuses to seed
 * anything that fails these checks. Rules:
 * - pack: level ∈ {intermediate, advanced}, non-empty topic, ≥1 word
 * - word: word/definition/example all non-empty strings; translationHint
 *   optional string
 * - no duplicate words within a pack (case-insensitive)
 * - no two packs with the same (level, topic) pair
 * - exercises: optional array; when present each item must have a valid type
 *   and the fields that type requires (see _validateExercise)
 */

const VALID_LEVELS = ['intermediate', 'advanced'];
const VALID_EXERCISE_TYPES = ['multiple_choice', 'fill_blank', 'matching', 'error_correction'];

const _isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function _validateExercise(ex, label, errors) {
  if (!ex || typeof ex !== 'object') {
    errors.push(`${label}: not an object`);
    return;
  }
  if (!VALID_EXERCISE_TYPES.includes(ex.type)) {
    errors.push(`${label}: type must be one of ${VALID_EXERCISE_TYPES.join('|')}, got "${ex.type}"`);
    return;
  }
  switch (ex.type) {
    case 'multiple_choice':
      if (!_isNonEmptyString(ex.prompt)) errors.push(`${label}: prompt is required`);
      if (!Array.isArray(ex.options) || ex.options.length < 2) {
        errors.push(`${label}: options must be an array of at least 2 choices`);
      } else if (!ex.options.every(_isNonEmptyString)) {
        errors.push(`${label}: every option must be a non-empty string`);
      } else if (!Number.isInteger(ex.answerIndex) || ex.answerIndex < 0 || ex.answerIndex >= ex.options.length) {
        errors.push(`${label}: answerIndex must be a valid index into options`);
      }
      break;
    case 'fill_blank':
      if (!_isNonEmptyString(ex.prompt)) errors.push(`${label}: prompt is required`);
      if (!_isNonEmptyString(ex.answer)) errors.push(`${label}: answer is required`);
      break;
    case 'error_correction':
      if (!_isNonEmptyString(ex.prompt)) errors.push(`${label}: prompt is required`);
      if (!_isNonEmptyString(ex.corrected)) errors.push(`${label}: corrected is required`);
      break;
    case 'matching':
      if (!Array.isArray(ex.pairs) || ex.pairs.length < 2) {
        errors.push(`${label}: pairs must be an array of at least 2 pairs`);
      } else {
        ex.pairs.forEach((p, pi) => {
          if (!_isNonEmptyString(p?.term) || !_isNonEmptyString(p?.definition)) {
            errors.push(`${label}.pairs[${pi}]: term and definition are required`);
          }
        });
      }
      break;
    default:
      break;
  }
}

/**
 * @param {Array<Object>} packs - parsed JSON array
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateVocabPacksData(packs) {
  const errors = [];

  if (!Array.isArray(packs) || packs.length === 0) {
    return { valid: false, errors: ['data must be a non-empty array of packs'] };
  }

  const seenPackKeys = new Set();

  packs.forEach((pack, pi) => {
    const label = `pack[${pi}]${pack?.topic ? ` (${pack.topic})` : ''}`;

    if (!pack || typeof pack !== 'object') {
      errors.push(`${label}: not an object`);
      return;
    }
    if (!VALID_LEVELS.includes(pack.level)) {
      errors.push(`${label}: level must be one of ${VALID_LEVELS.join('|')}, got "${pack.level}"`);
    }
    if (!_isNonEmptyString(pack.topic)) {
      errors.push(`${label}: topic is required`);
    }

    const packKey = `${pack.level}::${(pack.topic || '').trim().toLowerCase()}`;
    if (seenPackKeys.has(packKey)) {
      errors.push(`${label}: duplicate (level, topic) pair`);
    }
    seenPackKeys.add(packKey);

    if (!Array.isArray(pack.words) || pack.words.length === 0) {
      errors.push(`${label}: words must be a non-empty array`);
      return;
    }

    const seenWords = new Set();
    pack.words.forEach((w, wi) => {
      const wLabel = `${label}.words[${wi}]`;
      if (!w || typeof w !== 'object') {
        errors.push(`${wLabel}: not an object`);
        return;
      }
      for (const field of ['word', 'definition', 'example']) {
        if (!_isNonEmptyString(w[field])) {
          errors.push(`${wLabel}: ${field} is required`);
        }
      }
      if (w.translationHint !== undefined && typeof w.translationHint !== 'string') {
        errors.push(`${wLabel}: translationHint must be a string when present`);
      }
      const key = (w.word || '').trim().toLowerCase();
      if (key) {
        if (seenWords.has(key)) {
          errors.push(`${wLabel}: duplicate word "${w.word}" within pack`);
        }
        seenWords.add(key);
      }
    });

    // exercises are optional; validate shape when present
    if (pack.exercises !== undefined) {
      if (!Array.isArray(pack.exercises)) {
        errors.push(`${label}: exercises must be an array when present`);
      } else {
        pack.exercises.forEach((ex, ei) => {
          _validateExercise(ex, `${label}.exercises[${ei}]`, errors);
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateVocabPacksData, VALID_LEVELS, VALID_EXERCISE_TYPES };
