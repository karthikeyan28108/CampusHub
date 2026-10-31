import mongoose from 'mongoose';

const registrationOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  otpHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically expire after 10 minutes
  }
});

const RegistrationOtp = mongoose.model('RegistrationOtp', registrationOtpSchema);
export default RegistrationOtp;

