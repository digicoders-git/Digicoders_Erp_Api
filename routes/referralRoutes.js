import express from "express";
import {
  getMyReferrals,
  getAllReferrals,
  updateReferralStatus,
  getReferralStats,
} from "../controllers/referralController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Student routes
router.get("/my-referrals/:userId", protect, getMyReferrals);

// Admin routes
router.get("/all", protect, getAllReferrals);
router.patch("/:id/status", protect, updateReferralStatus);
router.get("/stats", protect, getReferralStats);

export default router;