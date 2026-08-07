import mongoose from "mongoose";

const certificateDataSchema = new mongoose.Schema(
  {
    refNo: {
      type: String,
      trim: true,
    },
    dctNumber: {
      type: String,
      trim: true,
      index: true,
      // Format: DCT/2026/XXXX
    },
    studentName: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    trainingType: {
      type: String,
      trim: true,
    },
    technology: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },
    fromDate: {
      type: String,
      trim: true,
    },
    toDate: {
      type: String,
      trim: true,
    },
    dateOfIssue: {
      type: String,
      trim: true,
    },
    grade: {
      type: String,
      trim: true,
    },
    sourceFile: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("CertificateData", certificateDataSchema);
