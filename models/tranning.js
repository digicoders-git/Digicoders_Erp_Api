import mongoose from "mongoose";

const tranningSchama = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    duration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Duration",
      required: true,
    },
    registrationAmount: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const TranningModal = mongoose.model("Tranning", tranningSchama);
export default TranningModal;
