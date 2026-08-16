const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/matchController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const idParam = z.object({ id: objectId });

router.get('/', auth, asyncHandler(ctrl.listMatches));
router.delete('/:id', auth, validate.params(idParam), asyncHandler(ctrl.deleteMatch));

module.exports = router;
