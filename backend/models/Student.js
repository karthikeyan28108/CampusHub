import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  rollNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  fullName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Student = mongoose.model('Student', studentSchema);
export default Student;
