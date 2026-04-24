import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
  name: String,
  phone: String,
  expertise: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  assignedBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Batch" }],
  addBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const teacherModal = mongoose.model("Teachers", teacherSchema);
export default teacherModal;
