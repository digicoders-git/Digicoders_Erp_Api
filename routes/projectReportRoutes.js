import express from "express";
import {
  getAllProjectReports,
  getProjectReportById,
  updateProjectReportStatus,
  updatePdfSentStatus,
  deleteProjectReport,
  getProjectReportDashboardCounts,
  getMyReportStatus,
} from "../controllers/projectReportController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, getAllProjectReports);
router.get("/dashboard/counts", auth, getProjectReportDashboardCounts);
router.get("/my-report", auth, getMyReportStatus);
router.get("/:id", auth, getProjectReportById);
router.put("/:id/status", auth, updateProjectReportStatus);
router.patch("/:id/pdfSendStudent", auth, updatePdfSentStatus);
router.delete("/:id", auth, deleteProjectReport);

export default router;
