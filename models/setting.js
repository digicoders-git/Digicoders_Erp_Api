import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    isCertificationEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Setting", settingSchema);
