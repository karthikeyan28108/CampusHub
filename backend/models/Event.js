import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true // e.g. Technical, Cultural, Sports, Workshop
  },
  organizer: {
    type: String,
    required: true,
    trim: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  eventDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true // e.g. "10:00 AM"
  },
  endTime: {
    type: String,
    required: true // e.g. "04:00 PM"
  },
  registrationDeadline: {
    type: Date,
    required: true
  },
  maxParticipants: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  image: {
    type: String,
    default: ''
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  registrationFee: {
    type: Number,
    default: 0
  },
  rules: {
    type: String,
    trim: true
  },
  contactInformation: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Cancelled', 'Expired'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index to optimize active and date queries
eventSchema.index({ status: 1, eventDate: 1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
