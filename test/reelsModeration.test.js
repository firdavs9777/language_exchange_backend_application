const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldAutoHide } = require('../lib/reelsFeed');

// ---------------------------------------------------------------------------
// shouldAutoHide — pure threshold decision for the reels auto-hide rule
// (spec C1): >= 2 DISTINCT reporters. Distinct-reporter dedup is a separate
// concern, already free via the Report model's unique
// {reportedBy, type, reportId} index (models/Report.js:147) — this function
// only owns the count-based threshold.
// ---------------------------------------------------------------------------

test('shouldAutoHide: false for 0 reports', () => {
  assert.equal(shouldAutoHide(0), false);
});

test('shouldAutoHide: false for exactly 1 report (must not hide on a single reporter)', () => {
  assert.equal(shouldAutoHide(1), false);
});

test('shouldAutoHide: true at exactly the threshold of 2 reports', () => {
  assert.equal(shouldAutoHide(2), true);
});

test('shouldAutoHide: true above the threshold (does not un-hide/re-check past 2)', () => {
  assert.equal(shouldAutoHide(3), true);
  assert.equal(shouldAutoHide(10), true);
});

test('shouldAutoHide: false for non-numeric input (defensive)', () => {
  assert.equal(shouldAutoHide(undefined), false);
  assert.equal(shouldAutoHide(null), false);
  assert.equal(shouldAutoHide('2'), false);
});

// ---------------------------------------------------------------------------
// controllers/report.js createReport — auto-hide wiring, using a stubbed
// Report/Moment model (require.cache substitution) since the DB isn't
// available in this unit-test sandbox. Mirrors the mock req/res pattern
// used across test/rooms.*.test.js.
//
// These tests exercise the DECISION path (does createReport call
// Moment.updateOne with hiddenPendingReview:true at the right count?) by
// stubbing the two models createReport requires at module scope.
// ---------------------------------------------------------------------------

function loadCreateReportWithStubs({ existingReportCount, momentIsReel }) {
  const reportModelPath = require.resolve('../models/Report');
  const momentModelPath = require.resolve('../models/Moment');
  const controllerPath = require.resolve('../controllers/report');

  // Clear any cached copies so our stubs are picked up fresh.
  delete require.cache[controllerPath];

  const updateOneCalls = [];

  const StubReport = {
    hasUserReported: async () => false,
    findOne: async () => null,
    create: async (doc) => ({ _id: 'report1', ...doc }),
    countDocuments: async () => existingReportCount,
  };

  const StubMoment = {
    findById: () => ({
      select: async () => (momentIsReel === null ? null : { isReel: momentIsReel }),
    }),
    updateOne: async (filter, update) => {
      updateOneCalls.push({ filter, update });
      return { acknowledged: true };
    },
  };

  // Install stubs into the require cache under their resolved paths so
  // controllers/report.js's `require('../models/Report')` /
  // `require('../models/Moment')` resolve to these stand-ins instead of
  // loading real Mongoose models (which need a live DB connection).
  require.cache[reportModelPath] = { id: reportModelPath, filename: reportModelPath, loaded: true, exports: StubReport };
  require.cache[momentModelPath] = { id: momentModelPath, filename: momentModelPath, loaded: true, exports: StubMoment };

  const controller = require('../controllers/report');

  return { controller, updateOneCalls };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return res;
}

function cleanupStubs() {
  delete require.cache[require.resolve('../models/Report')];
  delete require.cache[require.resolve('../models/Moment')];
  delete require.cache[require.resolve('../controllers/report')];
}

test('createReport: auto-hides a reel moment once the distinct-report count reaches 2', async () => {
  const { controller, updateOneCalls } = loadCreateReportWithStubs({ existingReportCount: 2, momentIsReel: true });
  try {
    const req = {
      body: { type: 'moment', reportId: 'm1', reportedUser: 'u2', reason: 'spam' },
      user: { id: 'u1' }
    };
    const res = mockRes();
    await controller.createReport(req, res, (err) => { if (err) throw err; });

    assert.equal(updateOneCalls.length, 1);
    assert.deepEqual(updateOneCalls[0].filter, { _id: 'm1' });
    assert.deepEqual(updateOneCalls[0].update, { $set: { hiddenPendingReview: true } });
  } finally {
    cleanupStubs();
  }
});

