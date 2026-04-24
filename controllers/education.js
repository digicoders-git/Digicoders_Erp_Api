import Education from "../models/education.js";
import mongoose from "mongoose";

// Create - Add new education
export const addEducation = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }
    const existingEducation = await Education.findOne({ name ,addedBy:req.user._id });
    if (existingEducation) {
      return res.status(400).json({
        success: false,
        message: "Education with this name already exists",
      });
    }
    const newEducation = new Education({ name });
    const savedEducation = await newEducation.save();

    res.status(201).json({
      success: true,
      message: "Education added successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to add education",
      error: error.message,
    });
  }
};

// Read - Get single education by ID
export const getEducation = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid education ID format",
      });
    }

    const education = await Education.findById(id);
    
    if (!education) {
      return res.status(404).json({
        success: false,
        message: "Education not found",
      });
    }

    res.status(200).json({
      success: true,
      data: education,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get education",
      error: error.message,
    });
  }
};

// // Read - Get all educations with pagination
// export const getAllEducations = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search = "" } = req.query;
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const query = {};
//     if (search) {
//       query.name = { $regex: search, $options: "i" };
//     }

//     const educations = await Education.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Education.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       data: educations,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: Math.ceil(total / limitNum),
//         totalRecords: total,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to get educations",
//       error: error.message,
//     });
//   }
// };
export const getAllEducations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    // Handle filters
    const excludeFields = ["page", "limit", "search", "sortBy", "sortOrder"];
    const filters = { ...req.query };
    excludeFields.forEach((field) => delete filters[field]);
    // Handle boolean isActive filter explicitly if sent as string
    if (filters.isActive !== undefined) {
         if (filters.isActive === 'true' || filters.isActive === 'Active') query.isActive = true;
         if (filters.isActive === 'false' || filters.isActive === 'Inactive') query.isActive = false;
         delete filters.isActive;
    }
    // Add remaining dynamic filters
    Object.keys(filters).forEach((key) => {
       if (filters[key] && filters[key] !== "All") {
         query[key] = filters[key];
       }
    });
    const educations = await Education.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Education.countDocuments(query);
    res.status(200).json({
      success: true,
      data: educations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get educations",
      error: error.message,
    });
  }
};
// Update - Update education by ID
export const updateEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid education ID format",
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
      const existingEducation = await Education.findOne({ name });
      if (existingEducation && existingEducation._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Education with this name already exists",
        });
      }
    }

    const updatedEducation = await Education.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEducation) {
      return res.status(404).json({
        success: false,
        message: "Education not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Education updated successfully",

    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update education",
      error: error.message,
    });
  }
};

// Delete - Delete education by ID
export const deleteEducation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid education ID format",
      });
    }

    const deletedEducation = await Education.findByIdAndDelete(id);

    if (!deletedEducation) {
      return res.status(404).json({
        success: false,
        message: "Education not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Education deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete education",
      error: error.message,
    });
  }
};