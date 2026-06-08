const mongoose = require('mongoose');

const BannedIdentitySchema = new mongoose.Schema(
  {
    email:          { type: String, index: true, sparse: true },
    googleId:       { type: String, index: true, sparse: true },
    facebookId:     { type: String, index: true, sparse: true },
    appleId:        { type: String, index: true, sparse: true },
    reason:         { type: String, default: null },
    bannedAt:       { type: Date, default: null },
    deletedAt:      { type: Date, default: null },
    moderatorId:    { type: String, default: null },
    originalUserId: { type: String, default: null },
  },
  { timestamps: false }
);

BannedIdentitySchema.pre('validate', function (next) {
  if (!this.email && !this.googleId && !this.facebookId && !this.appleId) {
    return next(new Error('At least one identity field is required'));
  }
  next();
});

module.exports = mongoose.model('BannedIdentity', BannedIdentitySchema);
