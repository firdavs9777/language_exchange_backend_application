const test = require('node:test');
const assert = require('node:assert/strict');

// These tests intentionally run with NO Mailgun env configured — sendEmail
// and emailService must be no-ops (never throw) in that state, and the
// template builders are pure/deterministic and can be asserted directly.

test('isConfigured() is false when MAILGUN_API_KEY/MAILGUN_DOMAIN are unset', () => {
  delete process.env.MAILGUN_API_KEY;
  delete process.env.MAILGUN_DOMAIN;
  const { isConfigured } = require('../utils/sendEmail');
  assert.equal(isConfigured(), false);
});

test('sendEmail() returns {skipped:true} and never throws when unconfigured', async () => {
  delete process.env.MAILGUN_API_KEY;
  delete process.env.MAILGUN_DOMAIN;
  const { sendEmail } = require('../utils/sendEmail');

  const result = await sendEmail({
    to: 'a@x.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi',
  });

  assert.equal(result.skipped, true);
});

test('emailTemplates.welcome({name}) includes the name in subject/html/text', () => {
  const templates = require('../utils/emailTemplates');
  const { subject, html, text } = templates.welcome({ name: 'Ann' });

  assert.ok(subject.includes('Ann'));
  assert.ok(html.includes('Ann'));
  assert.ok(text.includes('Ann'));
});

test('emailTemplates.passwordChanged({name}) includes the name in subject/html/text', () => {
  const templates = require('../utils/emailTemplates');
  const { subject, html, text } = templates.passwordChanged({ name: 'Ann' });

  assert.ok(subject.includes('Ann') || html.includes('Ann'));
  assert.ok(html.includes('Ann'));
  assert.ok(text.includes('Ann'));
});

test('emailService.sendWelcome() is skipped (unconfigured) for a user with an email, no throw', async () => {
  delete process.env.MAILGUN_API_KEY;
  delete process.env.MAILGUN_DOMAIN;
  const emailService = require('../services/emailService');

  const result = await emailService.sendWelcome({ email: 'a@x.com', name: 'Ann' });

  assert.equal(result.skipped, true);
});

test('emailService.sendWelcome() is skipped for a user with no email, no throw', async () => {
  const emailService = require('../services/emailService');

  const result = await emailService.sendWelcome({ name: 'Ann' });

  assert.equal(result.skipped, true);
});

test('emailService.sendPasswordChanged() is skipped (unconfigured) for a user with an email, no throw', async () => {
  delete process.env.MAILGUN_API_KEY;
  delete process.env.MAILGUN_DOMAIN;
  const emailService = require('../services/emailService');

  const result = await emailService.sendPasswordChanged({ email: 'a@x.com', name: 'Ann' });

  assert.equal(result.skipped, true);
});

test('emailService.sendPasswordChanged() is skipped for a user with no email, no throw', async () => {
  const emailService = require('../services/emailService');

  const result = await emailService.sendPasswordChanged({ name: 'Ann' });

  assert.equal(result.skipped, true);
});
