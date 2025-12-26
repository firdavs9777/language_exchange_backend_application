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
    enum: ['ringing', 'active', 'ended', 'missed', 'rejected'],
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
  endTime: Date,
  duration: Number 
}, {
  timestamps: true
});

callSchema.index({participants: 1, createdAt: -1});

module.exports = mongoose.model("Call", callSchema);