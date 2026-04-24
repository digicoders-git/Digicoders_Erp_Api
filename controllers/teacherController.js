import Teacher from "../models/teachers.js";
import Batch from "../models/batchs.js";

// ➤ Create Teacher
export const createTeacher = async (req, res) => {
  try {
    const { name, phone, expertise, branch } = req.body;

    // Basic validation
    if (!name || !phone || !branch) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, and expertise are required",
      });
    }

    const teacher = new Teacher({
      name,
      phone,
      expertise,
      branch,
      addBy: req.user._id, // logged-in user who added the teacher
    });

    await teacher.save();

    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating teacher",
      error: error.message,
    });
  }
};

// ➤ Get All Teachers
// export const getTeachers = async (req, res) => {
//   try {
//     const teachers = await Teacher.find().populate("assignedBatches").populate("branch","name")
//     res.json({ success: true, teachers });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
export const getTeachers = async (req, res) => {
  try {
    const {
      search,
      branch,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10
    } = req.query;
    const loggedInUser = req.user;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    // Branch filter
    if (branch && branch !== "All") {
      filter.branch = branch;
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "name", "phone", "isActive", "createdAt", "updatedAt"
    ];

    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await Teacher.countDocuments(filter);

    // Query with pagination
    const teachers = await Teacher.find(filter)
      .populate("assignedBatches")
      .populate("branch", "name isActive")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      success: true,
      message: "Successfully fetched teachers",
      count: teachers.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      teachers,
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching teachers",
      error: error.message
    });
  }
};
// ➤ Get Teacher By Id
export const getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate(
      "assignedBatches",
      "batchName trainingType startDate"
    );
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });

    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ➤ Assign Batch to Teacher
export const assignBatchToTeacher = async (req, res) => {
  try {
    const { teacherId, batchId } = req.body;

    const teacher = await Teacher.findById(teacherId);
    const batch = await Batch.findById(batchId);

    if (!teacher || !batch) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher or Batch not found" });
    }

    // Avoid duplicate batch assignment
    if (!teacher.assignedBatches.includes(batchId)) {
      teacher.assignedBatches.push(batchId);
      await teacher.save();
    }

    // Update teacher in batch
    batch.teacher = teacherId;
    await batch.save();

    res.json({
      success: true,
      message: "Batch assigned to teacher",
      teacher,
      batch,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ➤ Delete Teacher
export const deleteTeacher = async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Teacher deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // Updated document return karega
      runValidators: true, // Validation apply karega
    })



    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating teacher",
      error: error.message,
    });
  }
};


export const getTeacherByBranch = async (req, res) => {
  try {
    const teacher = await Teacher.find({ branch: req.params.id, isActive: true })
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });

    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
