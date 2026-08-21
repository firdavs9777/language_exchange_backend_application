// The canonical interest vocabulary.
//
// These tokens are what `user.interests` stores and what the discovery filter's
// $in matches. They are deliberately English and deliberately stable: the app
// localises the LABEL for each token and never the token itself, so translating
// the UI cannot break a filter.
//
// The list is the UNION of two lists that had already drifted apart in the app —
// the registration step offered 18 tokens and the filter sheet 16, overlapping
// only partly. 'Hiking' existed in the filter alone, so nobody could hold it and
// filtering on it always returned nobody.
//
// Ordered by the registration step, because that is the list that produced every
// stored value. The app holds the same tokens in
// lib/core/interests/interest_catalogue.dart, and a test in each repo asserts its
// own list matches the other's — two hardcoded lists that silently diverge is how
// this surface got here.
const INTEREST_TOKENS = Object.freeze([
  'Travel', 'Music', 'Movies', 'Food', 'Fitness', 'Reading', 'Gaming', 'Art',
  'Photography', 'Sports', 'Cooking', 'Nature', 'Coffee', 'Wine', 'Dancing',
  'Yoga', 'Pets', 'Tech', 'Hiking',
]);

const MAX_INTEREST_FILTER = 10;

module.exports = { INTEREST_TOKENS, MAX_INTEREST_FILTER };
