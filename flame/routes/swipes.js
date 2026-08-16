const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/swipeController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const targetSchema = z.object({ user_id: objectId });

router.post('/like', auth, validate.body(targetSchema), asyncHandler(ctrl.like));
router.post('/pass', auth, validate.body(targetSchema), asyncHandler(ctrl.pass));
router.post('/super-like', auth, validate.body(targetSchema), asyncHandler(ctrl.superLike));
router.post('/undo', auth, asyncHandler(ctrl.undo));

module.exports = router;
