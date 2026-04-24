import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    cv: {
      uri: {
        type: String,
      },
      public_id: { type: String },
    },
    coverLetter: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "Applied",
        "rejected",
        "interview",
        "selected",
        "joined",

      ],
      default: "pending",
    },
    interview: {
      date: { type: Date },
      time: { type: String },
      mode: { type: String, enum: ["online", "offline"] },
      location: { type: String },
    },
  },
  { timestamps: true } // createdAt, updatedAt auto generate honge
);

const Application = mongoose.model("Application", applicationSchema);

export default Application;
