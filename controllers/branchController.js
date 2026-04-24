import Branch from "../models/branch.js";
import mongoose from "mongoose";

// Create - Add new branch
export const addBranch = async (req, res) => {
  try {
    const { name } = req.body;
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
    const newBranch = new Branch({ name,addedBy:req.user._id });
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
      limit = 1000
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

    return res.status(200).json({
      success: true,
      message: "Branches fetched successfully",
      data: branches,
      count: branches.length,
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
    const { name, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID format",
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
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
