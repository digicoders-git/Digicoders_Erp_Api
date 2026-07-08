import express from "express";
import {
  applyCertification,
  getStudentCertifications,
  getAllCertifications,
  updateCertificationStatus,
} from "../controllers/certificationController.js";
import { auth } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Student routes
router.post(
  "/apply",
  auth,
  upload.fields([
    { name: "feeReceipt", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
  ]),
  applyCertification
);

router.get("/student/:studentId", auth, getStudentCertifications);

// Admin routes
router.get("/all", auth, getAllCertifications);
router.patch("/status/:id", auth, updateCertificationStatus);

export default router;
