import express from "express";
import {
  createApplication,
  getApplications,
  getApplication,
  getStudentApplications,
  updateApplicationStatus,
  scheduleInterview,
  updateInterview,
  completeApplication,
  getApplicationStats,
} from "../controllers/jobApplicationController.js";
import upload from "../middleware/upload.js";
import { auth } from "../middleware/auth.js";


const router = express.Router();
router.use(auth)
router.route("/")
  .post( upload.single("cv"), createApplication)
  .get( getApplications);

router.route("/my-applications")
  .get( getStudentApplications);

router.route("/stats/overview")
  .get(getApplicationStats);

router.route("/:id")
  .get( getApplication);

router.route("/:id/status")
  .patch( updateApplicationStatus);

router.route("/:id/schedule-interview")
  .patch( scheduleInterview);

router.route("/:id/interview")
  .patch( updateInterview);

router.route("/:id/complete")
  .patch(completeApplication);

export default router;