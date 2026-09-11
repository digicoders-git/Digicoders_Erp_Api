import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import BranchModal from "../models/branch.js";
import QrCode from "../models/qrCode.js";
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

    // Fetch all active QR codes so dropdown & cards show all QRs
    const allQrs = await QrCode.find({ isActive: true }).select("_id name bankName upi");

    // 1. Get Registrations
    const registrations = await Registration.find({
      ...dateFilter,
      ...branchFilter,
    }).populate("branch", "name");

    // 2. Get Fees
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

    feePipeline.push(
      {
        $lookup: {
          from: "branches",
          localField: "registration.branch",
          foreignField: "_id",
          as: "branchDetails",
        }
      },
      { $unwind: { path: "$branchDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "qrcodes",
          localField: "qrcode",
          foreignField: "_id",
          as: "qrcodeDetails",
        }
      },
      { $unwind: { path: "$qrcodeDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "qrcodes",
          localField: "registration.qrcode",
          foreignField: "_id",
          as: "regQrcodeDetails",
        }
      },
      { $unwind: { path: "$regQrcodeDetails", preserveNullAndEmptyArrays: true } }
    );

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
    const branchStats = {};
    
    // QR-wise aggregations - initialize with all active QRs
    const qrStatsMap = {};
    allQrs.forEach((q) => {
      const idStr = q._id.toString();
      qrStatsMap[idStr] = {
        qrcodeId: idStr,
        name: q.name,
        bankName: q.bankName || "",
        upi: q.upi || "",
        totalAmount: 0,
        count: 0,
      };
    });

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

      const feeTypeResolved =
        fee.paymentType ||
        fee.feeType ||
        fee.registration?.paymentType ||
        (fee.installmentNo > 0 ? "installment" : "registration");

      if (feeTypeResolved === "registration") totalRegistrationFees += amount;

      const mode = fee.mode?.toLowerCase() || "";
      if (mode.includes("cash")) cashCollection += amount;
      else if (mode.includes("upi_qr") || mode.includes("upi")) upiCollection += amount;
      else onlineCollection += amount;

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

      // QR Code Tracking (Check fee.qrcodeDetails then registration.qrcodeDetails)
      const effectiveQr = fee.qrcodeDetails || fee.regQrcodeDetails;
      if (effectiveQr) {
        const qrId = effectiveQr._id.toString();
        if (!qrStatsMap[qrId]) {
          qrStatsMap[qrId] = {
            qrcodeId: qrId,
            name: effectiveQr.name || "QR Account",
            bankName: effectiveQr.bankName || "",
            upi: effectiveQr.upi || "",
            totalAmount: 0,
            count: 0,
          };
        }
        qrStatsMap[qrId].totalAmount += amount;
        qrStatsMap[qrId].count += 1;
      }
    });

    const branchDataArray = Object.values(branchStats);
    const qrDataArray = Object.values(qrStatsMap);

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
        qrWise: qrDataArray,
        transactions: fees.map(f => {
          const effectiveQr = f.qrcodeDetails || f.regQrcodeDetails;
          const resolvedFeeType =
            f.paymentType ||
            f.feeType ||
            f.registration?.paymentType ||
            (f.installmentNo > 0 ? "installment" : "registration");

          return {
            _id: f._id,
            amount: f.amount,
            mode: f.mode,
            feeType: resolvedFeeType,
            status: f.status,
            date: f.createdAt,
            tnxId: f.tnxId,
            receiptNo: f.receiptNo,
            studentName: f.registration?.studentName,
            mobile: f.registration?.mobile,
            userid: f.registration?.userid,
            branchName: f.branchDetails?.name,
            qrcode: effectiveQr ? {
              _id: effectiveQr._id,
              name: effectiveQr.name,
              bankName: effectiveQr.bankName,
              upi: effectiveQr.upi,
            } : null,
          };
        }),
      }
    });

  } catch (error) {
    console.error("Report Generation Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
