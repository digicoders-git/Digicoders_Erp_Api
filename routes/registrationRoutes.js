import express from "express";
import {
  addRegistration,
  getAllRegistrations,
  getRegistration,
  updateRegistration,
  updateRegistrationStatus,
  deleteRegistration,
  getOneRegistrations,
  login,
  sendOtp,
  verifyOtp,
  RegistrationByWeb,
  getUserData,
} from "../controllers/registrationController.js";
import { bulkImportRegistrations } from "../controllers/bulkImportController.js";
import { auth } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import { parseFormData } from "../config/formDataParser.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/register", addRegistration);
router.post("/web/register", RegistrationByWeb);
router.post("/sendOtp", sendOtp);
router.post("/verifyOtp", verifyOtp);
router.post("/login", login);
router.get("/get/user/:username", getOneRegistrations);

// New API - Get user data by mobile or student ID
router.get("/user-data/:identifier", getUserData);

// Admin routes (admin authentication required)
router.get("/all", auth, getAllRegistrations);

router.get("/user", auth, getRegistration);

router.patch("/update/:id", auth, upload.fields([{ name: "profilePhoto", maxCount: 1 }, { name: "aadharCard", maxCount: 1 }, { name: "cv", maxCount: 1 },]), updateRegistration);

router.patch("/status/:id", auth, updateRegistrationStatus);

router.delete("/user/:id", auth, deleteRegistration);

// Bulk import from Excel
router.post("/bulk-import", auth, upload.single("importFile"), bulkImportRegistrations);

export default router;
