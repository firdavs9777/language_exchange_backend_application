const { sendEmail } = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');

// Guarded email service: NEVER throws. Skips (returns { skipped: true })
// when the user has no email, or when sendEmail itself is unconfigured.

async function sendWelcome(user) {
  if (!user || !user.email) return { skipped: true };
  const { subject, html, text } = templates.welcome({ name: user.name });
  return sendEmail({
    to: user.email, subject, html, text,
  });
}

async function sendPasswordChanged(user) {
  if (!user || !user.email) return { skipped: true };
  const { subject, html, text } = templates.passwordChanged({ name: user.name });
  return sendEmail({
    to: user.email, subject, html, text,
  });
}

module.exports = { sendWelcome, sendPasswordChanged };
