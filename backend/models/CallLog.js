import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // empty for group calls
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat', // references the group chat if it is a group call
    },
    type: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['missed', 'completed', 'rejected', 'busy', 'ongoing'],
      required: true,
    },
    duration: {
      type: Number,
      default: 0, // in seconds
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const CallLog = mongoose.model('CallLog', callLogSchema);
export default CallLog;
