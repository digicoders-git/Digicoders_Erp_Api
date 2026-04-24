import Duration from "../models/durationModel.js";

// @desc    Get all durations
// @route   GET /api/duration
export const getAllDurations = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit, 
            sortBy = "createdAt", 
            sortOrder = "desc",
            search,
            status // For status filter
        } = req.query;
        
        // Build filter object
        const filter = {};
        
        // Search filter
        if (search && search.trim()) {
            filter.name = { $regex: search.trim(), $options: "i" };
        }
        
        // Status filter
        if (status) {
            filter.isActive = status === "true";
        }
        
        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        
        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === "asc" ? 1 : -1;
        
        // Execute queries
        const [total, durations] = await Promise.all([
            Duration.countDocuments(filter),
            Duration.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
        ]);
        
        res.status(200).json({
            success: true,
            data: durations,
            pagination: {
                totalCount: total,
                totalPages: Math.ceil(total / limitNum),
                currentPage: pageNum,
                limit: limitNum
            },
            message: "Durations fetched successfully",
        });
    } catch (error) {
        console.error("Error fetching durations:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// @desc    Create new duration
// @route   POST /api/duration
export const createDuration = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const { action } = req.query; // For frontend compatibility
    
    // Check if duration already exists
    const existingDuration = await Duration.findOne({ name });
    if (existingDuration) {
      return res.status(400).json({
        success: false,
        message: "Duration with this name already exists",
      });
    }
    
    // Create duration
    const duration = new Duration({
      name,
      isActive: isActive !== undefined ? isActive : true,
    });
    
    await duration.save();
    
    res.status(201).json({
      success: true,
      data: duration,
      message: "Duration created successfully",
    });
  } catch (error) {
    console.error("Error creating duration:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duration with this name already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update duration
// @route   PUT /api/duration/:id
export const updateDuration = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const { id } = req.params;
    const { action } = req.query; // For frontend compatibility
    
    // Check if duration exists
    let duration = await Duration.findById(id);
    if (!duration) {
      return res.status(404).json({
        success: false,
        message: "Duration not found",
      });
    }
    
    // Check if name is being changed and if new name already exists
    if (name && name !== duration.name) {
      const existingDuration = await Duration.findOne({ name });
      if (existingDuration && existingDuration._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Duration with this name already exists",
        });
      }
    }
    
    // Update duration
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    duration = await Duration.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: duration,
      message: "Duration updated successfully",
    });
  } catch (error) {
    console.error("Error updating duration:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duration with this name already exists",
      });
    }
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Duration not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Delete duration
// @route   DELETE /api/duration/:id
export const deleteDuration = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.query; // For frontend compatibility
    
    // Check if duration exists
    const duration = await Duration.findById(id);
    if (!duration) {
      return res.status(404).json({
        success: false,
        message: "Duration not found",
      });
    }
    
    await Duration.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: "Duration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting duration:", error);
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Duration not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};