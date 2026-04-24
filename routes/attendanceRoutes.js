

import express from "express";
import {
  createAttendance,
  updateAttendance,
  markAttendance,
  getBatchAttendance,
  getStudentAttendance,
  getStuAttendance,
  checkTodayAttendance, getoverallData,
  getAbsentReports,          // NEW
  getStudentAbsentDetails,
  getAttendanceReports,          // NEW
  getStudentDetailedReport
} from "../controllers/attendanceController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();
router.use(auth);

// POST: create attendance for a batch (handles both create and update)
router.post("/", createAttendance);

// PUT: update existing attendance
router.put("/:attendanceId", updateAttendance);

// PATCH: mark attendance of specific student
router.patch("/:attendanceId/mark", markAttendance);

// GET: all attendance of a batch
router.get("/batch/:batchId", getBatchAttendance);

router.get('/overall-chart', getoverallData)
// GET: check today's attendance
router.get("/batch/:batchId/today", checkTodayAttendance);

// GET: single student's attendance in a batch
router.get("/batch/:batchId/student/:studentId", getStudentAttendance);

// GET: student's own attendance
router.get("/student", getStuAttendance);

// NEW ROUTES
router.get("/absent-reports", getAbsentReports);
router.get("/student/:studentId/absent-details", getStudentAbsentDetails);

// NEW ROUTES - Attendance Reports
router.get("/reports", getAttendanceReports);
router.get("/student/:studentId/detailed-report", getStudentDetailedReport);
export default router;