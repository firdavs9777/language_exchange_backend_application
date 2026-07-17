// controllers/og.js
//
// Open Graph link-preview endpoint for crawlers (Facebook/Twitter/Slack/
// KakaoTalk/iMessage bots, etc). This is intentionally NOT mounted under
// /api/v1 — it renders plain HTML with OG/Twitter meta tags plus a
// meta-refresh + human-readable fallback link back to the real web page,
// so a crawler gets a rich preview while a human who somehow lands here
// gets bounced to the actual app/web route.
//
// Route: GET /og/:type/:id   type ∈ moment | profile | community | user
// Access: fully public, no auth. Must never throw — always resolves to a
// 200 (or 404) HTML response, falling back to a generic BananaTalk card
// for unknown ids/types/errors.

const Moment = require('../models/Moment');
const User = require('../models/User');
const { toCdnUrl } = require('../utils/imageUtils');

// Same field allow-list used by controllers/users.js getUser/getUserPublic —
// duplicated here (rather than imported) because that list is a local const,
// not exported. Keep in sync if the users controller's list changes.
const USER_PUBLIC_FIELDS =
  'name username bio occupation school images native_language language_to_learn ' +
  'level languageLevel streakDays totalXp createdAt userMode vipSubscription.isActive ' +
  'vipSubscription.plan location gender birth_year birth_month birth_day followers ' +
  'following mbti bloodType topics privacySettings isOnline lastActive';

const FRONTEND_URL_BASE =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://banatalk.com' : 'http://localhost:3000');

const APP_NAME = 'BananaTalk';
const DEFAULT_OG_IMAGE = `${FRONTEND_URL_BASE}/logo512.png`;
const DEFAULT_TITLE = `${APP_NAME} - #1 Free Language Exchange App`;
const DEFAULT_DESCRIPTION =
  'Practice Korean, English, Japanese and 50+ languages with native speakers through chat, voice messages & interactive lessons.';

// Types that map to a User document. 'user' is normalized to 'profile' for
// the canonical web URL so it matches the web app's actual route.
const USER_OG_TYPES = new Set(['profile', 'community', 'user']);

/**
 * Minimal HTML-escaper for text dropped into attribute values / body text.
 * Order matters: & must be escaped first.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the OG/Twitter meta HTML for a link preview. Pure function — no I/O,
 * no Express req/res — so it's directly unit-testable.
 *
 * @param {Object} params
 * @param {string} params.canonicalUrl - the real web URL this preview stands in for
 * @param {string} [params.title]
 * @param {string} [params.description]
 * @param {string} [params.image]
 * @param {string} [params.siteName]
 * @returns {string} full HTML document
 */
function buildOgHtml({ canonicalUrl, title, description, image, siteName } = {}) {
  const safeTitle = escapeHtml(title || DEFAULT_TITLE);
  const safeDescription = escapeHtml(description || DEFAULT_DESCRIPTION);
  const safeImage = escapeHtml(image || DEFAULT_OG_IMAGE);
  const safeUrl = escapeHtml(canonicalUrl || FRONTEND_URL_BASE);
  const safeSiteName = escapeHtml(siteName || APP_NAME);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeUrl}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="${safeSiteName}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:url" content="${safeUrl}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">

<meta http-equiv="refresh" content="0; url=${safeUrl}">
</head>
<body>
<p>Redirecting to <a href="${safeUrl}">${safeUrl}</a>&hellip;</p>
</body>
</html>`;
}

function sendHtml(res, status, html) {
  res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(html);
}

function genericHtml(canonicalUrl) {
  return buildOgHtml({
    canonicalUrl: canonicalUrl || FRONTEND_URL_BASE,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_OG_IMAGE,
  });
}

/**
 * Whether a user's profile should be treated as non-public for OG purposes.
 *
 * NOTE: the current User model only exposes granular privacy toggles
 * (showCountryRegion, showAge, showOnlineStatus, ...) — there is no
 * whole-profile "private account" switch today. name/username/bio/avatar
 * are not gated by any of those toggles, so a personalized OG card is safe
 * under the current schema. This check is wired defensively in case a
 * future `profileVisibility`/`isPrivate` field is added, so this endpoint
 * degrades to a generic card automatically without a code change.
 */
function isProfileNonPublic(user) {
  const ps = user && user.privacySettings;
  if (!ps) return false;
  return ps.isPrivate === true || ps.profileVisibility === 'private';
}

async function buildMomentOg(id) {
  const moment = await Moment.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
  if (!moment) return null;

  const rawTitle = moment.title && moment.title.trim();
  const description = moment.description || '';
  const title = rawTitle || (description ? description.slice(0, 60) : DEFAULT_TITLE);
  const image = toCdnUrl(
    (moment.video && moment.video.thumbnail) ||
      (moment.images && moment.images[0]) ||
      undefined
  );

  return {
    canonicalUrl: `${FRONTEND_URL_BASE}/moment/${id}`,
    title,
    description,
    image,
  };
}

async function buildUserOg(id, typeForUrl) {
  const user = await User.findById(id).select(USER_PUBLIC_FIELDS).lean();
  if (!user) return null;

  const canonicalUrl = `${FRONTEND_URL_BASE}/${typeForUrl}/${id}`;

  if (isProfileNonPublic(user)) {
    return {
      canonicalUrl,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      image: DEFAULT_OG_IMAGE,
    };
  }

  const title = user.name || (user.username ? `@${user.username}` : DEFAULT_TITLE);
  const description = user.bio || DEFAULT_DESCRIPTION;
  const image = toCdnUrl((user.images && user.images[0]) || undefined);

  return { canonicalUrl, title, description, image };
}

/**
 * @desc    Public OG/link-preview HTML for a shared moment/profile URL
 * @route   GET /og/:type/:id
 * @access  Public
 */
async function getOg(req, res) {
  const { type, id } = req.params;

  try {
    let ogData = null;

    if (type === 'moment') {
      ogData = await buildMomentOg(id);
    } else if (USER_OG_TYPES.has(type)) {
      ogData = await buildUserOg(id, 'profile');
    } else {
      // Unknown type — generic card, no crash.
      return sendHtml(res, 200, genericHtml(`${FRONTEND_URL_BASE}/${type || ''}/${id || ''}`));
    }

    if (!ogData) {
      // Not found — generic card with a 404 status so crawlers don't index it,
      // but still render usable HTML rather than an error page.
      return sendHtml(res, 404, genericHtml());
    }

    return sendHtml(res, 200, buildOgHtml(ogData));
  } catch (err) {
    console.error('OG preview generation failed:', err.message);
    return sendHtml(res, 200, genericHtml());
  }
}

module.exports = {
  getOg,
  buildOgHtml,
  escapeHtml,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
};
