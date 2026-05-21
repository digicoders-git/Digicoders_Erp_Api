import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
    },
    trainingType: {
      type: String,
      enum: ["summer", "apprenticeship"],
      required: true,
    },
    rewardAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid"],
      default: "pending",
    },
    paidAt: {
      type: Date,
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ referralCode: 1 });

const Referral = mongoose.model("Referral", referralSchema);

export default Referral;