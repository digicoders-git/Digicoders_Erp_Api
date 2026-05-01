import mongoose from 'mongoose';

const lmsVideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LmsCourse',
    required: true,
    index: true
  },
  video: {
    url: String,
    public_id: String
  },
  thumbnail: {
    url: String,
    public_id: String
  },
  order: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

lmsVideoSchema.index({ course: 1, order: 1 });
lmsVideoSchema.index({ course: 1, isActive: 1 });

export default mongoose.model('LmsVideo', lmsVideoSchema);