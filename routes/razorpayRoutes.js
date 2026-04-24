import express from "express";
import { auth } from "../middleware/auth.js";
import {
    createOrder,
    verifyPayment,verifyPaymentLink,verifyWebPayment,handleWebPaymentFailure
} from "../controllers/razorpayController.js";

const router = express.Router();

router.post("/verify-web", verifyWebPayment);
router.post("/record-failure", handleWebPaymentFailure);
router.use(auth);
router.post("/create-order", createOrder);
router.post("/verify", auth, verifyPayment);
router.get("/verify-payment-link", verifyPaymentLink);

export default router;
