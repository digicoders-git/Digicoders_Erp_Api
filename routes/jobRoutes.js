import express from "express";
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  assignStudentsToJob,
  removeStudentFromJob,
  getJobStats,getJobsForStu
} from "../controllers/jobController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(auth);

router.route("/for-student").get(getJobsForStu);
router.route("/").get(getJobs).post(createJob);

router.route("/stats/overview").get(getJobStats);

router.route("/:id").get(getJob).put(updateJob).delete(deleteJob);

router.route("/:id/status").patch(toggleJobStatus);

router.route("/:id/assign-students").post(assignStudentsToJob);

router.route("/:id/remove-student/:studentId").delete(removeStudentFromJob);

export default router;
