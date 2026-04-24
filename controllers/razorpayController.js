import crypto from "crypto";
import razorpay from "../utils/razorpay.js";
import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import { sendSmsOtp, sendSmsRegSuccess } from "../utils/sendSMS.js";
import { sendRegistrationSuccessEmail } from "../utils/sendEmail.js";

export const createOrder = async (req, res) => {
  try {
    const studentId = req.student._id;
    const { amount } = req.body;
    const payAmount = Number(amount);
    const student = await Registration.findById(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    if (payAmount <= 0 || payAmount > student.dueAmount) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const order = await razorpay.orders.create({
      amount: payAmount * 100, // paise
      currency: "INR",
      receipt: `DCT-${Date.now()}`,
      notes: {
        registrationId: student._id.toString(),
        userid: student.userid,
      },
    });

    res.status(200).json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;
    const studentId = req.student._id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const student = await Registration.findById(studentId);

    const paidAmount = student.paidAmount + amount;

    const dueAmount = Math.max(student.dueAmount - amount, 0);

    const fee = await Fee.create({
      registrationId: student._id,
      totalFee: student.totalFee,
      finalFee: student.finalFee,
      paidAmount,
      dueAmount,
      amount,
      paymentType: "installment",
      mode: "payment_link",
      tnxId: razorpay_payment_id,
      tnxStatus: dueAmount === 0 ? "full paid" : "paid",
      status: "accepted",
      paymentStatus: "success",
      isFullPaid: dueAmount === 0,
    });

    student.paidAmount = paidAmount;
    student.dueAmount = dueAmount;
    student.trainingFeeStatus = dueAmount === 0 ? "full paid" : "partial";
    student.tnxStatus = dueAmount === 0 ? "full paid" : "paid";

    await student.save();

    res.status(200).json({
      success: true,
      message: "Payment successful",
      fee,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const verifyPaymentLink = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_status,
      razorpay_signature,
    } = req.query;

    if (
      razorpay_payment_link_status === "paid" &&
      razorpay_payment_id &&
      razorpay_payment_link_id
    ) {
      // Find registration by payment link ID
      const registration = await Registration.findOne({
        tnxId: razorpay_payment_link_id,
      });

      if (registration) {
        // Update payment status
        registration.tnxStatus = "paid";
        registration.tnxId = razorpay_payment_id;
        
        // Update paid and due amounts
        registration.paidAmount = registration.amount || 0;
        registration.dueAmount = Math.max((registration.finalFee || 0) - (registration.amount || 0), 0);
        
        // Determine training fee status
        if (registration.paymentType === "full" || registration.dueAmount === 0) {
          registration.trainingFeeStatus = "full paid";
        } else {
          registration.trainingFeeStatus = "partial";
        }
        
        await registration.save();

        // Update fee record
        const feeRecord = await Fee.findOne({
          registrationId: registration._id,
        });
        if (feeRecord) {
          feeRecord.tnxStatus = "paid";
          feeRecord.tnxId = razorpay_payment_id;
          await feeRecord.save();
        }

        // Send confirmation SMS
        try {
          await sendSmsOtp(
            registration.mobile,
            `Payment successful! Your DigiCoders registration confirmed. Payment ID: ${razorpay_payment_id} - Team DigiCoders`,
          );
        } catch (smsError) {
          console.error("SMS failed:", smsError);
        }

        console.log(
          "Payment status updated for registration:",
          registration._id,
        );

        // Redirect to frontend success page
        return res.redirect(
          `${process.env.FRONTEND_URL}/receipt/${feeRecord._id}`,
          // `${process.env.FRONTEND_URL}/payment-success?razorpay_payment_id=${razorpay_payment_id}&razorpay_payment_link_id=${razorpay_payment_link_id}&razorpay_payment_link_status=${razorpay_payment_link_status}`,
        );
      } else {
        console.log(
          "Registration not found for payment link ID:",
          razorpay_payment_link_id,
        );
        return res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-failed`,
        );
      }
    } else {
         if (razorpay_payment_link_id) {
      const registration = await Registration.findOne({
        tnxId: razorpay_payment_link_id,
      });

      if (registration) {
        registration.tnxStatus = "failed";
        registration.trainingFeeStatus = "pending";
        await registration.save();

        const feeRecord = await Fee.findOne({
          registrationId: registration._id,
        });

        if (feeRecord) {
          feeRecord.tnxStatus = "failed";
          await feeRecord.save();
        }
      }
    }
      console.log("Payment verification failed - invalid parameters");
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-failed`,
      );
    }
  } catch (error) {
    console.error("Payment link verification error:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-failed`,
    );
  }
};
export const verifyWebPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registrationId,
      amount
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const registration = await Registration.findById(registrationId)
      .populate("training", "name")
      .populate("technology", "name");
      
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    registration.tnxStatus = "paid";
    registration.tnxId = razorpay_payment_id;
    registration.paidAmount = amount;
    registration.dueAmount = Math.max(registration.finalFee - amount, 0);
    registration.trainingFeeStatus = registration.dueAmount === 0 ? "full paid" : "partial";
    await registration.save();

    // Update fee record
    const feeRecord = await Fee.findOne({
      registrationId: registration._id,
    });
    if (feeRecord) {
      feeRecord.tnxStatus = "paid";
      feeRecord.tnxId = razorpay_payment_id;
      feeRecord.paidAmount = amount;
      feeRecord.dueAmount = registration.dueAmount;
      await feeRecord.save();
    }

    // Send confirmation SMS & Email
    try {
      // Send Registration Success SMS
      await sendSmsRegSuccess(
        registration.mobile,
        registration.studentName,
        registration.training?.name,
        registration.technology?.name
      );

      // Send Registration Success Email
      if (registration.email) {
        await sendRegistrationSuccessEmail(registration.email, {
          studentName: registration.studentName,
          training: registration.training?.name,
          technology: registration.technology?.name,
          totalFee: registration.totalFee,
          discount: registration.discount,
          finalFee: registration.finalFee,
          paidAmount: registration.paidAmount,
          dueAmount: registration.dueAmount,
          mobile: registration.mobile,
        });
      }

      // Also send basic Payment Success SMS
      await sendSmsOtp(
        registration.mobile,
        `Payment successful! Your DigiCoders registration confirmed. Payment ID: ${razorpay_payment_id} - Team DigiCoders`,
      );
    } catch (notifError) {
      console.error("Notifications failed after payment verification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      registration,
      feeId: feeRecord?._id
    });
  } catch (error) {
    console.error("Web Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message
    });
  }
};

export const handleWebPaymentFailure = async (req, res) => {
  try {
    const { registrationId, error } = req.body;

    const registration = await Registration.findById(registrationId);
    if (registration) {
      registration.tnxStatus = "failed";
      registration.remark = `Payment failed: ${error?.description || 'User cancelled or unknown error'}`;
      await registration.save();

      // Update fee record if exists
      const feeRecord = await Fee.findOne({ registrationId: registration._id });
      if (feeRecord) {
        feeRecord.tnxStatus = "failed";
        await feeRecord.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment failure recorded"
    });
  } catch (err) {
    console.error("Error recording payment failure:", err);
    res.status(500).json({
      success: false,
      message: "Failed to record payment failure"
    });
  }
};
