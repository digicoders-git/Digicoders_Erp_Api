import Assignment from "../models/assignment.js";
import Submission from "../models/submission.js";
import Batch from "../models/batchs.js";
import { getBatchByStudentId } from "./batchController.js";

// Get all assignments
export const getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("batches", "batchName")
      .populate({
        path: "submissions",
        populate: [
          { path: "student", select: "studentName email" },
          { path: "batch", select: "batchName" },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      assignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get assignment by ID
export const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("batches", "batchName")
      .populate({
        path: "submissions",
        populate: [
          { path: "student", select: "studentName email" },
          { path: "batch", select: "batchName" },
        ],
      });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new assignment
export const createAssignment = async (req, res) => {
  try {
    const { title, description, batches, dueDate, maxMarks } = req.body;

    // Validate required fields
    if (!title || !description || !batches || !dueDate || !maxMarks) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    let batchIds;

    // multer + formData case
    if (Array.isArray(batches)) {
      batchIds = batches;
    } else if (typeof batches === "string") {
      batchIds = [batches];
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid batches format",
      });
    }

    // Check if batches exist
    const existingBatches = await Batch.find({ _id: { $in: batchIds } });
    if (existingBatches.length !== batchIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more batches not found",
      });
    }

    // Handle file uploads - FIXED
    const assignmentFiles = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        assignmentFiles.push({
          name: file.originalname,
          url: `/uploads/${file.filename}`,
          publicId: file.filename,
          type: file.mimetype,
        });
      });
    }

    // Create assignment
    const assignment = new Assignment({
      title,
      description,
      batches: batchIds,
      dueDate,
      maxMarks,
      assignmentFiles, // अब यह properly formatted array है
      createdBy: req.user.id,
    });

    await assignment.save();

    // Populate batches for response
    await assignment.populate("batches", "batchName");

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      assignment,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update assignment
export const updateAssignment = async (req, res) => {
  try {
    const { title, description, batches, dueDate, maxMarks } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Update fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = dueDate;
    if (maxMarks) assignment.maxMarks = maxMarks;

    // Handle batches update
    if (batches) {
      const batchIds = Array.isArray(batches) ? batches : JSON.parse(batches);
      const existingBatches = await Batch.find({ _id: { $in: batchIds } });

      if (existingBatches.length !== batchIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more batches not found",
        });
      }

      assignment.batches = batchIds;
    }

    // Handle file uploads
    if (req.files && req.files.assignmentFiles) {
      const files = Array.isArray(req.files.assignmentFiles)
        ? req.files.assignmentFiles
        : [req.files.assignmentFiles];

      files.forEach((file) => {
        assignment.assignmentFiles.push({
          name: file.originalname,
          url: `/uploads/${file.filename}`,
          publicId: file.filename,
          type: file.mimetype,
        });
      });
    }

    await assignment.save();
    await assignment.populate("batches", "batchName");

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete assignment
export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Delete associated files from Cloudinary
    if (assignment.assignmentFiles.length > 0) {
      for (const file of assignment.assignmentFiles) {
        if (file.publicId) {
          await deleteFile(file.publicId);
        }
      }
    }

    // Delete all submissions for this assignment
    const submissions = await Submission.find({ assignment: req.params.id });
    for (const submission of submissions) {
      if (submission.submittedFile && submission.submittedFile.publicId) {
        await deleteFile(submission.submittedFile.publicId);
      }
    }
    await Submission.deleteMany({ assignment: req.params.id });

    // Delete the assignment
    await Assignment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove file from assignment
export const removeFileFromAssignment = async (req, res) => {
  try {
    const { assignmentId, fileIndex } = req.params;
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    if (fileIndex >= assignment.assignmentFiles.length) {
      return res.status(400).json({
        success: false,
        message: "File index out of range",
      });
    }

    // Delete the file from Cloudinary
    const fileToRemove = assignment.assignmentFiles[fileIndex];
    if (fileToRemove.publicId) {
      await deleteFile(fileToRemove.publicId);
    }

    // Remove the file from the array
    assignment.assignmentFiles.splice(fileIndex, 1);
    await assignment.save();

    res.status(200).json({
      success: true,
      message: "File removed successfully",
      assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const studentGetAllAssignments = async (req, res) => {
  try {
    const student = req.student;
    // Student ke saare batches find karo
    const batches = await Batch.find({ students: student._id }).select(
      "_id batchName"
    );

    if (!batches || batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No batches found for this student",
      });
    }
    // Batch IDs extract karo
    const batchIds = batches.map((batch) => batch._id);

    // Assignments find karo jo in batches me hain
    const assignments = await Assignment.find({
      batches: { $in: batchIds },
    }).populate("batches", "batchName").populate("submissions");

    return res.status(200).json({
      success: true,
      batches: batches.map((b) => b),
      assignments,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Submit assignment
export const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, batchId, description, submissionUrl } = req.body;
    const student = req.student;

    console.log("Submit request body:", req.body);
    console.log("Logged in student:", student);

    if (!assignmentId || !batchId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and Batch ID are required",
      });
    }

    if (!req.file && !submissionUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file or provide a submission URL",
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Check if valid batch
    if (!assignment.batches.some(b => b.toString() === batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch for this assignment",
      });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: student._id,
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this assignment",
      });
    }

    const submissionData = {
      assignment: assignmentId,
      student: student._id,
      batch: batchId,
      description,
      submissionUrl,
      submittedAt: new Date(),
    };

    if (req.file) {
      submissionData.submittedFile = {
        name: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        publicId: req.file.filename,
        type: req.file.mimetype,
      };
    }

    const submission = new Submission(submissionData);
    await submission.save();

    // Add submission to assignment
    assignment.submissions.push(submission._id);
    await assignment.save();

    res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      submission,
    });
  } catch (error) {
    console.error("Submit assignment error DETAILS:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Grade assignment (Add marks and feedback)
export const gradeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { batchId, grades } = req.body;

    if (!batchId || !grades || !Array.isArray(grades)) {
      return res.status(400).json({
        success: false,
        message: "Batch ID and grades are required",
      });
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Process each grade
    for (const grade of grades) {
      const { studentId, marks, remarks } = grade;

      // Find if submission already exists
      let submission = await Submission.findOne({
        assignment: id,
        student: studentId,
      });

      if (!submission) {
        // Create a new submission record for grading if it doesn't exist
        submission = new Submission({
          assignment: id,
          student: studentId,
          batch: batchId,
          marks: marks,
          feedback: remarks,
          graded: true,
          gradedBy: req.user.id,
          gradedAt: new Date(),
        });
        await submission.save();

        // Add submission reference to assignment
        assignment.submissions.push(submission._id);
      } else {
        // Update existing submission
        submission.marks = marks;
        submission.feedback = remarks;
        submission.graded = true;
        submission.gradedBy = req.user.id;
        submission.gradedAt = new Date();
        await submission.save();
      }
    }

    await assignment.save();

    // Fetch updated assignment with populated data for the frontend
    const updatedAssignment = await Assignment.findById(id)
      .populate("batches", "batchName")
      .populate({
        path: "submissions",
        populate: [
          { path: "student", select: "studentName email" },
          { path: "batch", select: "batchName" },
        ],
      });

    res.status(200).json({
      success: true,
      message: "Grades saved successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.error("Grade assignment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
