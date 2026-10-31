import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
    default: 'student'
  },
  registerNumber: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true,
    default: 'General'
  },
  year: {
    type: Number
  },
  semester: {
    type: Number
  },
  cgpa: {
    type: Number,
    default: 0
  },
  section: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  resetOTP: {
    type: String,
    default: null
  },
  resetOTPExpires: {
    type: Date,
    default: null
  },
  resetOTPAttempts: {
    type: Number,
    default: 0
  },
  resetOTPVerified: {
    type: Boolean,
    default: false
  },
  forgotPasswordAttempts: {
    type: Number,
    default: 0
  },
  forgotPasswordWindowStart: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Pre-save hook to hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
