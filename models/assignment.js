import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  batches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  }],
  dueDate: {
    type: Date,
    required: true
  },
  maxMarks: {
    type: Number,
    required: true
  },
  assignmentFiles: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    }
  }],
  submissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
assignmentSchema.index({ batches: 1, dueDate: 1 });
assignmentSchema.index({ createdBy: 1 });

export default mongoose.model('Assignment', assignmentSchema);