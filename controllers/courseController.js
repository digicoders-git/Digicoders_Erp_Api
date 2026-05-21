import Course from "../models/courseModel.js";
import Registration from "../models/regsitration.js";

// @desc    Get all courses with pagination and filters
// @route   GET /api/course
export const getAllCourses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "",
      sortBy = "createdAt", 
      sortOrder = "desc",
      status 
    } = req.query;

    // Build filter
    const filter = {};
    
    // Search filter
    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: "i" };
    }
    
    // Status filter
    if (status) {
      filter.isActive = status === "true";
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get total count and courses
    const [total, courses] = await Promise.all([
      Course.countDocuments(filter),
      Course.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
    ]);

    // Get registration counts for each course (Note: Courses are not directly linked to registrations)
    // This is a placeholder - you may need to adjust based on your actual course-registration relationship
    const coursesWithCounts = await Promise.all(
      courses.map(async (course) => {
        // Since courses are not directly linked to registrations in the current schema,
        // we'll set registrationCount to 0 for now
        // You can modify this logic based on your actual requirements
        const registrationCount = 0;
        
        return {
          ...course.toObject(),
          registrationCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: coursesWithCounts,
      pagination: {
        totalCount: total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      },
      message: "Courses fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get single course by ID
// @route   GET /api/course/:id
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: course,
      message: "Course fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Create new course
// @route   POST /api/course
export const createCourse = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    // Check if course already exists
    const existingCourse = await Course.findOne({ name });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: "Course with this name already exists",
      });
    }

    // Create course
    const course = new Course({
      name,
      isActive: isActive !== undefined ? isActive : true,
    });

    await course.save();

    res.status(201).json({
      success: true,
      data: course,
      message: "Course created successfully",
    });
  } catch (error) {
    console.error("Error creating course:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Course with this name already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update course
// @route   PUT /api/course/:id
export const updateCourse = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const { id } = req.params;

    // Check if course exists
    let course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== course.name) {
      const existingCourse = await Course.findOne({ name });
      if (existingCourse && existingCourse._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Course with this name already exists",
        });
      }
    }

    // Update course
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    course = await Course.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: course,
      message: "Course updated successfully",
    });
  } catch (error) {
    console.error("Error updating course:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Course with this name already exists",
      });
    }
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/course/:id
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    await Course.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};