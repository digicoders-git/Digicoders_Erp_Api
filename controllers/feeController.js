// controllers/feeController.js
import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import mongoose from "mongoose";
import { sendSmsInstallmentReceived, sendSmsOtp, sendSmsFeeReminder } from "../utils/sendSMS.js";
import { sendEmail, sendInstallmentReceivedEmail, sendPaymentSuccessEmail, sendFeeReminderEmail } from "../utils/sendEmail.js";
import razorpay from "../utils/razorpay.js"

// Record a payment
export const recordPayment = async (req, res) => {
  try {
    const {
      registrationId,
      amount,
      paymentType,
      mode,
      isFullPaid,
      hrName,
      tnxStatus,
      qrcode,
      tnxId,
      remark,
    } = req.body;

    // Validate payment
    if (!registrationId || !amount || !mode) {
      return res.status(400).json({
        success: false,
        message: "Registration ID, amount and payment mode are required",
      });
    }

    // Validate amount is a positive number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid positive number",
      });
    }

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    let admin;
    admin = req.user;
    admin = req.student;
    const img = req.file;

    // Payment mode validation aur processing
    let finalTnxStatus = tnxStatus || "pending";
    let finalTnxId = tnxId;
    let paymentLink = null;

    if (mode === "cash") {
      // Cash payment - directly paid
      finalTnxStatus = "paid";
      finalTnxId = tnxId || `cash_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    } else if (mode === "upi_qr") {
      // UPI QR validation
      if (!tnxId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID required for UPI QR payment",
        });
      }
      // Check if tnxId is unique
      const existingTxn = await Fee.findOne({ tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used for another payment",
        });
      }
      finalTnxStatus = "pending";
    } else if (mode === "pos") {
      // POS validation
      if (!tnxId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID required for POS payment",
        });
      }
      // Check if tnxId is unique
      const existingTxn = await Fee.findOne({ tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used for another payment",
        });
      }
      finalTnxStatus = "paid";
    } else if (mode === "online") {
      // Online payment validation
      if (!tnxId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID required for online payment",
        });
      }
      // Check if tnxId is unique
      const existingTxn = await Fee.findOne({ tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used for another payment",
        });
      }
      finalTnxStatus = "pending";
    } else if (mode === "payment_link") {
      // Razorpay payment link generation
      if (razorpay) {
        try {
          paymentLink = await razorpay.paymentLink.create({
            amount: numericAmount * 100, // Amount in paise
            currency: "INR",
            description: `DigiCoders Fee Payment - ${registration.studentName}`,
            customer: {
              name: registration.studentName,
              contact: `+91${registration.mobile}`,
              email: registration.email
            },
            notify: {
              sms: true,
              email: true
            },
            reminder_enable: true,
            callback_url: `${process.env.BACKEND_URL}/api/fee/verify-payment-link`,
            callback_method: "get"
          });

          finalTnxStatus = "pending";
          finalTnxId = paymentLink.id;

        } catch (error) {
          console.error("Razorpay error:", error);
          finalTnxStatus = "pending";
          finalTnxId = `manual_${Date.now()}`;
        }
      } else {
        // Razorpay not configured, set manual payment
        finalTnxStatus = "pending";
        finalTnxId = `manual_${Date.now()}`;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment mode. Use: cash, upi_qr, pos, online, or payment_link",
      });
    }

    const paidAmount = mode === "payment_link"
      ? Number(registration.paidAmount)
      : Number(registration.paidAmount) + numericAmount;

    const dueAmount = mode === "payment_link"
      ? Number(registration.dueAmount)
      : Math.max(Number(registration.dueAmount) - numericAmount, 0);

    // Build fee object
    const feeData = {
      registrationId,
      totalFee: registration.totalFee,
      finalFee: registration.finalFee,
      paidAmount: paidAmount,
      amount: numericAmount, // Use validated numeric amount
      dueAmount: dueAmount,
      paymentType,
      mode,
      tnxStatus: finalTnxStatus,
      tnxId: finalTnxId,
      remark,
      paidBy: admin?._id,
      paymentLink: paymentLink?.short_url || null,
    };

    // Add qrcode only for upi_qr mode and if provided
    if (mode === "upi_qr" && qrcode) {
      feeData.qrcode = qrcode;
    }

    // Add image if provided
    if (img) {
      feeData.image = {
        url: `/uploads/${img.filename}`,
        public_id: img?.filename,
      };
    }

    const fee = await Fee.create(feeData);

    // Update registration payment status (sirf non-payment_link aur non-pending modes mein)
    if (mode !== "payment_link" && finalTnxStatus !== "pending") {
      registration.paidAmount = paidAmount;
      registration.dueAmount = dueAmount;
      
      // Auto-update training fee status based on due amount
      if (dueAmount === 0) {
        registration.trainingFeeStatus = "full paid";
        registration.tnxStatus = "full paid";
      } else if (paidAmount > 0) {
        registration.trainingFeeStatus = "partial";
        registration.tnxStatus = "paid";
      } else {
        registration.trainingFeeStatus = "pending";
        registration.tnxStatus = "pending";
      }
      
      await registration.save();
    }

    // Send notifications for successful payment
    if (mode !== "payment_link" && finalTnxStatus === "paid") {
      try {
        await sendSmsInstallmentReceived(registration.mobile, registration.studentName, numericAmount);
        await sendInstallmentReceivedEmail(registration.email, {
          studentName: registration.studentName,
          amount: numericAmount,
          dueAmount: dueAmount > 0 ? dueAmount : null,
        });
      } catch (error) {
        console.error("Notification failed:", error);
      }
    }

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      id: fee._id,
      fee,
      paymentLink: paymentLink?.short_url || null,
    });
  } catch (error) {
    console.error("Record payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error recording payment",
      error: error.message,
    });
  }
};


// Payment verification for payment link
export const verifyFeePaymentLink = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_status,
    } = req.query;


    if (razorpay_payment_link_status === 'paid' && razorpay_payment_id && razorpay_payment_link_id) {
      // Find fee record by payment link ID
      const feeRecord = await Fee.findOne({ tnxId: razorpay_payment_link_id });

      if (feeRecord) {
        // Get registration details
        const registration = await Registration.findById(feeRecord.registrationId);
        const paid = Number(feeRecord.amount);
        const currentDue = Number(registration.dueAmount);
        const newDue = Math.max(currentDue - paid, 0);

        // Update fee status
        feeRecord.tnxId = razorpay_payment_id;
        feeRecord.paidAmount = Number(feeRecord.paidAmount) + paid,
          feeRecord.dueAmount = newDue,
          feeRecord.tnxStatus = newDue === 0 ? "full paid" : "paid";
        feeRecord.status = "accepted"
        await feeRecord.save();

        // Update registration payment status
        if (registration) {
          registration.paidAmount = Number(registration.paidAmount) + paid;
          registration.dueAmount = newDue;
          
          // Auto-update training fee status based on due amount
          if (newDue === 0) {
            registration.trainingFeeStatus = "full paid";
            registration.tnxStatus = "full paid";
          } else if (registration.paidAmount > 0) {
            registration.trainingFeeStatus = "partial";
            registration.tnxStatus = "paid";
          } else {
            registration.trainingFeeStatus = "pending";
            registration.tnxStatus = "pending";
          }
          
          await registration.save();

          // Send confirmation
          try {
            await sendSmsInstallmentReceived(registration.mobile, registration.studentName, paid);
            await sendPaymentSuccessEmail(registration.email, {
              studentName: registration.studentName,
              training: "Fee Payment",
              technology: "",
              paymentId: razorpay_payment_id,
              amount: paid,
              mobile: registration.mobile,
            });
          } catch (error) {
            console.error("Notification failed:", error);
          }
        }
return res.redirect(
          `${process.env.FRONTEND_URL}/receipt/${feeRecord._id}`,)
        // return res.status(200).json({
        //   success: true,
        //   message: "Payment verified and status updated successfully",
        //   data: {
        //     feeId: feeRecord._id,
        //     registrationId: registration._id,
        //     studentName: registration.studentName,
        //     paymentId: razorpay_payment_id
        //   }
        // });
      } else {
        return res.status(404).json({
          success: false,
          message: "Fee record not found for this payment link"
        });
      }
    } else {
      if (razorpay_payment_link_id) {
        const feeRecord = await Fee.findOne({ tnxId: razorpay_payment_link_id });
        if (feeRecord) {
          feeRecord.tnxStatus = "failed";
          feeRecord.status = "rejected"
          await feeRecord.save();
        }
      }


      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid payment status"
      });
    }
  } catch (error) {
    console.error("Fee payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message
    });
  }
};

// Payment callback handler for fee
export const handleFeePaymentCallback = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_status,
    } = req.query;


    if (razorpay_payment_id && razorpay_payment_link_id && razorpay_payment_link_status === 'paid') {
      // Find fee record by payment link ID
      const feeRecord = await Fee.findOne({ tnxId: razorpay_payment_link_id });

      if (feeRecord) {

        const registration = await Registration.findById(feeRecord.registrationId);

        // Update fee status
        feeRecord.tnxStatus = "paid";
        feeRecord.tnxId = razorpay_payment_id;
        await feeRecord.save();

        // Update registration payment status
        if (registration) {
          const newPaidAmount = Number(registration.paidAmount) + Number(feeRecord.amount);
          const newDueAmount = Number(registration.dueAmount) - Number(feeRecord.amount);

          registration.paidAmount = newPaidAmount;
          registration.dueAmount = newDueAmount;
          
          // Auto-update training fee status based on due amount
          if (newDueAmount === 0) {
            registration.trainingFeeStatus = "full paid";
            registration.tnxStatus = "full paid";
          } else if (newPaidAmount > 0) {
            registration.trainingFeeStatus = "partial";
            registration.tnxStatus = "paid";
          } else {
            registration.trainingFeeStatus = "pending";
            registration.tnxStatus = "pending";
          }
          
          await registration.save();

          // Send confirmation
          try {
            await sendSmsInstallmentReceived(registration.mobile, registration.studentName, feeRecord.amount);
            await sendPaymentSuccessEmail(registration.email, {
              studentName: registration.studentName,
              training: "Fee Payment",
              technology: "",
              paymentId: razorpay_payment_id,
              amount: feeRecord.amount,
              mobile: registration.mobile,
            });
          } catch (error) {
            console.error("Notification failed:", error);
          }
        }

        console.log('Fee payment status updated successfully');
      } else {
        console.log('Fee record not found for payment link ID:', razorpay_payment_link_id);
      }

      res.redirect(`${process.env.FRONTEND_URL}/receipt/${feeRecord._id}`);
    } else {

      console.log('Fee payment failed or incomplete');
      res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
    }
  } catch (error) {
    console.error("Fee payment callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
};

//get all payments
// export const getallPayments = async (req, res) => {
//   try {
//     const payments = await Fee.find()
//       .populate(
//         "registrationId",
//         "studentName email mobile userid fatherName collegeName"
//       )
//       .populate("qrcode")
//       .sort({ paymentDate: -1 });
//     res.status(200).json({
//       success: true,
//       data: payments,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching payments",
//       error: error.message,
//     });
//   }
// };
// controllers/feeController.js

// backend controller mein yeh changes karein:


export const getallPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "paymentDate",
      sortOrder = "desc",
      branch,
      batch,
      minPaid,
      maxPaid,
      due,
      startDate,
      endDate,
      tnxStatus,
      paymentType,
      mode,
      status,
      qrcode,
    } = req.query;

    const skip = (page - 1) * limit;
    const loggedInUser = req.user;

    // 🔐 ROLE BASED BRANCH CONTROL (ONLY ONE SOURCE OF TRUTH)
    let effectiveBranch = null;

    if (loggedInUser.role !== "Super Admin") {
      effectiveBranch = loggedInUser.branch; // force user branch
    } else if (branch) {
      effectiveBranch = branch; // super admin selected branch
    }

    // 🎯 MATCH OBJECT (Fee fields only)
    const match = {};

    if (status) match.status = status;
    if (tnxStatus) match.tnxStatus = tnxStatus;
    if (paymentType) match.paymentType = paymentType;
    if (mode) match.mode = mode;
    if (qrcode) match.qrcode = new mongoose.Types.ObjectId(qrcode);

    // 💰 Paid Amount
    if (minPaid || maxPaid) {
      match.paidAmount = {};
      if (minPaid) match.paidAmount.$gte = Number(minPaid);
      if (maxPaid) match.paidAmount.$lte = Number(maxPaid);
    }

    // 💸 Due Amount
    if (due === "yes") match.dueAmount = { $gt: 0 };
    if (due === "no") match.dueAmount = { $eq: 0 };

    // 📅 Date Range
    if (startDate || endDate) {
      match.paymentDate = {};
      if (startDate) match.paymentDate.$gte = new Date(startDate);
      if (endDate) match.paymentDate.$lte = new Date(endDate);
    }

    // 🚀 AGGREGATION PIPELINE
    const pipeline = [
      {
        $lookup: {
          from: "registrations",
          localField: "registrationId",
          foreignField: "_id",
          as: "registration",
        },
      },
      { $unwind: "$registration" },

      // 🔐 BRANCH FILTER (APPLIED BEFORE POPULATION)
      ...(effectiveBranch
        ? [
          {
            $match: {
              "registration.branch": new mongoose.Types.ObjectId(
                effectiveBranch
              ),
            },
          },
        ]
        : []),

      // 🎯 Batch filter (APPLIED BEFORE POPULATION)
      ...(batch
        ? [
          {
            $match: {
              "registration.batch": new mongoose.Types.ObjectId(batch),
            },
          },
        ]
        : []),

      // Populate branch
      {
        $lookup: {
          from: "branches",
          localField: "registration.branch",
          foreignField: "_id",
          as: "registration.branch",
        },
      },
      {
        $unwind: {
          path: "$registration.branch",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Populate batch
      {
        $lookup: {
          from: "batches",
          localField: "registration.batch",
          foreignField: "_id",
          as: "registration.batch",
        },
      },
      {
        $unwind: {
          path: "$registration.batch",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 🔍 SEARCH
      ...(search
        ? [
          {
            $match: {
              $or: [
                { "registration.studentName": { $regex: search, $options: "i" } },
                { "registration.email": { $regex: search, $options: "i" } },
                { "registration.mobile": { $regex: search, $options: "i" } },
                { tnxId: { $regex: search, $options: "i" } },
                { receiptNo: { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
        : []),

      // ✅ Fee based filters
      { $match: match },

      // 🧾 QR CODE
      {
        $lookup: {
          from: "qrcodes",
          localField: "qrcode",
          foreignField: "_id",
          as: "qrcode",
        },
      },
      {
        $unwind: {
          path: "$qrcode",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 🧾 SORT + PAGINATION
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } },
      { $skip: Number(skip) },
      { $limit: Number(limit) },
    ];

    const payments = await Fee.aggregate(pipeline);

    // 📊 COUNT PIPELINE (SAME LOGIC)
    const countPipeline = [
      {
        $lookup: {
          from: "registrations",
          localField: "registrationId",
          foreignField: "_id",
          as: "registration",
        },
      },
      { $unwind: "$registration" },

      ...(effectiveBranch
        ? [
          {
            $match: {
              "registration.branch": new mongoose.Types.ObjectId(
                effectiveBranch
              ),
            },
          },
        ]
        : []),

      ...(batch
        ? [
          {
            $match: {
              "registration.batch": new mongoose.Types.ObjectId(batch),
            },
          },
        ]
        : []),

      ...(search
        ? [
          {
            $match: {
              $or: [
                { "registration.studentName": { $regex: search, $options: "i" } },
                { "registration.email": { $regex: search, $options: "i" } },
                { tnxId: { $regex: search, $options: "i" } },
                { receiptNo: { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
        : []),

      { $match: match },
      { $count: "total" },
    ];

    const totalResult = await Fee.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    // Get filter options
    const branches = await mongoose.connection.db.collection("branches").find({ isActive: true }).toArray();
    const batches = await mongoose.connection.db.collection("batches").find({ isActive: true }).toArray();
    const qrcodes = await mongoose.connection.db.collection("qrcodes").find({ isActive: true }).toArray();

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        branches,
        batches,
        qrcodes,
        tnxStatuses: ["pending", "paid", "failed", "full paid"],
        paymentTypes: ["registration", "installment", "full"],
        modes: ["cash", "upi_qr", "pos", "online", "payment_link"],
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};


// Get payment history for a registration
export const getPaymentHistory = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const payments = await Fee.find({ registrationId: registrationId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment history",
      error: error.message,
    });
  }
};
export const getPaymentHistoryToken = async (req, res) => {
  try {
    const id = req.student;
    const payments = await Fee.find({ registrationId: id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment history",
      error: error.message,
    });
  }
};

// Check dues for a registration
export const checkDues = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalFee: registration.totalFee,
        paidAmount: registration.paidAmount,
        remainingFee: registration.dueAmount,
        paymentStatus: registration.paymentStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking dues",
      error: error.message,
    });
  }
};

export const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !["accepted", "rejected", "new"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find fee
    const FeeData = await Fee.findById(id);
    if (!FeeData) {
      return res.status(404).json({
        success: false,
        message: "Fee Data not found",
      });
    }

    const Student = await Registration.findById({
      _id: FeeData.registrationId,
    });
    if (!Student)
      return res
        .status(404)
        .json({ message: "registration data is not found" });

    // Update logic based on status transition
    if (status === "accepted" && FeeData.status !== "accepted") {
      // Apply payment to student registration
      Student.paidAmount = Number(Student.paidAmount) + Number(FeeData.amount);
      Student.dueAmount = Math.max(Number(Student.dueAmount) - Number(FeeData.amount), 0);
      
      // Auto-update training fee status based on due amount
      if (Student.dueAmount === 0) {
        Student.trainingFeeStatus = "full paid";
        Student.tnxStatus = "full paid";
        FeeData.tnxStatus = "full paid";
      } else if (Student.paidAmount > 0) {
        Student.trainingFeeStatus = "partial";
        Student.tnxStatus = "paid";
        FeeData.tnxStatus = "paid";
      } else {
        Student.trainingFeeStatus = "pending";
        Student.tnxStatus = "pending";
        FeeData.tnxStatus = "pending";
      }
      
      await Student.save();
    } else if (status === "rejected" && FeeData.status === "accepted") {
      // Reverse payment from student registration
      Student.paidAmount = Math.max(Number(Student.paidAmount) - Number(FeeData.amount), 0);
      Student.dueAmount = Number(Student.dueAmount) + Number(FeeData.amount);

      if (FeeData.paymentType === "registration") {
        Student.tnxStatus = "failed";
      }
      Student.trainingFeeStatus = "pending";

      FeeData.tnxStatus = "failed";
      await Student.save();
    } else if (status === "rejected" && (FeeData.status === "new" || !FeeData.status)) {
      // Just mark as failed, no reversal needed as it wasn't applied
      FeeData.tnxStatus = "failed";
    }

    FeeData.status = status;
    FeeData.verifiedBy = req.user.id;
    await FeeData.save();

    res.status(200).json({
      success: true,
      message: "FeeData status updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FeeData status",
      error: error.message,
    });
  }
};
export const getFeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const feedata = await Fee.findOne({
      $or: [{ _id: id }, { registrationId: id }],
    }).populate({
      path: "registrationId",
      select:
        "collegeName fatherName email mobile whatshapp paymentStatus studentName training technology education userid eduYear totalFee finalFee paidAmount dueAmount branch",
      populate: [
        { path: "training", select: "name" },
        { path: "technology", select: "name" },
        { path: "education", select: "name" },
        { path: "collegeName", select: "name" },
        { path: "branch", select: "name location" },
      ],
    });
    if (!feedata)
      return res
        .status(404)
        .json({ success: false, message: "fee data not found" });
    return res
      .status(200)
      .json({ success: true, message: "feaching successfull", data: feedata });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error featching fee data",
      error: error.message,
    });
  }
};
export const deleteFeeData = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if record exists
    const feeData = await Fee.findById(id);
    if (!feeData) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    // Delete record
    await Fee.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Fee record deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const reminder = async (req, res) => {
  try {
    const { mobile, email, paymentLink, studentName, amount } = req.body;

    if (!mobile || !email || !paymentLink) {
      return res.status(400).json({
        success: false,
        message: "Mobile, email, and payment link are required"
      });
    }

    // Send reminder notifications
    try {
      await sendSmsFeeReminder(mobile, studentName, amount);
      await sendFeeReminderEmail(email, {
        studentName,
        amount,
        paymentLink,
      });
    } catch (error) {
      console.error("Reminder notification failed:", error);
    }

    res.status(200).json({
      success: true,
      message: "Payment reminder sent successfully"
    });
  } catch (error) {
    console.error("Reminder error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending payment reminder",
      error: error.message
    });
  }
}