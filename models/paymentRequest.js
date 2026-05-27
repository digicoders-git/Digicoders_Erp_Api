import mongoose from 'mongoose';

const PaymentRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  upiId: {
    type: String,
    required: true,
    trim: true
  },
  qrCode: {
    type: String, // Base64 encoded image or URL
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  remarks: {
    type: String,
    trim: true
  },
  screenshot: {
    type: String, // Payment screenshot uploaded by admin
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
PaymentRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Update the updatedAt field before updating
PaymentRequestSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const PaymentRequest = mongoose.model('PaymentRequest', PaymentRequestSchema);

export default PaymentRequest;