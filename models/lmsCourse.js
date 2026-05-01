import mongoose from 'mongoose';

const lmsCourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  technology: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technology',
    required: true,
    index: true
  },
  thumbnail: {
    url: String,
    public_id: String
  },
  videoCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

lmsCourseSchema.index({ technology: 1, isActive: 1 });
lmsCourseSchema.index({ title: 1 });

export default mongoose.model('LmsCourse', lmsCourseSchema);