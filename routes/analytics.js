const express = require('express');
const router = express.Router();
const WebVisit = require('../models/WebVisit');
const asyncHandler = require('../middleware/async');

/**
 * Parse user agent string into device, browser, OS
 */
const parseUserAgent = (ua) => {
  if (!ua) return { device: 'unknown', browser: 'Unknown', os: 'Unknown' };

  // Device
  let device = 'desktop';
  if (/tablet|ipad/i.test(ua)) device = 'tablet';
  else if (/mobile|android|iphone|ipod/i.test(ua)) device = 'mobile';

  // Browser
  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  // OS
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return { device, browser, os };
};

/**
 * @desc    Record a web visit
 * @route   POST /api/v1/analytics/visit
 * @access  Public
 */
router.post('/visit', asyncHandler(async (req, res) => {
  const { page, referrer, language } = req.body;

  // Get IP from proxy headers or connection
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection.remoteAddress
    || 'unknown';

  const ua = req.headers['user-agent'] || '';
  const { device, browser, os } = parseUserAgent(ua);

  // Check if this IP has visited before
  const existingVisit = await WebVisit.findOne({ ip }).lean();
  const isNewVisitor = !existingVisit;

  // Geo lookup using ip-api.com (free, no key needed, 45 req/min)
  let geo = {};
  if (ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
    try {
      const https = require('http');
      geo = await new Promise((resolve) => {
        const request = https.get(`http://ip-api.com/json/${ip}?fields=country,city,regionName,timezone,lat,lon`, (response) => {
          let data = '';
          response.on('data', (chunk) => { data += chunk; });
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.status === 'success' ? parsed : {});
            } catch {
              resolve({});
            }
          });
        });
        request.on('error', () => resolve({}));
        request.setTimeout(3000, () => { request.destroy(); resolve({}); });
      });
    } catch {
      geo = {};
    }
  }

  await WebVisit.create({
    ip,
    country: geo.country || null,
    city: geo.city || null,
    region: geo.regionName || null,
    timezone: geo.timezone || null,
    latitude: geo.lat || null,
    longitude: geo.lon || null,
    page: page || '/',
    referrer: referrer || null,
    userAgent: ua.substring(0, 500),
    device,
    browser,
    os,
    language: language || null,
    isNewVisitor
  });

  res.status(200).json({ success: true });
}));

module.exports = router;
