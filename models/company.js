import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxLength: [100, "Company name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    mobile: {
      type: String,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    contactNumber: {
      type: String,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    contactPersonName: {
      type: String,
    },
    address: {
      type: String,
      trim: true,
      maxLength: [200, "Address cannot exceed 200 characters"],
    },
    city: {
      type: String,
      trim: true,
      maxLength: [50, "City name cannot exceed 50 characters"],
    },
    state: {
      type: String,
      trim: true,
      maxLength: [50, "State name cannot exceed 50 characters"],
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?(www\.)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/,
        "Please enter a valid website URL",
      ],
    },
    industry: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
// Index for better search performance
companySchema.index({ name: "text", email: "text", industry: "text" });
companySchema.index({ isActive: 1 });
companySchema.index({ createdBy: 1 });

// Static method to get all companies with optional filtering
companySchema.statics.getCompanies = function (
  filters = {},
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  return this.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("createdBy", "name email");
};

// Instance method to get company details
companySchema.methods.getDetails = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    mobile: this.mobile,
    contactNumber: this.contactNumber,
    contactPersonName: this.contactPersonName,
    address: this.address,
    city: this.city,
    state: this.state,
    website: this.website,
    industry: this.industry,
    description: this.description,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};
export default mongoose.model("Company", companySchema);
