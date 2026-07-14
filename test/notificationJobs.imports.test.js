const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jobs = require('../jobs/notificationJobs');

test('notificationJobs exports sendSubscriptionReminders as a function', () => {
  assert.equal(typeof jobs.sendSubscriptionReminders, 'function');
});

test('notificationJobs.js imports the full notificationService module (not just a destructured helper)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../jobs/notificationJobs.js'),
    'utf8'
  );

  // The bug was: `const { shouldNotify } = require('../services/notificationService');`
  // which leaves `notificationService` undefined when `:197` calls `notificationService.send(...)`.
  // Assert a full-module import exists (capturing the whole export object into a
  // `notificationService` binding), in addition to any destructure.
  assert.match(
    source,
    /const\s+notificationService\s*=\s*require\(['"]\.\.\/services\/notificationService['"]\)/,
    'expected a full-module require into a `notificationService` binding'
  );
});

test('notificationJobs.js still destructures shouldNotify for the reengagement path', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../jobs/notificationJobs.js'),
    'utf8'
  );
  assert.match(source, /shouldNotify/);
});
