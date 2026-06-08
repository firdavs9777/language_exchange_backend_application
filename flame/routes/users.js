const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId'),
});

const updateSchema = z.object({
  name:       z.string().min(2).max(50).optional(),
  age:        z.number().int().min(18).max(100).optional(),
  bio:        z.string().max(500).optional(),
  interests:  z.array(z.string().min(1)).min(1).max(10).optional(),
  gender:     z.enum(GENDERS).optional(),
  lookingFor: z.enum(GENDERS).optional(),
  // Other fields (preferences/settings/location) intentionally not exposed
  // in PATCH /users/me yet — they get dedicated routes in Plan 2.
  // NOTE: NOT .strict() — unknown keys are silently stripped so callers can pass
  // immutable fields (email, passwordHash) without 422; userService.updateMe
  // applies a MUTABLE_FIELDS allowlist regardless. Test:
  // "PATCH /users/me → 200 updates allowed fields, ignores rest".
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB hard cap at multer layer
});

const router = express.Router();

router.get('/me',   auth, asyncHandler(ctrl.getMe));
router.patch('/me', auth, validate.body(updateSchema), asyncHandler(ctrl.updateMe));

// /me/photos routes MUST be mounted BEFORE /:id so they don't collide with the
// ObjectId param matcher.
router.post('/me/photos',
  auth,
  upload.single('photo'),
  asyncHandler(ctrl.uploadPhoto),
);

router.delete('/me/photos/:photoId',
  auth,
  asyncHandler(ctrl.deletePhoto),
);

router.get('/:id',  auth, validate.params(objectIdSchema), asyncHandler(ctrl.getById));

module.exports = router;
