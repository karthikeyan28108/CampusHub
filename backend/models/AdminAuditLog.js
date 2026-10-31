import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUserA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUserB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    default: 'message_oversight_lookup'
  },
  reason: {
    type: String,
    trim: true,
    default: 'Moderation / Safety Review'
  },
  messageCount: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

adminAuditLogSchema.index({ adminId: 1, timestamp: -1 });
adminAuditLogSchema.index({ targetUserA: 1, targetUserB: 1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);

export default AdminAuditLog;
