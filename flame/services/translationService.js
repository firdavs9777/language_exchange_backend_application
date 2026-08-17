const crypto = require('crypto');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

// Required lazily so this module loads (and emits its config warning) before
// Flame's mongoose connection is open. Models bind to the connection at require
// time; a top-level require here would force that ordering on every consumer.
const _Translation = () => require('../models/Translation');

// Same env var and default model BananaTalk's config/aiConfig.js uses, so both
// apps translate through the one funded provider.
//
// Deliberately NOT a require of BananaTalk's aiProviderService: that lives
// outside flame/, and the isolation rule has earned its keep repeatedly — root
// code can change under Flame without warning. Mirroring twenty lines is
// cheaper than that coupling.
//
// This replaces LibreTranslate, which could never have worked here:
// LIBRETRANSLATE_URL points at the public instance with an empty API key, and
// that instance now answers 400 to both /detect and /translate. BananaTalk's
// own comment and moment translation is broken for the same reason.
const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) {
  // Say it at boot rather than when a user taps Translate. The previous
  // provider was misconfigured and nothing announced it until someone read a
  // production log by hand.
  logger.warn('OPENAI_API_KEY not set — translation will fail on every request.');
}

// Lazy, like BananaTalk's client: constructing it at module load would throw on
// a server without the key, taking the whole Flame router down with it.
let _client = null;
function client() {
  if (!_client) {
    const OpenAI = require('openai');
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// The cache key: text and target only, NOT the source language.
//
// The source is a property of the text, so an auto-detect request and an
// explicit-source request for the same text are the same question and must
// resolve to one entry rather than two.
function cacheKey(text, targetLang) {
  return crypto
    .createHash('sha256')
    .update(`${targetLang}:${text}`)
    .digest('hex');
}

// A missing or rejected key never starts working on its own, so telling the
// user to try again is a lie. Distinguished from an outage.
function _isAuthProblem(err) {
  if (err && (err.status === 401 || err.status === 403)) return true;
  const message = err && err.message ? err.message : '';
  return /api[_ ]?key|unauthor|incorrect api/i.test(message);
}

/**
 * Translates `text` into `targetLang`.
 *
 * `sourceLang` is optional and only ever a hint — a model does not need to be
 * told what it is reading. That is the whole reason this uses a completion
 * rather than either of BananaTalk's translation paths: LibreTranslate needs a
 * `/detect` round trip and 400s on the public instance, and the
 * enhanced-translation endpoint requires `sourceLanguage` and 400s without it,
 * which Flame's shipped client cannot supply since it sends the field as
 * optional.
 *
 * @returns {Promise<{translatedText: string, detectedSourceLang: ?string, cached: boolean}>}
 */
async function translate({ text, targetLang, sourceLang }) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new ValidationError('text is required');
  if (!targetLang) throw new ValidationError('target_lang is required');

  const Translation = _Translation();
  const key = cacheKey(trimmed, targetLang);

  const hit = await Translation.findOne({ key });
  if (hit) {
    return {
      translatedText: hit.translatedText,
      detectedSourceLang: sourceLang || null,
      cached: true,
    };
  }

  try {
    const from = sourceLang ? ` The text is in ${sourceLang}.` : '';
    const res = await client().chat.completions.create({
      model: MODEL,
      // Deterministic: the same message must not translate two ways, or the
      // cache would be hiding variation rather than saving work.
      temperature: 0,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content:
            'You translate chat messages. Reply with the translation only — no '
            + 'quotes, no explanation, no transliteration, no notes. Preserve '
            + 'emoji and punctuation. If the text is already in the target '
            + 'language, reply with it unchanged.',
        },
        {
          role: 'user',
          content: `Translate into ${targetLang}.${from}\n\n${trimmed}`,
        },
      ],
    });

    const choice = res && res.choices && res.choices[0];
    const translatedText = ((choice && choice.message && choice.message.content) || '').trim();

    // A blank completion is a failure. An empty translation on screen looks
    // like the message said nothing, which is worse than an error.
    if (!translatedText) throw new Error('empty completion');

    // Best effort: a cache write failure must not fail the translation the user
    // is already waiting on.
    try {
      await Translation.create({
        key,
        sourceLang: sourceLang || 'auto',
        targetLang,
        translatedText,
      });
    } catch (e) {
      logger.warn(`translation cache write failed: ${e.message}`);
    }

    return {
      translatedText,
      detectedSourceLang: sourceLang || null,
      cached: false,
    };
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    // Status AND message: the previous provider logged only 'Request failed
    // with status code 400', which made a real production failure impossible to
    // diagnose from the logs.
    logger.error(
      `translation failed: ${err.message}`
      + `${err.status ? ` status=${err.status}` : ''}`,
    );

    if (_isAuthProblem(err)) {
      throw new ValidationError('Translation is not configured on this server');
    }
    throw new ValidationError('Translation is unavailable right now');
  }
}

module.exports = { translate, MODEL };
