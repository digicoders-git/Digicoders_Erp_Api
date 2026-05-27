import Referral from "../models/referral.js";
import Registration from "../models/regsitration.js";
import PaymentRequest from "../models/paymentRequest.js";
import mongoose from "mongoose";

// Get referral statistics and list for a user
export const getMyReferrals = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
      });
    }

    // Get all referrals made by this user
    const referrals = await Referral.find({ referrer: userId })
      .populate({
        path: "referred",
        select: "studentName userid mobile technology training",
        populate: [
          { path: "technology", select: "name" },
          { path: "training", select: "name" }
        ]
      })
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalReferrals = referrals.length;
    const totalEarnings = referrals
      .filter(r => r.status === "paid")
      .reduce((sum, r) => sum + r.rewardAmount, 0);
    const pendingEarnings = referrals
      .filter(r => r.status === "pending" || r.status === "approved")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    return res.status(200).json({
      success: true,
      data: {
        referrals,
        totalReferrals,
        totalEarnings,
        pendingEarnings,
      },
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching referral data",
      error: error.message,
    });
  }
};

// Get all referrals (Admin only)
export const getAllReferrals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      trainingType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== "All") filter.status = status;
    if (trainingType && trainingType !== "All") filter.trainingType = trainingType;

    // Search functionality
    if (search && search.trim()) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { referralCode: searchRegex },
        { "referrer.studentName": searchRegex },
        { "referred.studentName": searchRegex },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get referrals with population
    const referrals = await Referral.find(filter)
      .populate({
        path: "referrer",
        select: "studentName userid mobile",
      })
      .populate({
        path: "referred",
        select: "studentName userid mobile technology training",
        populate: [
          { path: "technology", select: "name" },
          { path: "training", select: "name" }
        ]
      })
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Referral.countDocuments(filter);

    // Calculate summary statistics
    const summaryStats = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          totalRewards: { $sum: "$rewardAmount" },
          paidRewards: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$rewardAmount", 0]
            }
          },
          pendingRewards: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "approved"]] },
                "$rewardAmount",
                0
              ]
            }
          },
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: referrals,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
      summary: summaryStats[0] || {
        totalReferrals: 0,
        totalRewards: 0,
        paidRewards: 0,
        pendingRewards: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching all referrals:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching referrals",
      error: error.message,
    });
  }
};

// Update referral status (Admin only)
export const updateReferralStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid referral ID is required",
      });
    }

    if (!["pending", "approved", "paid"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be pending, approved, or paid",
      });
    }

    const updateData = { status };
    if (remarks) updateData.remarks = remarks;
    if (status === "paid") updateData.paidAt = new Date();

    const referral = await Referral.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate([
      { path: "referrer", select: "studentName userid" },
      { path: "referred", select: "studentName userid" }
    ]);

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: "Referral not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Referral status updated successfully",
      data: referral,
    });
  } catch (error) {
    console.error("Error updating referral status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating referral status",
      error: error.message,
    });
  }
};

// Get referral statistics
export const getReferralStats = async (req, res) => {
  try {
    const stats = await Referral.aggregate([
      {
        $group: {
          _id: "$trainingType",
          count: { $sum: 1 },
          totalRewards: { $sum: "$rewardAmount" },
          paidRewards: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$rewardAmount", 0]
            }
          },
        }
      }
    ]);

    const overallStats = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          totalRewards: { $sum: "$rewardAmount" },
          paidRewards: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$rewardAmount", 0]
            }
          },
          pendingRewards: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "approved"]] },
                "$rewardAmount",
                0
              ]
            }
          },
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        byTrainingType: stats,
        overall: overallStats[0] || {
          totalReferrals: 0,
          totalRewards: 0,
          paidRewards: 0,
          pendingRewards: 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching referral statistics",
      error: error.message,
    });
  }
};

