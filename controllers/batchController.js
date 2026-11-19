import Batch from "../models/batchs.js";
import Teacher from "../models/teachers.js";
import Registration from "../models/regsitration.js"; // Student Model
import mongoose from "mongoose";

// Helper function to check if user has access to a branch
const isBranchAllowed = (user, branchId) => {
  if (!user) return false;
  if (user.role === "Super Admin") return true;

  const targetBranchStr = branchId?._id?.toString() || branchId?.toString();
  if (!targetBranchStr) return false;

  // Special branch access for Ankul (email: ankul@gmail.com) to access both Aliganj & Online branches
  if (user.email === "ankul@gmail.com") {
    const allowedBranches = ["69eb32bc8e8bb1433f7cbc25", "69eb32d28e8bb1433f7cbc4e"];
    return allowedBranches.includes(targetBranchStr);
  }

  const userBranchId = user.branch?._id?.toString() || user.branch?.toString();
  return targetBranchStr === userBranchId;
};

// ➤ Create Batch
export const createBatch = async (req, res) => {
  try {
    const { batchName, startDate, teacher, branch, room, classTime, subject, wpLink, gmeetLink } = req.body;

    // Validation
    if (!batchName || !startDate || !teacher || !branch || !classTime || !subject) {
      return res.status(400).json({
        success: false,
        message:
          "All fields (batchName, room, classTime, subject, startDate, teacher, branch) are required",
      });
    }

    // (Optional) Check for duplicate batch name in the same branch
    const existingBatch = await Batch.findOne({ batchName, branch });
    if (existingBatch) {
      return res.status(400).json({
        success: false,
        message: "A batch with this name already exists in this branch",
      });
    }

    if (!isBranchAllowed(req.user, branch)) {
      return res.status(403).json({
        success: false,
        message: "You can only create batches for your own branch",
      });
    }

    const batch = new Batch({
      batchName,
      room,
      classTime,
      subject,
      startDate,
      teacher,
      branch,
      wpLink,
      gmeetLink,
      addBy: req.user._id,
    });

    await batch.save();

    res.status(201).json({
      success: true,
      message: "Batch created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating batch",
      error: error.message,
    });
  }
};

// ➤ Get All Batches
// export const getBatches = async (req, res) => {
//   try {
//     const batches = await Batch.find()
//       .populate("teacher", "name email")
//       .populate("trainingType", "name duration")
//       .populate("branch", "name")
//       .populate({
//         path: "students",
//         select:
//           "studentName email mobile fatherName technology status dueAmount",
//         populate: {
//           path: "technology",
//           select: "name", // sirf name chahiye to ye
//         },
//       })
//       .sort({ createdAt: -1 });
//     res.json({ success: true, batches });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
export const getBatches = async (req, res) => {
  try {
    const {
      search,
      branch,
      teacher,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;
    const loggedInUser = req.user;
    const sessionYear = req.headers["x-session-year"] || req.query.sessionYear;

    const filter = {};

    // Session Year filter
    if (sessionYear && sessionYear !== "All" && sessionYear !== "") {
      const yearInt = parseInt(sessionYear, 10);
      if (!isNaN(yearInt)) {
        const start = new Date(`${yearInt}-01-01T00:00:00.000Z`);
        const end = new Date(`${yearInt}-12-31T23:59:59.999Z`);
        filter.startDate = { $gte: start, $lte: end };
      }
    }


    // Search filter
    if (search) {
      filter.$or = [{ batchName: { $regex: search, $options: "i" } }];
    }

    // 🔐 Role based branch/teacher restriction
    if (loggedInUser.role === "Employee" || loggedInUser.role === "Admin") {
      if (loggedInUser.email === "ankul@gmail.com") {
        filter.branch = {
          $in: [
            new mongoose.Types.ObjectId("69eb32bc8e8bb1433f7cbc25"),
            new mongoose.Types.ObjectId("69eb32d28e8bb1433f7cbc4e")
          ]
        };
      } else if (loggedInUser.role === "Employee") {
        // Find if this employee is also a teacher (by phone)
        const teacherDoc = await Teacher.findOne({ phone: loggedInUser.phone, isActive: true });
        
        // If they are a teacher BUT do NOT have 'manage_batch' permission, restrict to their batches
        if (teacherDoc && (!loggedInUser.permissions || !loggedInUser.permissions.includes("manage_batch"))) {
          filter.teacher = teacherDoc._id;
        } else {
          // Otherwise (if they are not a teacher OR if they have manage_batch permission), they see all batches in their branch
          filter.branch = loggedInUser.branch?._id || loggedInUser.branch;
        }
      } else {
        filter.branch = loggedInUser.branch?._id || loggedInUser.branch;
      }
    } else {
      // super admin / others → query param branch
      if (branch && branch !== "All") {
        filter.branch = branch;
      }
    }

    // Teacher filter (only if not already forced to own batches)
    if (!filter.teacher && teacher && teacher !== "All") {
      filter.teacher = teacher;
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "batchName",
      "startDate",
      "isActive",
      "createdAt",
      "updatedAt",
    ];

    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await Batch.countDocuments(filter);

    // Query with pagination
    const batches = await Batch.find(filter)
      .populate("teacher", "name email")
      .populate("trainingType", "name duration")
      .populate("branch", "name")
      .populate({
        path: "students",
        select:
          "studentName email mobile fatherName technology status totalFee finalFee paidAmount dueAmount nextDueDate dueRemark createdAt",
        populate: {
          path: "technology",
          select: "name",
        },
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      success: true,
      message: "Successfully fetched batches",
      count: batches.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      batches,
    });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching batches",
      error: error.message,
    });
  }
};
// ➤ Get Single Batch
export const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate("teacher", "name email")
      .populate({
        path: "students",
        select: "studentName email mobile technology training branch fatherName status totalFee finalFee paidAmount dueAmount nextDueDate dueRemark createdAt",
        populate: [
          {
            path: "technology",
            select: "name"
          },
          {
            path: "training", 
            select: "name"
          },
          {
            path: "branch",
            select: "name"
          }
        ]
      });
      
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Batch belongs to another branch."
      });
    }

    // If employee is a teacher, ensure this batch is assigned to them
    if (req.user.role !== "Super Admin" && req.user.role === "Employee") {
      const teacherDoc = await Teacher.findOne({ phone: req.user.phone, isActive: true });
      if (teacherDoc) {
        const isAssigned = batch.teacher && batch.teacher._id.toString() === teacherDoc._id.toString();
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You are not assigned to this batch."
          });
        }
      }
    }

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// ➤ Get Batch by student Id
export const getBatchByStudentId = async (req, res) => {
  try {
    const batch = await Batch.find({ students: req.params.id }).select(
      "batchName startDate"
    );

    if (!batch || batch.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });
    }

    return res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ➤ Update Batch
