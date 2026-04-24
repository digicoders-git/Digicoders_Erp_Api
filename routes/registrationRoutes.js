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
  verifyOtp,RegistrationByWeb,
} from "../controllers/registrationController.js";
import { bulkImportRegistrations } from "../controllers/bulkImportController.js";
import { auth } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import { parseFormData } from "../config/formDataParser.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/register", addRegistration);
router.post("/web/register", RegistrationByWeb);
// router.post("/sendmail", sendmail);
router.post("/sendOtp", sendOtp);
router.post("/verifyOtp", verifyOtp);
router.post("/login", login);
router.get("/get/user/:username", getOneRegistrations);

// Admin routes (admin authentication required)
router.get("/all", auth, getAllRegistrations);

router.get("/user", auth, getRegistration);

router.patch("/update/:id", auth, upload.fields([{ name: "profilePhoto", maxCount: 1 }, { name: "aadharCard", maxCount: 1 }, { name: "cv", maxCount: 1 },]), updateRegistration);

router.patch("/status/:id", auth, updateRegistrationStatus);

router.delete("/user/:id", auth, deleteRegistration);

// Bulk import from Excel
router.post("/bulk-import", auth, upload.single("importFile"), bulkImportRegistrations);

export default router;
