const mongoose = require('mongoose');
const { getConn } = require('../db');

const GENDERS = ['male', 'female', 'non_binary', 'other'];

const photoSchema = new mongoose.Schema({
  id:        { type: String, required: true },
  url:       { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
  order:     { type: Number, default: 0 },
}, { _id: false });

const coordSchema = new mongoose.Schema({
  latitude:  { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  city:        { type: String, default: null },
  state:       { type: String, default: null },
  country:     { type: String, default: null },
  coordinates: { type: coordSchema, default: null },
}, { _id: false });

const geoPointSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  minAge:           { type: Number, default: 18 },
  maxAge:           { type: Number, default: 50 },
  maxDistance:      { type: Number, default: 50 },
  showDistance:     { type: Boolean, default: true },
  showOnlineStatus: { type: Boolean, default: true },
}, { _id: false });

const notificationSettingsSchema = new mongoose.Schema({
  newMatches:  { type: Boolean, default: true },
  newMessages: { type: Boolean, default: true },
  superLikes:  { type: Boolean, default: true },
  promotions:  { type: Boolean, default: false },
}, { _id: false });

const userSettingsSchema = new mongoose.Schema({
  notificationsEnabled: { type: Boolean, default: true },
  discoveryEnabled:     { type: Boolean, default: true },
  darkMode:             { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true, minlength: 2, maxlength: 50 },
  age:          { type: Number, required: true, min: 18, max: 100 },
  gender:       { type: String, enum: GENDERS, required: true },
  lookingFor:   { type: String, enum: GENDERS, required: true },
  bio:          { type: String, maxlength: 500, default: null },
  interests:    { type: [String], default: [], validate: v => v.length <= 10 },
  photos:       { type: [photoSchema], default: [] },
  location:     { type: locationSchema, default: null },
  locationGeo:  { type: geoPointSchema, default: null },

  isOnline:    { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
  lastActive:  { type: Date, default: Date.now },

  preferences:          { type: preferencesSchema, default: () => ({}) },
  notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
  settings:             { type: userSettingsSchema, default: () => ({}) },

  // Auth-related
  verificationCode:         { type: String, default: null },
  verificationCodeExpires:  { type: Date, default: null },
  verificationAttempts:     { type: Number, default: 0 },
  passwordResetToken:       { type: String, default: null },
  passwordResetTokenExpires:{ type: Date, default: null },

  // Super like quota
  superLikesRemaining: { type: Number, default: 3 },
  superLikesDay:       { type: String, default: null }, // YYYY-MM-DD UTC

  // Premium
  isPremium:        { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },

  // Social auth
  googleId:   { type: String, default: null, sparse: true },
  appleId:    { type: String, default: null, sparse: true },
  facebookId: { type: String, default: null, sparse: true },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  collection: 'users',
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ appleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ isDeleted: 1 });
userSchema.index({ locationGeo: '2dsphere' });

module.exports = getConn().model('User', userSchema);
