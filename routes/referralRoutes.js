import express from "express";
import {
  getMyReferrals,
  getAllReferrals,
  updateReferralStatus,
  getReferralStats,
  createPaymentRequest,
  getPaymentRequests,
  updatePaymentRequestStatus,
  getMyPaymentRequests,
} from "../controllers/referralController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Student routes
router.get("/my-referrals/:userId", protect, getMyReferrals);
router.get("/my/:userId", protect, getMyReferrals); // For ERP admin compatibility
router.post("/payment-request", protect, createPaymentRequest);
router.get("/my-payment-requests/:userId", protect, getMyPaymentRequests);
router.get("/my-payment-requests", protect, getMyPaymentRequests); // Without userId param

// Admin routes
router.get("/all", protect, getAllReferrals);
router.get("/payment-requests", protect, getPaymentRequests);
router.patch("/:id/status", protect, updateReferralStatus);
router.patch("/payment-request/:id/status", protect, updatePaymentRequestStatus);
router.get("/stats", protect, getReferralStats);

export default router;