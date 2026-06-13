const asyncHandler = require('../middleware/async');

const DEFAULT_IOS_URL =
  'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146';
const DEFAULT_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.bananatalk.app';

// Per-platform override lookup. App Store + Play Store releases aren't
// synchronized — iOS review can take days while Android ships instantly —
// so we let the deployer set APP_<NAME>_IOS / APP_<NAME>_ANDROID overrides
// and fall back to the global APP_<NAME> when an override isn't set.
// Older clients that don't send ?platform=... still get the global value,
// so this is fully back-compat with the previous release.
const pickEnv = (suffix, platform, fallback) => {
  const upper = (platform === 'ios' || platform === 'android')
    ? platform.toUpperCase()
    : null;
  if (upper) {
    const platformValue = process.env[`APP_${suffix}_${upper}`];
    if (platformValue !== undefined && platformValue !== '') return platformValue;
  }
  const globalValue = process.env[`APP_${suffix}`];
  if (globalValue !== undefined && globalValue !== '') return globalValue;
  return fallback;
};

exports.getAppConfig = asyncHandler(async (req, res) => {
  const platform = (req.query.platform || '').toString().toLowerCase();
  const minVersion = pickEnv('MIN_VERSION', platform, '1.3.0');
  const latestVersion = pickEnv('LATEST_VERSION', platform, '1.3.8');
  const forceUpdate = pickEnv('FORCE_UPDATE', platform, 'false') === 'true';
  const iosUrl = process.env.APP_IOS_URL || DEFAULT_IOS_URL;
  const androidUrl = process.env.APP_ANDROID_URL || DEFAULT_ANDROID_URL;
  const releaseNotes = pickEnv('RELEASE_NOTES', platform, '');

  const announcement = {
    active: process.env.ANNOUNCEMENT_ACTIVE === 'true',
    id: process.env.ANNOUNCEMENT_ID || '',
    title: process.env.ANNOUNCEMENT_TITLE || '',
    body: process.env.ANNOUNCEMENT_BODY || '',
    emoji: process.env.ANNOUNCEMENT_EMOJI || '📢',
    buttonLabel: process.env.ANNOUNCEMENT_BUTTON_LABEL || '',
    buttonUrl: process.env.ANNOUNCEMENT_BUTTON_URL || '',
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
    },
  });
});
