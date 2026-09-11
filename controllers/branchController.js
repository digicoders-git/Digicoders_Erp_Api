import Branch from "../models/branch.js";
import Registration from "../models/regsitration.js";
import mongoose from "mongoose";

// Create - Add new branch
export const addBranch = async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Branch name is required",
      });
    }
    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: "Branch with this name already exists",
      });
    }
    const newBranch = new Branch({ name, location, addedBy:req.user._id });
    const savedBranch = await newBranch.save();

    res.status(201).json({
      success: true,
      message: "Branch added successfully",

    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to add branch",
      error: error.message,
    });
  }
};

// Read - Get single branch by ID
export const getBranch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID format",
      });
    }

    const branch = await Branch.findById(id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Branch fetched successfully",
      data: branch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get branch",
      error: error.message,
    });
  }
};

// Read - Get all branches with pagination
// export const getAllBranches = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search = "" } = req.query;
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const query = {};
//     if (search) {
//       query.name = { $regex: search, $options: "i" };
//     }

//     const branches = await Branch.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Branch.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       message: "Branches fetched successfully",
//       data: branches,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: Math.ceil(total / limitNum),
//         totalRecords: total,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to get branches",
//       error: error.message,
//     });
//   }
// };
export const getAllBranches = async (req, res) => {
  try {
    const { 
      search, 
      isActive, 
      sortBy = "createdAt", 
      sortOrder = "desc",
      page = 1,
      limit = 1000,
      eduYear // Add eduYear filter
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "name", "isActive", "createdAt", "updatedAt"
    ];
    
    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await Branch.countDocuments(filter);

    // Query with pagination
    const branches = await Branch.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);

    // Get registration counts for each branch with eduYear filter
    const branchesWithCounts = await Promise.all(
      branches.map(async (branch) => {
        const registrationQuery = {
          branch: branch._id,
          status: { $in: ["accepted", "new", "pending"] }
        };
        
        // Add eduYear filter if provided
        if (eduYear && eduYear !== "All" && eduYear !== "") {
          registrationQuery.eduYear = eduYear;
        }
        
        const registrationCount = await Registration.countDocuments(registrationQuery);
        
        return {
          ...branch.toObject(),
          registrationCount
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Branches fetched successfully",
      data: branchesWithCounts,
      count: branchesWithCounts.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        totalRecords: totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get branches",
      error: error.message,
    });
  }
};
// Update - Update branch by ID
export const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID format",
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (typeof location !== "undefined") updateData.location = location;
    if (typeof isActive !== "undefined") updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided for update",
      });
    }

    // Check if new name already exists
    if (name) {
      const existingBranch = await Branch.findOne({ name });
      if (existingBranch && existingBranch._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Branch with this name already exists",
        });
      }
    }

    const updatedBranch = await Branch.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedBranch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Branch updated successfully",

    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update branch",
      error: error.message,
    });
  }
};

// Delete - Delete branch by ID
export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID format",
      });
    }

    const deletedBranch = await Branch.findByIdAndDelete(id);

    if (!deletedBranch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Branch deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete branch",
      error: error.message,
    });
  }
};

// 📊 Branch Performance & Month-to-Month Progress Comparison Report
export const getBranchPerformanceReport = async (req, res) => {
  try {
    const { branchId, monthsCount = 4 } = req.query;
    const numMonths = Math.max(1, Math.min(12, parseInt(monthsCount) || 4));

    const allBranches = await Branch.find({ isActive: true });
    
    // Determine target branches
    let targetBranches = allBranches;
    if (branchId && branchId !== "all") {
      targetBranches = allBranches.filter(b => b._id.toString() === branchId);
    }

    // Build last N months array (e.g., current month back N months)
    const monthList = [];
    const now = new Date();
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      monthList.push({
        key: monthKey,
        label: monthLabel,
        start: monthStart,
        end: monthEnd
      });
    }

    // Import Fee & Registration models dynamically if needed
    const Registration = (await import("../models/regsitration.js")).default;
    const Fee = (await import("../models/fee.js")).default;

    const reportData = [];

    for (const b of targetBranches) {
      const branchStats = {
        branchId: b._id,
        branchName: b.name,
        location: b.location,
        totalStudentsAllTime: 0,
        totalCollectionAllTime: 0,
        monthlyBreakdown: []
      };

      // All time totals for branch
      const totalStudents = await Registration.countDocuments({ 
        branch: b._id, 
        status: { $in: ["accepted", "new", "pending"] } 
      });
      branchStats.totalStudentsAllTime = totalStudents;

      // Fees for branch registrations
      const branchRegistrations = await Registration.find({ branch: b._id }).select("_id");
      const branchRegIds = branchRegistrations.map(r => r._id);

      const feeAggregate = await Fee.aggregate([
        {
          $match: {
            registrationId: { $in: branchRegIds },
            $or: [{ status: "accepted" }, { tnxStatus: "paid" }, { tnxStatus: "full paid" }]
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } }
          }
        }
      ]);
      branchStats.totalCollectionAllTime = feeAggregate[0]?.total || 0;

      // Monthly breakdown
      for (let idx = 0; idx < monthList.length; idx++) {
        const m = monthList[idx];

        // Registrations in month
        const mStudentCount = await Registration.countDocuments({
          branch: b._id,
          createdAt: { $gte: m.start, $lte: m.end },
          status: { $in: ["accepted", "new", "pending"] }
        });

        // Fee collections in month
        const mFeeAggregate = await Fee.aggregate([
          {
            $match: {
              registrationId: { $in: branchRegIds },
              createdAt: { $gte: m.start, $lte: m.end },
              $or: [{ status: "accepted" }, { tnxStatus: "paid" }, { tnxStatus: "full paid" }]
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } }
            }
          }
        ]);
        const mCollection = mFeeAggregate[0]?.total || 0;

        // Calculate progress % compared to previous month in monthList
        let growthPercent = 0;
        if (idx > 0) {
          const prevCollection = branchStats.monthlyBreakdown[idx - 1].collection;
          if (prevCollection > 0) {
            growthPercent = (((mCollection - prevCollection) / prevCollection) * 100).toFixed(1);
          } else if (mCollection > 0) {
            growthPercent = 100;
          }
        }

        branchStats.monthlyBreakdown.push({
          monthKey: m.key,
          monthLabel: m.label,
          admissions: mStudentCount,
          collection: mCollection,
          growthPercent: Number(growthPercent)
        });
      }

      reportData.push(branchStats);
    }

    return res.status(200).json({
      success: true,
      message: "Branch performance report generated successfully",
      monthList: monthList.map(m => ({ key: m.key, label: m.label })),
      branches: allBranches.map(b => ({ _id: b._id, name: b.name })),
      data: reportData
    });

  } catch (error) {
    console.error("Error generating branch performance report:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating branch performance report",
      error: error.message
    });
  }
};
