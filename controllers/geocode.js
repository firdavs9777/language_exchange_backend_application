const asyncHandler = require('../middleware/async');

function mapNominatimResult(json) {
  if (!json || !json.address) return null;
  const a = json.address;
  const city = a.city || a.town || a.village || a.state || null;
  const country = a.country || null;
  const out = { city, country, formattedAddress: json.display_name || [city, country].filter(Boolean).join(', ') };
  if (json.lat != null && json.lon != null) out.coordinates = [parseFloat(json.lon), parseFloat(json.lat)];
  return out;
}

async function nominatim(path) {
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { 'User-Agent': 'BananaTalk/1.0 (support@banatalk.com)' },
  });
  if (!res.ok) return null;
  return res.json();
}

exports.reverse = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  const json = await nominatim(`reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
  return res.status(200).json({ success: true, data: mapNominatimResult(json) });
});

exports.forward = asyncHandler(async (req, res) => {
  const { city = '', country = '' } = req.query;
  const q = encodeURIComponent([city, country].filter(Boolean).join(', '));
  const arr = await nominatim(`search?format=jsonv2&addressdetails=1&limit=1&q=${q}`);
  const first = Array.isArray(arr) && arr.length ? arr[0] : null;
  return res.status(200).json({ success: true, data: mapNominatimResult(first) });
});

exports.mapNominatimResult = mapNominatimResult;
