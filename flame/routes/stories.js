const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/storyController');

const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId'),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard cap at multer layer
});

const router = express.Router();

// Static paths BEFORE the /:id param routes so they don't collide.
router.get('/feed', auth, asyncHandler(ctrl.getFeed));
router.get('/my', auth, asyncHandler(ctrl.getMine));

router.post('/', auth, upload.single('media'), asyncHandler(ctrl.create));

router.post('/:id/view', auth, validate.params(objectIdSchema), asyncHandler(ctrl.view));
router.delete('/:id', auth, validate.params(objectIdSchema), asyncHandler(ctrl.remove));

module.exports = router;
