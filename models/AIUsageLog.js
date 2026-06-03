const mongoose = require('mongoose');

const AIUsageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  feature: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

AIUsageLogSchema.index({ feature: 1, timestamp: -1 });
AIUsageLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AIUsageLog', AIUsageLogSchema);
