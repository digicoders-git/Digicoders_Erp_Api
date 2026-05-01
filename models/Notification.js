import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    required: true,
    enum: ['all', 'students', 'employees', 'admins']
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'sending', 'completed', 'failed'],
    default: 'pending'
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

notificationSchema.index({ sentBy: 1, createdAt: -1 });
notificationSchema.index({ targetType: 1, status: 1 });

export default mongoose.model('Notification', notificationSchema);