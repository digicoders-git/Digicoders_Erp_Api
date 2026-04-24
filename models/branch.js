import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const BranchModal = mongoose.model("Branch", BranchSchema);
export default BranchModal;