export const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if batch exists
    let batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update batches in your own branch."
      });
    }
    if (req.body.branch && !isBranchAllowed(req.user, req.body.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot change batch branch to another branch."
      });
    }

    // Update batch
    batch = await Batch.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating batch",
      error: error.message,
    });
  }
};

// ➤ Assign Teacher to Batch
export const assignTeacher = async (req, res) => {
  try {
    const { batchId, teacherId } = req.body;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only assign teachers to batches in your own branch."
      });
    }

    batch.teacher = teacherId;
    await batch.save();
    
    const updatedBatch = await Batch.findById(batchId).populate("teacher", "name email");

    res.json({ success: true, message: "Teacher assigned", batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ➤ Update Students in Batch (Add/Remove Multiple)
export const updateBatchStudents = async (req, res) => {
  try {
    const { batchId } = req.params;
    let { studentIds } = req.body;

    // Validate input
    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({
        success: false,
        message: "studentIds array is required",
      });
    }

    // Deduplicate and sanitize studentIds
    studentIds = [
      ...new Set(
        studentIds
          .map((id) => (id?._id ? id._id.toString() : id?.toString()))
          .filter(Boolean)
      ),
    ];

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage students for batches in your own branch.",
      });
    }

    // Previous student IDs currently in the batch
    const previousStudentIds = (batch.students || [])
      .map((id) => (id?._id ? id._id.toString() : id?.toString()))
      .filter(Boolean);

    // Identify newly added and removed students
    const addedStudentIds = studentIds.filter((id) => !previousStudentIds.includes(id));
    const removedStudentIds = previousStudentIds.filter((id) => !studentIds.includes(id));

    // For newly added students, verify they exist
    if (addedStudentIds.length > 0) {
      const addedStudents = await Registration.find({
        _id: { $in: addedStudentIds },
      });

      if (addedStudents.length !== addedStudentIds.length) {
        const foundIds = addedStudents.map((s) => s._id.toString());
        const missingIds = addedStudentIds.filter((id) => !foundIds.includes(id));

        return res.status(404).json({
          success: false,
          message: "Some newly added students were not found",
          missingStudents: missingIds,
        });
      }

      // Add batchId to newly added students' Registration profiles
      await Registration.updateMany(
        { _id: { $in: addedStudentIds } },
        {
          $addToSet: {
            batch: batchId,
          },
        }
      );
    }

    // Remove batchId from removed students' Registration profiles
    if (removedStudentIds.length > 0) {
      await Registration.updateMany(
        { _id: { $in: removedStudentIds } },
        {
          $pull: {
            batch: batchId,
          },
        }
      );
    }

    // Replace the students array with the new selection
    batch.students = studentIds;
    await batch.save();

    // Populate the updated batch with full student details
    const updatedBatch = await Batch.findById(batchId)
      .populate("teacher", "name email")
      .populate({
        path: "students",
        select: "studentName email mobile technology training branch fatherName status totalFee finalFee paidAmount dueAmount nextDueDate dueRemark createdAt",
        populate: [
          { path: "technology", select: "name" },
          { path: "training", select: "name" },
          { path: "branch", select: "name" },
        ],
      });

    res.json({
      success: true,
      message: "Batch students updated successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    console.error("Error updating batch students:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Internal server error while updating batch students",
    });
  }
};

