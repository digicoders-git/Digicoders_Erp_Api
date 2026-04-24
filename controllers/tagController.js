import Tag from "../models/tag.js";
import mongoose from "mongoose";

// Create - Add new tag
export const addTag = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Tag name is required",
            });
        }
        const existingTag = await Tag.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existingTag) {
            return res.status(400).json({
                success: false,
                message: "Tag with this name already exists",
            });
        }
        const newTag = new Tag({
            name,
            addedBy: req.user._id
        });
        await newTag.save();

        res.status(201).json({
            success: true,
            message: "Tag added successfully",
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to add tag",
            error: error.message,
        });
    }
};

// Read - Get single tag by ID
export const getTag = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tag ID format",
            });
        }

        const tag = await Tag.findById(id).populate("addedBy", "name email");

        if (!tag) {
            return res.status(404).json({
                success: false,
                message: "Tag not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Tag fetched successfully",
            data: tag,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get tag",
            error: error.message,
        });
    }
};

// Read - Get all tags with pagination, search, and sort
export const getAllTags = async (req, res) => {
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
        const totalCount = await Tag.countDocuments(filter);

        // Query with pagination
        const tags = await Tag.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNumber)
            .populate("addedBy", "name");

        return res.status(200).json({
            success: true,
            message: "Tags fetched successfully",
            data: tags,
            pagination: {
                currentPage: pageNumber,
                totalPages: Math.ceil(totalCount / limitNumber),
                totalRecords: totalCount,
            },
        });
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get tags",
            error: error.message,
        });
    }
};

// Update - Update tag by ID
export const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tag ID format",
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
            const existingTag = await Tag.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
            if (existingTag && existingTag._id.toString() !== id) {
                return res.status(400).json({
                    success: false,
                    message: "Tag with this name already exists",
                });
            }
        }

        const updatedTag = await Tag.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedTag) {
            return res.status(404).json({
                success: false,
                message: "Tag not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Tag updated successfully",
            data: updatedTag
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to update tag",
            error: error.message,
        });
    }
};

// Delete - Delete tag by ID
export const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tag ID format",
            });
        }

        const deletedTag = await Tag.findByIdAndDelete(id);

        if (!deletedTag) {
            return res.status(404).json({
                success: false,
                message: "Tag not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Tag deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete tag",
            error: error.message,
        });
    }
};
