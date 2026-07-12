const asyncHandler = require('../middleware/async');
const { ROOMS_ENABLED } = require('../config/limitations');

const DEFAULT_IOS_URL =
  'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146';
const DEFAULT_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.bananatalk.app';

// Per-platform override lookup. App Store + Play Store releases aren't
// synchronized — iOS review can take days while Android ships instantly —
// so we let the deployer set <PREFIX>_<NAME>_IOS / <PREFIX>_<NAME>_ANDROID
// overrides and fall back to <PREFIX>_<NAME> when an override isn't set.
// Older clients that don't send ?platform=... still get the global value,
// so this is fully back-compat with the previous release.
const pickEnv = (prefix, suffix, platform, fallback) => {
  const upper = (platform === 'ios' || platform === 'android')
    ? platform.toUpperCase()
    : null;
  if (upper) {
    const platformValue = process.env[`${prefix}_${suffix}_${upper}`];
    if (platformValue !== undefined && platformValue !== '') return platformValue;
  }
  const globalValue = process.env[`${prefix}_${suffix}`];
  if (globalValue !== undefined && globalValue !== '') return globalValue;
  return fallback;
};

exports.getAppConfig = asyncHandler(async (req, res) => {
  const platform = (req.query.platform || '').toString().toLowerCase();
  const minVersion = pickEnv('APP', 'MIN_VERSION', platform, '1.3.0');
  const latestVersion = pickEnv('APP', 'LATEST_VERSION', platform, '1.3.8');
  const forceUpdate = pickEnv('APP', 'FORCE_UPDATE', platform, 'false') === 'true';
  const iosUrl = process.env.APP_IOS_URL || DEFAULT_IOS_URL;
  const androidUrl = process.env.APP_ANDROID_URL || DEFAULT_ANDROID_URL;
  const releaseNotes = pickEnv('APP', 'RELEASE_NOTES', platform, '');

  // Announcement supports the same per-platform overrides so we can target
  // (e.g.) only Android users when only Android has a new release. Set
  // ANNOUNCEMENT_ACTIVE_ANDROID=true with ANNOUNCEMENT_ACTIVE=false to
  // ship an Android-only modal.
  const announcement = {
    active: pickEnv('ANNOUNCEMENT', 'ACTIVE', platform, 'false') === 'true',
    id: pickEnv('ANNOUNCEMENT', 'ID', platform, ''),
    title: pickEnv('ANNOUNCEMENT', 'TITLE', platform, ''),
    body: pickEnv('ANNOUNCEMENT', 'BODY', platform, ''),
    emoji: pickEnv('ANNOUNCEMENT', 'EMOJI', platform, '📢'),
    buttonLabel: pickEnv('ANNOUNCEMENT', 'BUTTON_LABEL', platform, ''),
    buttonUrl: pickEnv('ANNOUNCEMENT', 'BUTTON_URL', platform, ''),
  };

  res.status(200).json({
    success: true,
    data: {
      minVersion,
      latestVersion,
      forceUpdate,
      iosUrl,
      androidUrl,
      releaseNotes,
      announcement,
      roomsEnabled: ROOMS_ENABLED,
    },
  });
});
