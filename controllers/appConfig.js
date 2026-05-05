const asyncHandler = require('../middleware/async');

const DEFAULT_IOS_URL =
  'https://apps.apple.com/us/app/bananatalk-learn-meet-or-date/id6755862146';
const DEFAULT_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.bananatalk.app';

exports.getAppConfig = asyncHandler(async (req, res) => {
  const minVersion = process.env.APP_MIN_VERSION || '1.3.0';
  const latestVersion = process.env.APP_LATEST_VERSION || '1.3.8';
  const forceUpdate = process.env.APP_FORCE_UPDATE === 'true';
  const iosUrl = process.env.APP_IOS_URL || DEFAULT_IOS_URL;
  const androidUrl = process.env.APP_ANDROID_URL || DEFAULT_ANDROID_URL;
  const releaseNotes = process.env.APP_RELEASE_NOTES || '';

  res.status(200).json({
    success: true,
    data: {
      minVersion,
      latestVersion,
      forceUpdate,
      iosUrl,
      androidUrl,
      releaseNotes,
    },
  });
});
