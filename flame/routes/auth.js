const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');
const social = require('../controllers/socialAuthController');

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
  latitude:   z.number().min(-90).max(90).optional(),
  longitude:  z.number().min(-180).max(180).optional(),
  photos:     z.array(z.string().url()).max(9).optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const googleSchema   = z.object({ id_token: z.string().min(1), device_token: z.string().optional() });
const appleSchema    = z.object({ id_token: z.string().min(1), authorization_code: z.string().optional(), device_token: z.string().optional() });
const facebookSchema = z.object({ access_token: z.string().min(1), device_token: z.string().optional() });
const checkEmailSchema = z.object({ email: z.string().email() });

const router = express.Router();

router.post('/register', validate.body(registerSchema), asyncHandler(ctrl.register));
router.post('/login',    validate.body(loginSchema),    asyncHandler(ctrl.login));
router.post('/refresh',  validate.body(refreshSchema),  asyncHandler(ctrl.refresh));
router.post('/logout',   auth,                          asyncHandler(ctrl.logout));

router.post('/google',      validate.body(googleSchema),     asyncHandler(social.google));
router.post('/apple',       validate.body(appleSchema),      asyncHandler(social.apple));
router.post('/facebook',    validate.body(facebookSchema),   asyncHandler(social.facebook));
router.post('/check-email', validate.body(checkEmailSchema), asyncHandler(social.checkEmail));

module.exports = router;
