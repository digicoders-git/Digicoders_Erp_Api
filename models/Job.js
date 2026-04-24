import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxLength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  jobType: {
    type: String,
    required: [true, 'Job type is required'],
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
    default: 'full-time'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  salary: {
    type: String,
    required: [true, 'Salary information is required']
  },
  requirements: {
    type: String,
    trim: true,
    maxLength: [500, 'Requirements cannot exceed 500 characters']
  },
  skills: [{
    type: String,
    trim: true
  }],
  applicationDeadline: {
    type: Date,
    validate: {
      validator: function (value) {
        if (!value) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return value >= today;
      },
      message: 'Application deadline must be today or in the future'
    }
  },
  vacancies: {
    type: Number,
    default: 1,
    min: [1, 'At least 1 vacancy is required']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better search performance
jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
jobSchema.index({ company: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ createdBy: 1 });

// Static method to get all jobs with filtering and pagination
jobSchema.statics.getJobs = function (filters = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return this.find(filters)
    .populate('company')
    .populate('assignedStudents')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to get job details
jobSchema.methods.getDetails = function () {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    company: this.company,
    jobType: this.jobType,
    location: this.location,
    salary: this.salary,
    requirements: this.requirements,
    skills: this.skills,
    applicationDeadline: this.applicationDeadline,
    vacancies: this.vacancies,
    status: this.status,
    assignedStudents: this.assignedStudents,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Method to check if job can accept more applications
jobSchema.methods.canAcceptApplications = function () {
  return this.status === 'active' &&
    (!this.applicationDeadline || this.applicationDeadline > new Date());
};

export default mongoose.model('Job', jobSchema);