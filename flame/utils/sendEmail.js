const formData = require('form-data');
const Mailgun = require('mailgun.js');
const logger = require('./logger');

// Guarded email primitive: NEVER throws. Every call is a no-op (returns
// { skipped: true }) whenever Mailgun isn't configured for flame — which is
// the case in dev/CI until MAILGUN_API_KEY + MAILGUN_DOMAIN are provided.

function isConfigured() {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

function _buildClient() {
  const mailgun = new Mailgun(formData);
  const apiUrl = process.env.MAILGUN_REGION === 'eu'
    ? 'https://api.eu.mailgun.net'
    : 'https://api.mailgun.net';
  return mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: apiUrl,
  });
}

async function sendEmail({
  to, subject, html, text,
}) {
  if (!isConfigured()) {
    logger.info('email not configured, skipping', { to, subject });
    return { skipped: true };
  }

  try {
    const mg = _buildClient();
    const from = `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`;
    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from,
      to,
      subject,
      html,
      text,
    });
    return { sent: true, id: response && response.id };
  } catch (err) {
    logger.error('email send failed', err);
    return { sent: false, error: err.message };
  }
}

module.exports = { isConfigured, sendEmail };
