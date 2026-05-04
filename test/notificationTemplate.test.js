const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../services/notificationTemplateService');

test('renders en template with vars', () => {
  const r = render('moment_like_single', 'en', { actorName: 'Alex' });
  assert.equal(r.title, '❤️ Alex');
  assert.equal(r.body, 'liked your moment');
});

test('falls back to en when locale missing', () => {
  const r = render('moment_like_single', 'xx', { actorName: 'Alex' });
  assert.equal(r.title, '❤️ Alex');
});

test('renders ko template', () => {
  const r = render('moment_like_single', 'ko', { actorName: '민수' });
  assert.match(r.body, /좋아합니다/);
});

test('handles missing var by leaving placeholder unfilled', () => {
  const r = render('moment_like_single', 'en', {});
  assert.equal(r.title, '❤️ {actorName}');
});

test('throws on unknown type', () => {
  assert.throws(() => render('not_a_type', 'en', {}));
});