// ➤ Remove Student from Batch (Single)
export const removeStudentFromBatch = async (req, res) => {
  try {
    const batchId = req.body?.batchId || req.query?.batchId || req.params?.batchId;
    const studentId = req.body?.studentId || req.query?.studentId || req.params?.studentId;

    if (!batchId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "batchId and studentId are required",
      });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage students for batches in your own branch.",
      });
    }

    const studentIdStr = studentId.toString();

    // Check if student exists in batch (compare ObjectIds as strings)
    const isInBatch = (batch.students || []).some(
      (id) => (id?._id ? id._id.toString() : id?.toString()) === studentIdStr
    );

    if (!isInBatch) {
      return res.status(400).json({
        success: false,
        message: "Student not in this batch",
      });
    }

    // Remove student from batch
    batch.students = (batch.students || []).filter(
      (id) => (id?._id ? id._id.toString() : id?.toString()) !== studentIdStr
    );
    await batch.save();

    // Remove batch from student's Registration profile
    await Registration.findByIdAndUpdate(studentId, {
      $pull: { batch: batchId },
    });

    const updatedBatch = await Batch.findById(batchId)
      .populate("teacher", "name email")
      .populate({
        path: "students",
        select: "studentName email mobile technology training branch fatherName status totalFee finalFee paidAmount dueAmount nextDueDate dueRemark createdAt",
        populate: [
          { path: "technology", select: "name" },
          { path: "training", select: "name" },
          { path: "branch", select: "name" },
        ],
      });

    res.json({
      success: true,
      message: "Student removed from batch successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    console.error("Error removing student from batch:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ➤ Delete Batch
export const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only delete batches in your own branch."
      });
    }

    await Batch.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Batch deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const updateStatus = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch)
      return res
        .status(404)
        .json({ message: "batch not found", success: false });

    if (!isBranchAllowed(req.user, batch.branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only change status of batches in your own branch."
      });
    }

    batch.isActive = !batch.isActive;
    await batch.save();
    return res
      .status(200)
      .json({ message: "status change", success: true, batch });
  } catch (error) {
    return res.status(500).json({ message: error.message, success: false });
  }
};

// ➤ Fix Batch-Student Inconsistencies
export const fixBatchInconsistencies = async (req, res) => {
  try {
    console.log("🔧 Starting batch-student consistency check...");
    
    // Get all batches with their students
    const batches = await Batch.find({}).populate('students', '_id studentName');
    
    let fixedCount = 0;
    
    for (const batch of batches) {
      console.log(`📋 Checking batch: ${batch.batchName} (${batch._id})`);
      
      // For each student in this batch, ensure they have this batch in their batch array
      for (const student of batch.students) {
        const studentDoc = await Registration.findById(student._id);
        
        const hasBatch = studentDoc && (studentDoc.batch || []).some(
          (b) => (b?._id ? b._id.toString() : b?.toString()) === batch._id.toString()
        );

        if (studentDoc && !hasBatch) {
          console.log(`🔧 Adding batch ${batch.batchName} to student ${studentDoc.studentName}`);
          
          await Registration.findByIdAndUpdate(
            student._id,
            { $addToSet: { batch: batch._id } }
          );
          
          fixedCount++;
        }
      }
    }
    
    // Also check for students who have batches that don't include them
    const studentsWithBatches = await Registration.find({ 
      batch: { $exists: true, $ne: [] } 
    }).populate('batch', '_id batchName students');
    
    for (const student of studentsWithBatches) {
      for (const batch of student.batch) {
        const studentIdStr = student._id.toString();
        const isInBatch = batch && (batch.students || []).some(
          (s) => (s?._id ? s._id.toString() : s?.toString()) === studentIdStr
        );

        if (batch && !isInBatch) {
          console.log(`🔧 Adding student ${student.studentName} to batch ${batch.batchName}`);
          
          await Batch.findByIdAndUpdate(
            batch._id,
            { $addToSet: { students: student._id } }
          );
          
          fixedCount++;
        }
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} inconsistencies`);
    
    res.status(200).json({
      success: true,
      message: `Batch consistency check completed. Fixed ${fixedCount} inconsistencies.`,
      fixedCount
    });
    
  } catch (error) {
    console.error("❌ Error fixing batch inconsistencies:", error);
    res.status(500).json({
      success: false,
      message: "Error fixing batch inconsistencies",
      error: error.message
    });
  }
};
