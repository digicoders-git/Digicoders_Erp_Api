import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import BranchModal from "../models/branch.js";
import mongoose from "mongoose";

// Helper function to build the date range filter
const buildDateFilter = (startDate, endDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return {
    createdAt: {
      $gte: start,
      $lte: end,
    }
  };
};

export const getReportData = async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    const loggedInUser = req.user;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start date and End date are required" });
    }

    const dateFilter = buildDateFilter(startDate, endDate);
    
    // Branch filter handling
    let branchFilter = {};
    if (loggedInUser.role !== "Super Admin") {
      branchFilter = { branch: new mongoose.Types.ObjectId(loggedInUser.branch) };
    } else if (branchId && branchId !== "All") {
      branchFilter = { branch: new mongoose.Types.ObjectId(branchId) };
    }

    // 1. Get Registrations
    const registrations = await Registration.find({
      ...dateFilter,
      ...branchFilter,
    }).populate("branch", "name");

    // 2. Get Fees
    // For fees, branch filter is slightly tricky. Fee schema might not have 'branch', so we lookup from Registration.
    const feeMatchStage = { ...dateFilter, status: { $in: ["accepted", "pending"] } };
    
    const feePipeline = [
      { $match: feeMatchStage },
      {
        $lookup: {
          from: "registrations",
          localField: "registrationId",
          foreignField: "_id",
          as: "registration",
        },
      },
      { $unwind: { path: "$registration", preserveNullAndEmptyArrays: true } },
    ];

    if (Object.keys(branchFilter).length > 0) {
      feePipeline.push({
        $match: {
          "registration.branch": branchFilter.branch,
        }
      });
    }

    feePipeline.push({
      $lookup: {
        from: "branches",
        localField: "registration.branch",
        foreignField: "_id",
        as: "branchDetails",
      }
    }, { $unwind: { path: "$branchDetails", preserveNullAndEmptyArrays: true } });

    const fees = await Fee.aggregate(feePipeline);

    // --- AGGREGATIONS ---
    
    // Total Counts
    const totalRegistrations = registrations.length;
    let totalFeeCollected = 0;
    let totalRegistrationFees = 0;
    
    // Mode-wise collection
    let onlineCollection = 0;
    let cashCollection = 0;
    let upiCollection = 0;

    // Branch-wise aggregations
    const branchStats = {}; // { [branchName]: { registrations: 0, fees: 0 } }

    registrations.forEach(reg => {
      const bName = reg.branch?.name || "Unknown";
      if (!branchStats[bName]) {
        branchStats[bName] = { 
          registrations: 0, 
          fees: 0, 
          branchName: bName,
          paymentBreakdown: { online: 0, cash: 0, upi: 0 }
        };
      }
      branchStats[bName].registrations += 1;
    });

    fees.forEach(fee => {
      const amount = Number(fee.amount) || 0;
      totalFeeCollected += amount;

      if (fee.feeType === "registration") totalRegistrationFees += amount;

      const mode = fee.mode?.toLowerCase() || "";
      if (mode.includes("cash")) cashCollection += amount;
      else if (mode.includes("upi_qr") || mode.includes("upi")) upiCollection += amount;
      else onlineCollection += amount; // everything else as online

      const bName = fee.branchDetails?.name || "Unknown";
      if (!branchStats[bName]) branchStats[bName] = { 
        registrations: 0, 
        fees: 0, 
        branchName: bName,
        paymentBreakdown: { online: 0, cash: 0, upi: 0 }
      };
      branchStats[bName].fees += amount;
      
      if (mode.includes("cash")) branchStats[bName].paymentBreakdown.cash += amount;
      else if (mode.includes("upi_qr") || mode.includes("upi")) branchStats[bName].paymentBreakdown.upi += amount;
      else branchStats[bName].paymentBreakdown.online += amount;
    });

    const branchDataArray = Object.values(branchStats);

    return res.status(200).json({
      success: true,
      data: {
        totalRegistrations,
        totalFeeCollected,
        totalRegistrationFees,
        onlineCollection,
        cashCollection,
        upiCollection,
        branchWise: branchDataArray,
        transactions: fees.map(f => ({
          _id: f._id,
          amount: f.amount,
          mode: f.mode,
          feeType: f.feeType,
          status: f.status,
          date: f.createdAt,
          studentName: f.registration?.studentName,
          mobile: f.registration?.mobile,
          branchName: f.branchDetails?.name,
        })),
      }
    });

  } catch (error) {
    console.error("Report Generation Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
