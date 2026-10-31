import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Optional because messages can be room-based instead
  },
  room: {
    type: String,
    // Optional because messages can be 1-to-1 direct messages instead
    trim: true
  },
  encryptedContent: {
    type: String,
    default: null
  },
  iv: {
    type: String,
    default: null
  },
  authTag: {
    type: String,
    default: null
  },
  // Plaintext content kept optional for backwards compatibility / migration safety
  content: {
    type: String,
    trim: true,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  }
});

const Message = mongoose.model('Message', messageSchema);
export default Message;
