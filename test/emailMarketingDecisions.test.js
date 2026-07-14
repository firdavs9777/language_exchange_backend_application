const { test } = require('node:test');
const assert = require('node:assert/strict');

const { shouldSkipCampaign } = require('../jobs/promotionalEmailJob');
const { isWeekEmpty } = require('../jobs/weeklyDigestJob');

// ===================== promotionalEmailJob: campaign dedup =====================

test('shouldSkipCampaign: user with no promoCampaignsSent history is not skipped', () => {
  assert.equal(shouldSkipCampaign([], 'campaign-a'), false);
  assert.equal(shouldSkipCampaign(undefined, 'campaign-a'), false);
  assert.equal(shouldSkipCampaign(null, 'campaign-a'), false);
});

test('shouldSkipCampaign: user who already received this campaignId is skipped', () => {
  assert.equal(shouldSkipCampaign(['campaign-a'], 'campaign-a'), true);
  assert.equal(shouldSkipCampaign(['campaign-a', 'campaign-b'], 'campaign-a'), true);
});

test('shouldSkipCampaign: user who received a different campaignId is NOT skipped (new campaign re-enables sends)', () => {
  assert.equal(shouldSkipCampaign(['campaign-a'], 'campaign-b'), false);
});

// ===================== weeklyDigestJob: empty-week skip =====================

test('isWeekEmpty: all-zero stats is empty (should skip send)', () => {
  assert.equal(isWeekEmpty({ wordsReviewed: 0, wordsSaved: 0, messagesSent: 0, correctionsExchanged: 0 }), true);
  assert.equal(isWeekEmpty({}), true);
});

test('isWeekEmpty: any single non-zero field means NOT empty (should send)', () => {
  assert.equal(isWeekEmpty({ wordsReviewed: 1, wordsSaved: 0, messagesSent: 0, correctionsExchanged: 0 }), false);
  assert.equal(isWeekEmpty({ wordsReviewed: 0, wordsSaved: 1, messagesSent: 0, correctionsExchanged: 0 }), false);
  assert.equal(isWeekEmpty({ wordsReviewed: 0, wordsSaved: 0, messagesSent: 1, correctionsExchanged: 0 }), false);
  assert.equal(isWeekEmpty({ wordsReviewed: 0, wordsSaved: 0, messagesSent: 0, correctionsExchanged: 1 }), false);
});
