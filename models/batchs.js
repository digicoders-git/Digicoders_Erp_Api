import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  batchName: String,
  room: String,
  classTime: String,
  subject: String,
  trainingType: { type: mongoose.Schema.Types.ObjectId, ref: "Tranning" },
  startDate: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teachers" },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Registration" }],
  addBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
export default mongoose.model("Batch", batchSchema);
