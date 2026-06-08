import express from "express";
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  assignTeacher,
  updateBatchStudents, // NEW
  removeStudentFromBatch,
  deleteBatch, updateStatus, getBatchByStudentId,
  fixBatchInconsistencies
} from "../controllers/batchController.js";
import { auth, authorize } from "../middleware/auth.js";
const router = express.Router();
router.use(auth);

router.post("/create", authorize(["Super Admin", "Admin"], "manage_batch"), createBatch);
router.get("/", authorize(["Super Admin", "Admin", "Employee"], "view_batch"), getBatches);
router.get("/:id", authorize(["Super Admin", "Admin", "Employee"], "view_batch"), getBatchById);
router.get("/student/:id", authorize(["Super Admin", "Admin", "Employee"], "view_batch"), getBatchByStudentId);
router.put("/:id", authorize(["Super Admin", "Admin"], "manage_batch"), updateBatch);
router.put("/assign-teacher", authorize(["Super Admin", "Admin"], "manage_batch"), assignTeacher);
router.put("/:batchId/students", authorize(["Super Admin", "Admin", "Employee"], "manage_batch"), updateBatchStudents); // NEW - for bulk student management
router.delete("/remove-student", authorize(["Super Admin", "Admin", "Employee"], "manage_batch"), removeStudentFromBatch);
router.delete("/:id", authorize(["Super Admin", "Admin"], "manage_batch"), deleteBatch);
router.patch("/updatestatus/:id", authorize(["Super Admin", "Admin"], "manage_batch"), updateStatus);
router.post("/fix-inconsistencies", authorize(["Super Admin"], null), fixBatchInconsistencies); // NEW - fix batch-student inconsistencies

export default router;