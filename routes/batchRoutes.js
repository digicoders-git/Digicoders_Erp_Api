import express from "express";
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  assignTeacher,
  updateBatchStudents, // NEW
  removeStudentFromBatch,
  deleteBatch,updateStatus,getBatchByStudentId
} from "../controllers/batchController.js";
import { auth } from "../middleware/auth.js";
const router = express.Router();
router.use(auth);

router.post("/create",createBatch);
router.get("/",getBatches);
router.get("/:id", getBatchById);
router.get("/student/:id", getBatchByStudentId);
router.put("/:id", updateBatch);
router.put("/assign-teacher", assignTeacher);
router.put("/:batchId/students", updateBatchStudents); // NEW - for bulk student management
router.delete("/remove-student", removeStudentFromBatch);
router.delete("/:id", deleteBatch);
router.patch("/updatestatus/:id", updateStatus);

export default router;