import mongoose from "mongoose";

const durationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Duration name is required"],
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Duration = mongoose.model("Duration", durationSchema);

export default Duration;