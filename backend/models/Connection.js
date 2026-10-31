import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  userA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'blocked'],
    default: 'pending',
    required: true
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  firstMessageSent: {
    type: Boolean,
    default: false
  },
  isExempt: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure pair is normalized so only one document exists per unordered user pair
connectionSchema.index({ userA: 1, userB: 1 }, { unique: true });

// Helper to normalize user pair ordering
export const normalizePair = (userId1, userId2) => {
  const str1 = userId1.toString();
  const str2 = userId2.toString();
  if (str1 < str2) {
    return { userA: userId1, userB: userId2 };
  }
  return { userA: userId2, userB: userId1 };
};

// Static helper to find a connection between any two users
connectionSchema.statics.findBetweenUsers = function (userId1, userId2) {
  const { userA, userB } = normalizePair(userId1, userId2);
  return this.findOne({ userA, userB });
};

const Connection = mongoose.model('Connection', connectionSchema);
export default Connection;
