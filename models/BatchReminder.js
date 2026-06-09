import mongoose from 'mongoose';

const batchReminderSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  reminderType: {
    type: String,
    enum: ['start_soon', 'starting_now', 'custom'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  soundUrl: {
    type: String, // URL or path to custom sound file
    default: null
  },
  soundName: {
    type: String, // Display name for sound
    default: 'Default'
  },
  minutesBefore: {
    type: Number,
    default: 15, // Remind 15 minutes before batch starts
    min: 0,
    max: 120
  },
  isActive: {
    type: Boolean,
    default: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  sentAt: {
    type: Date,
    default: null
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
    enum: ['scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'scheduled'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Custom notification settings
  notificationSettings: {
    playSound: {
      type: Boolean,
      default: true
    },
    soundVolume: {
      type: Number,
      default: 80, // 0-100
      min: 0,
      max: 100
    },
    vibrate: {
      type: Boolean,
      default: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'high'
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
batchReminderSchema.index({ batchId: 1, status: 1 });
batchReminderSchema.index({ scheduledTime: 1, status: 1 });
batchReminderSchema.index({ createdBy: 1, createdAt: -1 });

// Auto-populate batch details
batchReminderSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'batchId',
    select: 'batchName classTime startDate trainingType teacher branch students',
    populate: [
      { path: 'trainingType', select: 'name' },
      { path: 'teacher', select: 'name' },
      { path: 'branch', select: 'name' }
    ]
  }).populate('createdBy', 'name email');
  next();
});

export default mongoose.model('BatchReminder', batchReminderSchema);