import mongoose from "mongoose";

const hrSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "HR name is required"],
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    personalNo: {
      type: String,
      match: [/^[6-9]\d{9}$/, "Please enter a valid personal number"],
    },
    officeNo: {
      type: String,
      match: [/^[6-9]\d{9}$/, "Please enter a valid office number"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Hr", hrSchema);
