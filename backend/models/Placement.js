import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  jobRole: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  eligibility: {
    type: String,
    trim: true
  },
  departments: {
    type: [String],
    required: true,
    default: []
  },
  minimumCGPA: {
    type: Number,
    default: 0
  },
  backlogRequirement: {
    type: Boolean,
    default: false // false means no active backlogs allowed, true means active backlogs are okay
  },
  salary: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  applicationLink: {
    type: String,
    trim: true
  },
  deadline: {
    type: Date
  },
  requiredSkills: {
    type: [String],
    default: []
  },
  selectionProcess: {
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
    enum: ['Open', 'Closed'],
    default: 'Open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Placement = mongoose.model('Placement', placementSchema);
export default Placement;
