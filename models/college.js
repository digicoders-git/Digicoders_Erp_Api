import mongoose from "mongoose";

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    district: String,
    state: String,
    address: String,
    course: [String],
    tpoNo1: String,
    tpoNo2: String,
    hodNo: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const College = mongoose.model("College", collegeSchema);

export default College;
