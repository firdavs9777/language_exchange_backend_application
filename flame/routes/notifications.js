const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/notificationController');

const router = express.Router();

const deviceIdParam = z.object({ deviceId: z.string().min(1) });
const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().min(1),
});
const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  chatMessages: z.boolean().optional(),
  matches: z.boolean().optional(),
});

router.post('/register-token', auth, validate.body(registerSchema), asyncHandler(ctrl.registerToken));
router.delete('/remove-token/:deviceId', auth, validate.params(deviceIdParam), asyncHandler(ctrl.removeToken));
router.get('/settings', auth, asyncHandler(ctrl.getSettings));
router.put('/settings', auth, validate.body(settingsSchema), asyncHandler(ctrl.updateSettings));

module.exports = router;
