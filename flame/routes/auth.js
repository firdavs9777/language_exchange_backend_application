const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const registerSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(8).max(128),
  name:       z.string().min(2).max(50),
  age:        z.number().int().min(18).max(100),
  gender:     z.enum(GENDERS),
  lookingFor: z.enum(GENDERS),
  bio:        z.string().max(500).optional(),
  interests:  z.array(z.string().min(1)).min(1).max(10),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const router = express.Router();

router.post('/register', validate.body(registerSchema), asyncHandler(ctrl.register));
router.post('/login',    validate.body(loginSchema),    asyncHandler(ctrl.login));
router.post('/refresh',  validate.body(refreshSchema),  asyncHandler(ctrl.refresh));
router.post('/logout',   auth,                          asyncHandler(ctrl.logout));

module.exports = router;
