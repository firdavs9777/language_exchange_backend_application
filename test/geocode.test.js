const test = require('node:test');
const assert = require('node:assert/strict');
const { mapNominatimResult } = require('../controllers/geocode');

test('maps a nominatim reverse result to our location shape', () => {
  const json = { address: { city: 'Seoul', country: 'South Korea' }, display_name: 'Seoul, South Korea', lat: '37.5', lon: '127.0' };
  assert.deepEqual(mapNominatimResult(json), {
    city: 'Seoul', country: 'South Korea', formattedAddress: 'Seoul, South Korea', coordinates: [127.0, 37.5],
  });
});
test('falls back through town/village for city, tolerates missing coords', () => {
  const json = { address: { village: 'Xanadu', country: 'Nowhere' }, display_name: 'Xanadu' };
  const out = mapNominatimResult(json);
  assert.equal(out.city, 'Xanadu');
  assert.equal(out.coordinates, undefined);
});
test('returns null for empty result', () => {
  assert.equal(mapNominatimResult(null), null);
});
