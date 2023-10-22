const express = require('express');
const Moment = require('../models/Moment');
const {
  getMoments,
  getMoment,
  createMoment,
  updateMoment,
  deleteMoment
} = require('../controllers/moments');
const advancedResults = require('../middleware/advancedResults');

const router = express.Router();
// const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(advancedResults(Moment, ''), getMoments)
  .post(createMoment);
router.route('/:id').get(getMoment).put(updateMoment).delete(deleteMoment);
module.exports = router;
