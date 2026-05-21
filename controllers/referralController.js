import Referral from "../models/referral.js";
import Registration from "../models/regsitration.js";
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