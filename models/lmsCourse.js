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
  // Store base technology name instead of specific technology ID
  baseTechnology: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Keep reference to all related technologies (different durations)
  relatedTechnologies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technology'
  }],
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

lmsCourseSchema.index({ baseTechnology: 1, isActive: 1 });
lmsCourseSchema.index({ title: 1 });

export default mongoose.model('LmsCourse', lmsCourseSchema);