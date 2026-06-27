const mongoose = require('mongoose');

const ExamLanguageSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 5,
  },
  icon: String, // emoji flag or asset URL
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

ExamLanguageSchema.index({ code: 1 });
ExamLanguageSchema.index({ active: 1 });

module.exports = mongoose.model('ExamLanguage', ExamLanguageSchema);
