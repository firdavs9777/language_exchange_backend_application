const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

// Required lazily so the module can be loaded (and its config warning emitted)
// before Flame's mongoose connection is open. Models bind to the connection at
// require time; pulling Translation in at the top would force that ordering on
// every consumer.
const _Translation = () => require('../models/Translation');

const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || null;

if (!process.env.LIBRETRANSLATE_URL) {
  // Say it at boot rather than when a user taps Translate. A misconfigured
  // Spaces bucket stayed invisible for weeks because nothing announced itself
  // until someone hit it; the public instance is rate limited and will reject
  // production traffic the same way.
  logger.warn(
    `LIBRETRANSLATE_URL not set — falling back to ${LIBRETRANSLATE_URL}, `
    + 'which is rate limited and may reject production traffic.',
  );
}

function cacheKey(text, sourceLang, targetLang) {
  return crypto
    .createHash('sha256')
    .update(`${sourceLang}:${targetLang}:${text}`)
    .digest('hex');
}

// LibreTranslate takes the API key in the body, and only when it is set —
// some instances reject an empty one outright.
function body(fields) {
  const out = { ...fields };
  if (LIBRETRANSLATE_API_KEY && LIBRETRANSLATE_API_KEY.trim() !== '') {
    out.api_key = LIBRETRANSLATE_API_KEY;
  }
  return out;
}

async function detect(text) {
  const res = await axios.post(
    `${LIBRETRANSLATE_URL}/detect`,
    body({ q: text }),
    { timeout: 5000, headers: { 'Content-Type': 'application/json' } },
  );
  if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].language) {
    return res.data[0].language;
  }
  throw new Error('LibreTranslate returned no detection');
}

/**
 * Translates `text` into `targetLang`.
 *
 * `sourceLang` is optional; when absent the language is detected first, and the
 * DETECTED value is what the cache is keyed on. That way an auto-detect request
 * and an explicit-source request for the same text resolve to one entry instead
 * of writing two. Detection is the cheap half of the call, so running it before
 * the cache lookup costs little.
 *
 * @returns {Promise<{translatedText: string, detectedSourceLang: string, cached: boolean}>}
 */
async function translate({ text, targetLang, sourceLang }) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new ValidationError('text is required');
  if (!targetLang) throw new ValidationError('target_lang is required');

  try {
    const source = sourceLang || (await detect(trimmed));

    // Nothing to do, and no reason to spend a metered call finding that out.
    if (source === targetLang) {
      return { translatedText: trimmed, detectedSourceLang: source, cached: true };
    }

    const Translation = _Translation();
    const key = cacheKey(trimmed, source, targetLang);

    const hit = await Translation.findOne({ key });
    if (hit) {
      return {
        translatedText: hit.translatedText,
        detectedSourceLang: source,
        cached: true,
      };
    }

    const res = await axios.post(
      `${LIBRETRANSLATE_URL}/translate`,
      body({ q: trimmed, source, target: targetLang, format: 'text' }),
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } },
    );

    const translatedText = res.data && res.data.translatedText;
    if (!translatedText) throw new Error('LibreTranslate returned no translation');

    // Best effort: a cache write failure must not fail the translation the
    // user is already waiting on.
    try {
      await Translation.create({ key, sourceLang: source, targetLang, translatedText });
    } catch (e) {
      logger.warn(`translation cache write failed: ${e.message}`);
    }

    return { translatedText, detectedSourceLang: source, cached: false };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // Everything else is the provider being unreachable, slow, or unhappy.
    // A ValidationError reaches the client as a 422 it can show; rethrowing
    // would hit the generic handler and surface as an unexplained 500.
    logger.error(`translation failed: ${err.message}`);
    throw new ValidationError('Translation is unavailable right now');
  }
}

module.exports = { translate, LIBRETRANSLATE_URL };
