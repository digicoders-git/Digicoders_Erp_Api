import mongoose from 'mongoose';

const fcmTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['student', 'employee', 'admin', 'superadmin'],
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

fcmTokenSchema.index({ userId: 1, userType: 1 });
fcmTokenSchema.index({ token: 1 }, { unique: true });
fcmTokenSchema.index({ isActive: 1, userType: 1 });

export default mongoose.model('FcmToken', fcmTokenSchema);