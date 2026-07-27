// Pure email template builders. No I/O, deterministic — safe to unit test
// without any Mailgun configuration.

function welcome({ name }) {
  const displayName = name || 'there';
  const subject = `Welcome to Flame, ${displayName}!`;
  const html = `<p>Hi ${displayName},</p><p>Welcome to Flame! We're glad you're here.</p>`;
  const text = `Hi ${displayName},\n\nWelcome to Flame! We're glad you're here.`;
  return { subject, html, text };
}

function passwordChanged({ name }) {
  const displayName = name || 'there';
  const subject = 'Your Flame password was changed';
  const html = `<p>Hi ${displayName},</p><p>This is a confirmation that your Flame account password was just changed. If you didn't do this, please contact support immediately.</p>`;
  const text = `Hi ${displayName},\n\nThis is a confirmation that your Flame account password was just changed. If you didn't do this, please contact support immediately.`;
  return { subject, html, text };
}

module.exports = { welcome, passwordChanged };