test('createReport: does NOT auto-hide a reel moment on only 1 report', async () => {
  const { controller, updateOneCalls } = loadCreateReportWithStubs({ existingReportCount: 1, momentIsReel: true });
  try {
    const req = {
      body: { type: 'moment', reportId: 'm1', reportedUser: 'u2', reason: 'spam' },
      user: { id: 'u1' }
    };
    const res = mockRes();
    await controller.createReport(req, res, (err) => { if (err) throw err; });

    assert.equal(updateOneCalls.length, 0);
  } finally {
    cleanupStubs();
  }
});

test('createReport: does not touch hiddenPendingReview for a non-reel moment report, even at count 2', async () => {
  const { controller, updateOneCalls } = loadCreateReportWithStubs({ existingReportCount: 2, momentIsReel: false });
  try {
    const req = {
      body: { type: 'moment', reportId: 'm1', reportedUser: 'u2', reason: 'spam' },
      user: { id: 'u1' }
    };
    const res = mockRes();
    await controller.createReport(req, res, (err) => { if (err) throw err; });

    assert.equal(updateOneCalls.length, 0);
  } finally {
    cleanupStubs();
  }
});

test('createReport: does not touch hiddenPendingReview for a non-moment report type (e.g. user/comment)', async () => {
  const { controller, updateOneCalls } = loadCreateReportWithStubs({ existingReportCount: 5, momentIsReel: true });
  try {
    const req = {
      body: { type: 'user', reportId: 'u3', reportedUser: 'u3', reason: 'spam' },
      user: { id: 'u1' }
    };
    const res = mockRes();
    await controller.createReport(req, res, (err) => { if (err) throw err; });

    assert.equal(updateOneCalls.length, 0);
  } finally {
    cleanupStubs();
  }
});

// ---------------------------------------------------------------------------
// restoreReport — admin restore action
// ---------------------------------------------------------------------------

function loadRestoreReportWithStubs({ reportType = 'moment', resolveCalls, updateOneCalls }) {
  const reportModelPath = require.resolve('../models/Report');
  const momentModelPath = require.resolve('../models/Moment');
  const controllerPath = require.resolve('../controllers/report');
  delete require.cache[controllerPath];

  const reportDoc = {
    _id: 'report1',
    type: reportType,
    reportId: 'm1',
    resolve: async function (moderatorId, action, notes) {
      resolveCalls.push({ moderatorId, action, notes });
      this.status = 'resolved';
      this.moderatorAction = action;
    }
  };

  const StubReport = {
    findById: async () => reportDoc,
  };

  const StubMoment = {
    updateOne: async (filter, update) => {
      updateOneCalls.push({ filter, update });
      return { acknowledged: true };
    },
  };

  require.cache[reportModelPath] = { id: reportModelPath, filename: reportModelPath, loaded: true, exports: StubReport };
  require.cache[momentModelPath] = { id: momentModelPath, filename: momentModelPath, loaded: true, exports: StubMoment };

  const controller = require('../controllers/report');
  return { controller, reportDoc };
}

test('restoreReport: clears hiddenPendingReview and resolves the report as no_violation', async () => {
  const resolveCalls = [];
  const updateOneCalls = [];
  const { controller } = loadRestoreReportWithStubs({ resolveCalls, updateOneCalls });
  try {
    const req = { params: { id: 'report1' }, body: {}, user: { id: 'admin1' } };
    const res = mockRes();
    await controller.restoreReport(req, res, (err) => { if (err) throw err; });

    assert.equal(updateOneCalls.length, 1);
    assert.deepEqual(updateOneCalls[0].filter, { _id: 'm1' });
    assert.deepEqual(updateOneCalls[0].update, { $set: { hiddenPendingReview: false } });

    assert.equal(resolveCalls.length, 1);
    assert.equal(resolveCalls[0].moderatorId, 'admin1');
    assert.equal(resolveCalls[0].action, 'no_violation');

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    cleanupStubs();
  }
});
