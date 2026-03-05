const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  ],
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['ringing', 'active', 'ended', 'missed', 'rejected', 'failed', 'busy'],
    default: 'ringing'
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  answeredAt: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  endReason: {
    type: String,
    enum: ['completed', 'caller_ended', 'receiver_ended', 'missed', 'rejected', 'failed', 'busy', 'timeout', 'disconnect'],
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
callSchema.index({ participants: 1, createdAt: -1 });
callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ status: 1 });
callSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Call', callSchema);
