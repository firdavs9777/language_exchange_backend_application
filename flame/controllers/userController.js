const userService = require('../services/userService');

async function getMe(req, res) {
  const me = await userService.getMe(req.user.id);
  res.json({ success: true, data: me });
}

async function getById(req, res) {
  const u = await userService.getById(req.user.id, req.params.id);
  res.json({ success: true, data: u });
}

async function updateMe(req, res) {
  const me = await userService.updateMe(req.user.id, req.body);
  res.json({ success: true, data: me });
}

async function updatePreferences(req, res) {
  const b = req.body;
  const preferences = await userService.updatePreferences(req.user.id, {
    // snake_case in, camelCase out — the wire shape is fixed by the shipped app.
    minAge: b.min_age,
    maxAge: b.max_age,
    maxDistance: b.max_distance,
    showDistance: b.show_distance,
    showOnlineStatus: b.show_online_status,
    interestsFilter: b.interests_filter,
  });
  res.json({ success: true, data: { preferences } });
}

async function updateLocation(req, res) {
  const location = await userService.updateLocation(req.user.id, {
    latitude: req.body.latitude,
    longitude: req.body.longitude,
  });
  res.json({
    success: true,
    data: {
      // Flattened for the wire: the model nests coordinates under
      // `location.coordinates.{latitude,longitude}`, but the shipped app
      // reads them straight off `data.location`.
      location: {
        city: location.city,
        state: location.state,
        country: location.country,
        latitude: location.coordinates && location.coordinates.latitude,
        longitude: location.coordinates && location.coordinates.longitude,
      },
    },
  });
}

async function uploadPhoto(req, res) {
  const photo = await userService.uploadPhoto(req.user.id, req.file);
  res.status(201).json({ success: true, data: photo });
}

async function deletePhoto(req, res) {
  await userService.deletePhoto(req.user.id, req.params.photoId);
  res.json({ success: true });
}

module.exports = { getMe, getById, updateMe, updatePreferences, updateLocation, uploadPhoto, deletePhoto };
