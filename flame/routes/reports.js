const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/reportController');
const { REASONS } = require('../models/Report');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const createSchema = z.object({
  user_id: objectId,
  reason: z.enum(REASONS),
  details: z.string().max(500).optional(),
});

router.post('/', auth, validate.body(createSchema), asyncHandler(ctrl.createReport));

module.exports = router;
