const express = require('express');
const rateLimit = require('express-rate-limit');
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

// Accepts either casing. The shipped app's ApiClient._doRefresh sends
// refresh_token; this schema required refreshToken, so every real refresh was
// 422'd before reaching the service — and the app reads a non-200 refresh as
// auth-lost, clears its tokens and drops the user on the welcome screen.
//
// Taking both here repairs every already-installed client with a deploy,
// without waiting on an app release.
const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
    refresh_token: z.string().min(1).optional(),
  })
  .refine((b) => b.refreshToken || b.refresh_token, {
    message: 'refreshToken is required',
  });

const googleSchema   = z.object({ id_token: z.string().min(1), device_token: z.string().optional() });
const appleSchema    = z.object({ id_token: z.string().min(1), authorization_code: z.string().optional(), device_token: z.string().optional() });
const facebookSchema = z.object({ access_token: z.string().min(1), device_token: z.string().optional() });
const checkEmailSchema = z.object({ email: z.string().email() });


// ---------------------------------------------------------------------------
// Rate limiting
//
// These routes had none, so /auth/login answered guesses as fast as the network
// allowed. server.js applies its generalLimiter to /api/v1 only, and the flame
// router is mounted separately at /flamebackend/v1 — so nothing upstream was
// covering this.
//
// `app.set('trust proxy', 1)` in server.js means req.ip is the client address
// from X-Forwarded-For rather than the proxy's, so per-address keys are
// meaningful here.
//
// The store is in-memory, so budgets are per process. That is the same property
// the existing flame limiters have; it weakens the ceiling across a horizontal
// scale-out without invalidating it, and moving all of them to a shared store is
// its own change.
// ---------------------------------------------------------------------------

const limited = (message) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

// Guesses against ONE account from ONE address.
//
// Keyed on address *and* email rather than address alone: mobile users share
// carrier NAT addresses, so an address-only budget lets one attacker — or one
// person who forgot their password — lock out everybody on that network.
//
// skipSuccessfulRequests because brute force is made of failures. Without it, a
// shared or heavily-used device spends its allowance logging in correctly and
// then cannot log in at all.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    return `flameauth:${req.ip}:${email}`;
  },
  message: limited('Too many sign-in attempts. Please try again later.'),
});

// The ceiling the per-account budget cannot provide: an attacker rotating
// through emails gets a fresh credentialLimiter key every time, so this bounds
// total credential traffic from one address. Also the only guard on the social
// routes, which carry a provider token and no email to key on.
const authAddressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `flameauthip:${req.ip}`,
  message: limited('Too many sign-in attempts. Please try again later.'),
});

// Account-creation spam. Successes count here — unlike a login, a *successful*
// registration is the thing being abused.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `flamesignup:${req.ip}`,
  message: limited('Too many accounts created. Please try again later.'),
});

// check-email answers "does this account exist", which is an enumeration oracle:
// left open it walks the user base at whatever rate the network allows. Tighter
// than signup because a legitimate client calls it once per registration.
const emailCheckLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `flameemailcheck:${req.ip}`,
  message: limited('Too many lookups. Please try again later.'),
});

// Deliberately generous. Access tokens live 15 minutes, so a long session
// refreshes often and legitimately; this exists only to bound absurd volume.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `flamerefresh:${req.ip}`,
  message: limited('Too many refresh attempts. Please try again later.'),
});

const router = express.Router();

// Limiters run before validation so a flood of malformed bodies is cheap too.
router.post('/register', signupLimiter, validate.body(registerSchema), asyncHandler(ctrl.register));
router.post('/login',    authAddressLimiter, credentialLimiter, validate.body(loginSchema), asyncHandler(ctrl.login));
router.post('/refresh',  refreshLimiter, validate.body(refreshSchema), asyncHandler(ctrl.refresh));
// /logout requires a valid token, so there is nothing here to guess at.
router.post('/logout',   auth,                          asyncHandler(ctrl.logout));

router.post('/google',      authAddressLimiter, validate.body(googleSchema),     asyncHandler(social.google));
router.post('/apple',       authAddressLimiter, validate.body(appleSchema),      asyncHandler(social.apple));
router.post('/facebook',    authAddressLimiter, validate.body(facebookSchema),   asyncHandler(social.facebook));
router.post('/check-email', emailCheckLimiter, validate.body(checkEmailSchema), asyncHandler(social.checkEmail));

module.exports = router;
