const express = require('express');
const {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefault
} = require('../../controllers/fitbowl/addresses');

const router = express.Router();
const { protect } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  createAddressValidation,
  updateAddressValidation
} = require('../../validators/fitbowl/addresses');

router.use(protect);

router
  .route('/')
  .get(getAddresses)
  .post(createAddressValidation, validate, createAddress);

router
  .route('/:id')
  .put(updateAddressValidation, validate, updateAddress)
  .delete(deleteAddress);

router
  .route('/:id/default')
  .put(setDefault);

module.exports = router;
