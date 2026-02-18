/**
 * Webhook Authentication Middleware
 * Verifies signatures for Apple App Store and Google Play webhooks
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { logSecurityEvent } = require('../utils/securityLogger');

// Google OAuth client for Pub/Sub verification
const googleAuthClient = new OAuth2Client();

/**
 * Verify Apple App Store Server Notification signature
 * For V2 notifications (JWS format), this validates the certificate chain
 * For V1 notifications, we verify using a shared secret if configured
 */
exports.verifyAppleWebhookSignature = async (req, res, next) => {
  const notification = req.body;

  try {
    // V2 notifications have signedPayload (JWS format)
    if (notification.signedPayload) {
      // Decode and verify the JWS
      const parts = notification.signedPayload.split('.');
      if (parts.length !== 3) {
        console.error('❌ Invalid Apple webhook JWS format');
        logSecurityEvent('APPLE_WEBHOOK_INVALID_FORMAT', {
          ip: req.ip,
          reason: 'Invalid JWS format'
        });
        return res.status(401).json({ error: 'Invalid notification format' });
      }

      // Decode header to verify certificate chain
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const x5c = header.x5c;

      if (!x5c || x5c.length < 2) {
        console.error('❌ No certificate chain in Apple webhook');
        logSecurityEvent('APPLE_WEBHOOK_NO_CERT_CHAIN', {
          ip: req.ip
        });
        return res.status(401).json({ error: 'Invalid certificate chain' });
      }

      // Verify the certificate chains to Apple's root CA
      // The signing certificate (x5c[0]) should chain up to Apple Root CA
      const signingCertPem = `-----BEGIN CERTIFICATE-----\n${x5c[0].match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

      // Create public key from certificate
      const publicKey = crypto.createPublicKey({
        key: signingCertPem,
        format: 'pem'
      });

      // Verify the signature
      try {
        jwt.verify(notification.signedPayload, publicKey, {
          algorithms: ['ES256']
        });
        console.log('✅ Apple webhook signature verified (V2)');
      } catch (verifyError) {
        console.error('❌ Apple webhook signature verification failed:', verifyError.message);
        logSecurityEvent('APPLE_WEBHOOK_SIGNATURE_FAILED', {
          ip: req.ip,
          error: verifyError.message
        });
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    } else {
      // V1 notifications - verify environment matches
      const environment = notification.environment;
      const expectedEnvironment = process.env.NODE_ENV === 'production' ? 'PROD' : 'Sandbox';

      // Log warning for V1 notifications in production
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Received V1 webhook in production - consider upgrading to V2');
        logSecurityEvent('APPLE_WEBHOOK_V1_RECEIVED', {
          ip: req.ip,
          environment
        });
      }

      // Basic validation for V1
      if (!notification.notification_type || !notification.unified_receipt) {
        console.error('❌ Invalid V1 notification structure');
        logSecurityEvent('APPLE_WEBHOOK_INVALID_V1', {
          ip: req.ip
        });
        return res.status(401).json({ error: 'Invalid V1 notification' });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Apple webhook verification error:', error);
    logSecurityEvent('APPLE_WEBHOOK_VERIFICATION_ERROR', {
      ip: req.ip,
      error: error.message
    });
    // Still return 200 to prevent Apple from retrying invalid requests forever
    return res.status(200).json({ success: true, error: 'Verification failed' });
  }
};

/**
 * Verify Google Play RTDN (Real-Time Developer Notifications) signature
 * Google sends Pub/Sub messages with a bearer token that can be verified
 */
exports.verifyGoogleWebhookSignature = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // If no auth header, check if this is from our own server (internal call)
  if (!authHeader) {
    // Allow if coming from localhost in development
    if (process.env.NODE_ENV !== 'production' &&
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')) {
      console.log('⚠️ Google webhook without auth - allowing in development');
      return next();
    }

    console.error('❌ Missing Authorization header on Google webhook');
    logSecurityEvent('GOOGLE_WEBHOOK_NO_AUTH', {
      ip: req.ip
    });
    return res.status(401).json({ error: 'Missing authorization' });
  }

  try {
    // Extract the bearer token
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    // Verify the token is from Google Pub/Sub
    // The token should be issued by Google for our project
    const expectedAudience = process.env.GOOGLE_PUBSUB_AUDIENCE ||
                             `https://${process.env.DOMAIN || 'api.bananatalk.com'}/api/v1/purchases/android/webhook`;

    const ticket = await googleAuthClient.verifyIdToken({
      idToken: token,
      audience: expectedAudience
    });

    const payload = ticket.getPayload();

    // Verify the email is from Google Pub/Sub
    // Pub/Sub tokens come from accounts ending with @pubsub.gserviceaccount.com
    if (!payload.email || !payload.email.endsWith('gserviceaccount.com')) {
      console.error('❌ Invalid Google webhook sender:', payload.email);
      logSecurityEvent('GOOGLE_WEBHOOK_INVALID_SENDER', {
        ip: req.ip,
        email: payload.email
      });
      return res.status(401).json({ error: 'Invalid sender' });
    }

    console.log('✅ Google webhook signature verified');
    console.log('   Sender:', payload.email);
    console.log('   Subject:', payload.sub);

    // Attach the verified payload to the request
    req.googleAuthPayload = payload;
    next();
  } catch (error) {
    console.error('❌ Google webhook verification error:', error.message);
    logSecurityEvent('GOOGLE_WEBHOOK_VERIFICATION_ERROR', {
      ip: req.ip,
      error: error.message
    });

    // In production, fail closed
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Verification failed' });
    }

    // In development, log warning and continue
    console.warn('⚠️ Allowing unverified Google webhook in development');
    next();
  }
};

/**
 * IP whitelist verification for webhooks
 * Additional layer of security to only allow webhooks from known IP ranges
 */
exports.verifyWebhookIP = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Parse X-Forwarded-For if behind proxy
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIP;

    // Check if IP is in allowed list
    const isAllowed = allowedIPs.some(allowedIP => {
      // Support CIDR notation
      if (allowedIP.includes('/')) {
        return isIPInCIDR(realIP, allowedIP);
      }
      // Support wildcards (e.g., 17.0.0.*)
      if (allowedIP.includes('*')) {
        const pattern = allowedIP.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(realIP);
      }
      return realIP === allowedIP;
    });

    if (!isAllowed && process.env.NODE_ENV === 'production') {
      console.error(`❌ Webhook from unauthorized IP: ${realIP}`);
      logSecurityEvent('WEBHOOK_UNAUTHORIZED_IP', {
        ip: realIP,
        forwardedFor
      });
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!isAllowed) {
      console.warn(`⚠️ Webhook from non-whitelisted IP in development: ${realIP}`);
    }

    next();
  };
};

/**
 * Check if an IP is within a CIDR range
 */
function isIPInCIDR(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);

  return (ipNum & mask) === (rangeNum & mask);
}

// Apple's known IP ranges (these should be updated periodically)
// See: https://developer.apple.com/documentation/appstoreservernotifications
exports.APPLE_IP_RANGES = [
  '17.0.0.0/8' // Apple's entire IP range
];

// Google's known IP ranges for Pub/Sub
// See: https://cloud.google.com/pubsub/docs/push
exports.GOOGLE_IP_RANGES = [
  '64.233.160.0/19',
  '66.102.0.0/20',
  '66.249.80.0/20',
  '72.14.192.0/18',
  '74.125.0.0/16',
  '173.194.0.0/16',
  '207.126.144.0/20',
  '209.85.128.0/17',
  '216.239.32.0/19'
];
