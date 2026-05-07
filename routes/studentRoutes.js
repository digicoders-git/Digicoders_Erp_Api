
import express from "express";
import { updateProfile, changePassword, uploadDocuments, directResetPassword, getProfile, debugBatchInfo } from "../controllers/studentController.js";
import { auth } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// @route   GET /api/student/profile
// @access  Private (Student)
router.get("/profile", auth, getProfile);

// @route   GET /api/student/debug-batch
// @access  Private (Student)
router.get("/debug-batch", auth, debugBatchInfo);

// @route   PUT /api/student/update
// @access  Private (Student)
router.put("/update", auth, updateProfile);

// @route   PUT /api/student/change-password
// @access  Private (Student)
router.put("/change-password", auth, changePassword);

// @route   PUT /api/student/upload-docs
// @access  Private (Student)
router.put("/upload-docs", auth, upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]), uploadDocuments);

router.put("/reset-password-direct", auth, directResetPassword);

export default router;
