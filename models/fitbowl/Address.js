const mongoose = require('mongoose');

const FitBowlAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser',
    required: true
  },
  label: {
    type: String,
    default: 'Home',
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Please add an address'],
    trim: true
  },
  apartment: {
    type: String,
    trim: true
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  instructions: {
    type: String,
    maxlength: 500
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'fitbowl_addresses'
});

// Index
FitBowlAddressSchema.index({ user: 1 });

module.exports = mongoose.model('FitBowlAddress', FitBowlAddressSchema);
