import mongoose from "mongoose";

const certificationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    studentName: { type: String, required: true },
    mobile: { type: String, required: true },
    trainingDuration: { type: String, required: true },
    trainingName: { type: String, required: true },
    startDate: { type: Date, required: true },
    collegeName: { type: String, required: true },
    course: { type: String, required: true },
    branch: { type: String, required: true },
    technology: { type: String, required: true },
    trainingMode: { type: String, required: true },
    
    feeReceipt: { type: String, required: true },
    aadharFront: { type: String, required: true },
    aadharBack: { type: String, required: true },

    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Send to Print", "Printed", "Issued"],
      default: "Pending",
    },
    rejectReason: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Certification", certificationSchema);