// Create payment request (Student)
export const createPaymentRequest = async (req, res) => {
  try {
    const { amount, upiId, qrCode } = req.body;
    
    // Handle both admin users and student users
    const currentUser = req.user || req.student;
    const studentId = currentUser?._id || currentUser?.id;

    console.log('Payment request data:', { 
      amount, 
      upiId, 
      qrCodeLength: qrCode?.length, 
      studentId,
      userType: req.user ? 'admin' : 'student'
    });

    if (!currentUser || !studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!amount || !upiId || !qrCode) {
      return res.status(400).json({
        success: false,
        message: "Amount, UPI ID, and QR code are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    // For admin users, they might be creating on behalf of a student
    // For student users, use their own ID
    let targetStudentId = studentId;
    
    // If it's an admin user, they should provide studentId in body
    if (req.user && !req.student) {
      targetStudentId = req.body.studentId || studentId;
    }

    // Check if student exists
    const student = await Registration.findById(targetStudentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Check if there's already a pending request
    const existingRequest = await PaymentRequest.findOne({
      student: targetStudentId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending payment request"
      });
    }

    // Create payment request
    const paymentRequest = new PaymentRequest({
      student: targetStudentId,
      amount: Number(amount),
      upiId: upiId.trim(),
      qrCode
    });

    const savedRequest = await paymentRequest.save();
    console.log('Payment request saved:', savedRequest._id);

    return res.status(201).json({
      success: true,
      message: "Payment request created successfully",
      data: savedRequest
    });
  } catch (error) {
    console.error("Error creating payment request:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating payment request",
      error: error.message
    });
  }
};

// Get all payment requests (Admin)
export const getPaymentRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== "All") filter.status = status;

    // Search functionality
    if (search && search.trim()) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { upiId: searchRegex },
        { "student.studentName": searchRegex },
        { "student.userid": searchRegex }
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get payment requests
    const paymentRequests = await PaymentRequest.find(filter)
      .populate({
        path: "student",
        select: "studentName userid mobile"
      })
      .populate({
        path: "processedBy",
        select: "name email"
      })
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await PaymentRequest.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: paymentRequests,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error("Error fetching payment requests:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payment requests",
      error: error.message
    });
  }
};

// Update payment request status (Admin)
export const updatePaymentRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, screenshot } = req.body;
    
    // Handle both admin users and student users
    const currentUser = req.user || req.student;
    const adminId = currentUser?._id || currentUser?.id;

    console.log('Updating payment request:', { id, status, hasScreenshot: !!screenshot });

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment request ID is required"
      });
    }

    if (!["pending", "approved", "rejected", "paid"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be pending, approved, rejected, or paid"
      });
    }

    // For 'paid' status, screenshot is required
    if (status === 'paid' && !screenshot) {
      return res.status(400).json({
        success: false,
        message: "Screenshot is required when marking payment as paid"
      });
    }

    const updateData = {
      status,
      processedBy: adminId,
      processedAt: new Date()
    };
    
    if (remarks) updateData.remarks = remarks;
    if (screenshot) updateData.screenshot = screenshot;

    const paymentRequest = await PaymentRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate([
      { path: "student", select: "studentName userid mobile" },
      { path: "processedBy", select: "name email" }
    ]);

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: "Payment request not found"
      });
    }

    console.log('Payment request updated successfully:', paymentRequest._id);

    return res.status(200).json({
      success: true,
      message: "Payment request status updated successfully",
      data: paymentRequest
    });
  } catch (error) {
    console.error("Error updating payment request status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating payment request status",
      error: error.message
    });
  }
};

// Get my payment requests (Student)
export const getMyPaymentRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Handle both admin users and student users
    const currentUser = req.user || req.student;
    const requesterId = currentUser?._id || currentUser?.id;

    // Use userId from params or fallback to requester ID
    const studentId = userId || requesterId;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required"
      });
    }

    console.log('Fetching payment requests for student:', studentId, 'User type:', req.user ? 'admin' : 'student');

    const paymentRequests = await PaymentRequest.find({ student: studentId })
      .populate({
        path: "processedBy",
        select: "name email"
      })
      .sort({ createdAt: -1 });

    console.log('Found payment requests:', paymentRequests.length);

    return res.status(200).json({
      success: true,
      data: paymentRequests
    });
  } catch (error) {
    console.error("Error fetching my payment requests:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payment requests",
      error: error.message
    });
  }
};