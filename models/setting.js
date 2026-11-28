import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    isCertificationEnabled: {
      type: Boolean,
      default: false,
    },
    masterOtp: {
      type: String,
      default: "123456",
      trim: true,
    },
    isMasterOtpEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Setting", settingSchema);
