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
  handleFeePaymentCallback, reminder
} from "../controllers/feeController.js";
import { auth } from '../middleware/auth.js';
import upload from "../middleware/upload.js";
const router = express.Router();
// router.use(auth);

router.post("/", upload.single("image"), auth, recordPayment);
router.get("/verify-payment-link", verifyFeePaymentLink);
router.get("/callback/payment-link", handleFeePaymentCallback);
router.get("/:registrationId/history", getPaymentHistory);
router.get("/history", auth, getPaymentHistoryToken);
router.get("/:registrationId/dues", checkDues);
router.get("/", auth, getallPayments);
router.get("/:id", getFeeById);
router.patch("/status/:id", auth, changeStatus);
router.delete("/delete/:id", auth, deleteFeeData);
router.post('/reminder', auth, reminder)
router.post('/reminder', auth, reminder)
export default router;