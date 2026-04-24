import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
  date: { type: Date, required: true },
  presents: { type: Number, },
  absents: { type: Number,  },
  total: { type: Number,  },
  records: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration" },
      status: { type: String, enum: ["Present", "Absent"], default: "Absent" }
    }
  ],
attendBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}
});

// ek hi batch ke liye ek hi date repeat na ho
attendanceSchema.index({ batch: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
