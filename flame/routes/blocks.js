const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/blockController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const createSchema = z.object({ user_id: objectId });
const userIdParam = z.object({ userId: objectId });

router.get('/', auth, asyncHandler(ctrl.listBlocks));
router.post('/', auth, validate.body(createSchema), asyncHandler(ctrl.createBlock));
router.delete('/:userId', auth, validate.params(userIdParam), asyncHandler(ctrl.removeBlock));

module.exports = router;
