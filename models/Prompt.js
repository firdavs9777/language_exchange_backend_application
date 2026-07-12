// models/Prompt.js
const mongoose = require('mongoose');
const ISO6391 = require('iso-639-1');

const PromptSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please add prompt text'],
    trim: true,
    maxlength: [300, 'Prompt text can not be more than 300 characters'],
    unique: true
  },
  // ISO 639-1 code for the language learners should WRITE their moment in.
  language: {
    type: String,
    required: [true, 'Please add a language code'],
    validate: {
      validator: function(v) {
        return ISO6391.validate(v);
      },
      message: 'Invalid language code. Must be a valid ISO639-1 code.'
    },
    default: 'en'
  },
  level: {
    type: String,
    enum: ['any', 'beginner'],
    default: 'any'
  },
  emoji: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Support fast lookup of active prompts per language for daily rotation.
PromptSchema.index({ language: 1, active: 1 });

module.exports = mongoose.model('Prompt', PromptSchema);
