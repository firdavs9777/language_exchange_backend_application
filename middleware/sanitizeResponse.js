/**
 * Strips lone UTF-16 surrogates from all string values in API responses.
 * Lone surrogates (U+D800–U+DFFF without a valid pair) crash Flutter's
 * text engine (_NativeParagraphBuilder.addText). This middleware intercepts
 * res.json() and recursively cleans every string before it leaves the server,
 * so the Flutter app never receives malformed Unicode regardless of what is
 * stored in MongoDB.
 *
 * Strategy: first convert to a plain JSON-round-tripped object so that
 * Mongoose ObjectIds, Dates, and other special objects are serialised to their
 * primitive equivalents (via .toJSON()) and circular references are eliminated.
 * Then run the surrogate-strip pass on the resulting plain data.
 * If the initial JSON round-trip itself fails we fall back to the original data.
 */

function stripLoneSurrogates(str) {
  let hasIssue = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDFFF) { hasIssue = true; break; }
  }
  if (!hasIssue) return str;

  const result = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate — keep only if followed by a low surrogate
      if (i + 1 < str.length) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          result.push(str[i], str[i + 1]);
          i++;
          continue;
        }
      }
      // Lone high surrogate — drop
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // Lone low surrogate — drop
    } else {
      result.push(str[i]);
    }
  }
  return result.join('');
}

// Only called on plain JSON-round-tripped data (strings/arrays/plain objects/primitives).
function deepClean(value) {
  if (typeof value === 'string') return stripLoneSurrogates(value);
  if (Array.isArray(value)) return value.map(deepClean);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = deepClean(value[key]);
    }
    return out;
  }
  return value;
}

const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    try {
      // JSON round-trip: serialises ObjectIds/Dates via .toJSON() and removes
      // circular references. deepClean then only sees plain primitives.
      const plain = JSON.parse(JSON.stringify(data));
      return originalJson(deepClean(plain));
    } catch (_) {
      // Fallback: send original data untouched if round-trip fails.
      return originalJson(data);
    }
  };
  next();
};

module.exports = sanitizeResponse;
