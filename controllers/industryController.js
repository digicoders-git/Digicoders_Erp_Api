import Industry from "../models/industry.js";
import mongoose from "mongoose";

// Create - Add new industry
export const addIndustry = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Industry name is required",
            });
        }
        const existingIndustry = await Industry.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existingIndustry) {
            return res.status(400).json({
                success: false,
                message: "Industry with this name already exists",
            });
        }
        const newIndustry = new Industry({
            name,
            addedBy: req.user?._id
        });
        await newIndustry.save();

        res.status(201).json({
            success: true,
            message: "Industry added successfully",
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to add industry",
            error: error.message,
        });
    }
};

// Read - Get single industry by ID
export const getIndustry = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid industry ID format",
            });
        }

        const industry = await Industry.findById(id).populate("addedBy", "name email");

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: "Industry not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Industry fetched successfully",
            data: industry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get industry",
            error: error.message,
        });
    }
};

// Read - Get all industries with pagination, search, and sort
export const getAllIndustries = async (req, res) => {
    try {
        const {
            search,
            isActive,
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 10
        } = req.query;

        const filter = {};

        // Search filter
        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        // Active status filter
        if (isActive !== undefined && isActive !== "" && isActive !== "All") {
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
        const totalCount = await Industry.countDocuments(filter);

        // Query with pagination
        const industries = await Industry.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNumber)
            .populate("addedBy", "name");

        return res.status(200).json({
            success: true,
            message: "Industries fetched successfully",
            data: industries,
            pagination: {
                currentPage: pageNumber,
                totalPages: Math.ceil(totalCount / limitNumber),
                totalRecords: totalCount,
            },
        });
    } catch (error) {
        console.error("Error fetching industries:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get industries",
            error: error.message,
        });
    }
};

// Update - Update industry by ID
export const updateIndustry = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid industry ID format",
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
            const existingIndustry = await Industry.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
            if (existingIndustry && existingIndustry._id.toString() !== id) {
                return res.status(400).json({
                    success: false,
                    message: "Industry with this name already exists",
                });
            }
        }

        const updatedIndustry = await Industry.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedIndustry) {
            return res.status(404).json({
                success: false,
                message: "Industry not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Industry updated successfully",
            data: updatedIndustry
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to update industry",
            error: error.message,
        });
    }
};

// Delete - Delete industry by ID
export const deleteIndustry = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid industry ID format",
            });
        }

        const deletedIndustry = await Industry.findByIdAndDelete(id);

        if (!deletedIndustry) {
            return res.status(404).json({
                success: false,
                message: "Industry not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Industry deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete industry",
            error: error.message,
        });
    }
};
