// routes/feeRoutes.js
import express from "express";
import {
  recordPayment,
  getPaymentHistory,
  checkDues,
  getallPayments,
  changeStatus,
  getFeeById,
  deleteFeeData,
  getPaymentHistoryToken,
  verifyFeePaymentLink,
  handleFeePaymentCallback, 
  reminder,
  editPayment,
  getPaymentsByEnrollSuffix,
  getPaymentAnalysisReport,
} from "../controllers/feeController.js";
import { auth, authorize } from '../middleware/auth.js';
import upload from "../middleware/upload.js";
const router = express.Router();

// 👑 Super Admin Only - Payment & QR Code Analysis Report
router.get("/payment-analysis", auth, authorize(["Super Admin"]), getPaymentAnalysisReport);

// 🔓 PUBLIC route - no auth needed
router.get("/public/enroll/:digits", getPaymentsByEnrollSuffix);

router.post("/", upload.single("image"), auth, recordPayment);
router.get("/verify-payment-link", verifyFeePaymentLink);
router.get("/callback/payment-link", handleFeePaymentCallback);
router.get("/:registrationId/history", getPaymentHistory);
router.get("/history", auth, getPaymentHistoryToken);
router.get("/:registrationId/dues", checkDues);
router.get("/", auth, getallPayments);
router.get("/:id", getFeeById);
router.patch("/status/:id", auth, changeStatus);
router.patch("/edit/:id", auth, editPayment);
router.delete("/delete/:id", auth, deleteFeeData);
router.post('/reminder', auth, reminder)
export default router;