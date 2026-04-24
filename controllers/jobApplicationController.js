import Application from "../models/jobApplication.js";
import Job from "../models/Job.js";
import Student from "../models/regsitration.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";

// @desc    Create new application
// @route   POST /api/applications
// @access  Private (Student)
const createApplication = asyncHandler(async (req, res) => {
  const { jobId, coverLetter } = req.body;
  const studentId = req.student.id; // Assuming student ID is available in req.student

  // Check if required fields are provided
  if (!jobId) {
    res.status(400);
    throw new Error("Job ID is required");
  }

  if (!req.file) {
    res.status(400);
    throw new Error("CV file is required");
  }

  // Check if job exists
  const job = await Job.findById(jobId);
  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  // Check if student exists
  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  // Check if student has already applied for this job
  const existingApplication = await Application.findOne({
    job: jobId,
    student: studentId,
  });

  if (existingApplication) {
    res.status(400);
    throw new Error("You have already applied for this job");
  }

  // Create application
  const application = await Application.create({
    job: jobId,
    student: studentId,
    cv: {
      uri: `/uploads/${req.file.filename}`, // Assuming you're using multer or similar for file upload
      public_id: req.file.filename, // Or any identifier you want to store
    },
    coverLetter: coverLetter || "",
    status: "Applied",
  });

  // Populate the created application
  const populatedApplication = await Application.findById(application._id)
    .populate("job", "title company location")
    .populate("student", "name email course");

  res.status(201).json({
    success: true,
    message: "Application submitted successfully",
    data: populatedApplication,
  });
});

// @desc    Get all applications (for admin)
// @route   GET /api/applications
// @access  Private (Admin)
const getApplications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status || "";
  const search = req.query.search || "";

  // Build filter object
  let filters = {};

  if (status) {
    filters.status = status;
  }

  if (search) {
    filters.$or = [
      { "student.name": { $regex: search, $options: "i" } },
      { "job.title": { $regex: search, $options: "i" } },
      { "job.company": { $regex: search, $options: "i" } },
    ];
  }

  const applications = await Application.find(filters)
    .populate({
      path: "job",
      select: "title company location",
      populate: { path: "company" },
    })
    .populate("student")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Application.countDocuments(filters);

  res.status(200).json({
    success: true,
    message: "Applications fetched successfully",
    data: applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private
const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate({
      path: "job",
      select: "title company location requirements",
      populate: {
        path: "company",
        model: "Company",
      },
    })
    .populate("student", "name email phone course batch skills");

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  res.status(200).json({
    success: true,
    message: "Application fetched successfully",
    data: application,
  });
});

// @desc    Get student's applications
// @route   GET /api/applications/student/my-applications
// @access  Private (Student)
const getStudentApplications = asyncHandler(async (req, res) => {
  const studentId = req.student.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status || "";

  // Build filter object
  let filters = { student: studentId };

  if (status) {
    filters.status = status;
  }

  const applications = await Application.find(filters)
    .populate({
      path: "job",
      select: "title company location",
      populate: { path: "company" },
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Application.countDocuments(filters);

  res.status(200).json({
    success: true,
    message: "Your applications fetched successfully",
    data: applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Update application status (verify/reject)
// @route   PATCH /api/applications/:id/status
// @access  Private (Admin)
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("Status is required");
  }

  const validStatuses = [
    "pending",
    "Applied",
    "rejected",
    "interview",
    "selected",
    "joined",
  ];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const application = await Application.findById(req.params.id);

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  application.status = status;
  await application.save();

  const populatedApplication = await Application.findById(application._id)
    .populate("job", "title company location")
    .populate("student", "name email phone");

  res.status(200).json({
    success: true,
    message: `Application ${status} successfully`,
    data: populatedApplication,
  });
});

// @desc    Schedule interview
// @route   PATCH /api/applications/:id/schedule-interview
// @access  Private (Admin)
const scheduleInterview = asyncHandler(async (req, res) => {
  const { date, time, mode, location } = req.body;

  if (!date || !time || !mode) {
    res.status(400);
    throw new Error("Date, time, and mode are required");
  }

  if (mode === "offline" && !location) {
    res.status(400);
    throw new Error("Location is required for offline interviews");
  }

  const application = await Application.findById(req.params.id);

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  // Update application with interview details
  application.interview = {
    date: new Date(date),
    time,
    mode,
    location: mode === "offline" ? location : undefined,
  };
  application.status = "interview";

  await application.save();

  const populatedApplication = await Application.findById(application._id)
    .populate("job", "title company location")
    .populate("student", "name email phone");

  res.status(200).json({
    success: true,
    message: "Interview scheduled successfully",
    data: populatedApplication,
  });
});

// @desc    Update interview details
// @route   PATCH /api/applications/:id/interview
// @access  Private (Admin)
const updateInterview = asyncHandler(async (req, res) => {
  const { date, time, mode, location } = req.body;

  const application = await Application.findById(req.params.id);

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  if (application.status !== "interview_scheduled") {
    res.status(400);
    throw new Error("Application is not in interview scheduled status");
  }

  // Update interview details
  if (date) application.interview.date = new Date(date);
  if (time) application.interview.time = time;
  if (mode) application.interview.mode = mode;
  if (location) application.interview.location = location;

  await application.save();

  const populatedApplication = await Application.findById(application._id)
    .populate("job", "title company location")
    .populate("student", "name email phone");

  res.status(200).json({
    success: true,
    message: "Interview details updated successfully",
    data: populatedApplication,
  });
});

// @desc    Complete application (after interview)
// @route   PATCH /api/applications/:id/complete
// @access  Private (Admin)
const completeApplication = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status || (status !== "completed" && status !== "rejected")) {
    res.status(400);
    throw new Error("Valid status (completed or rejected) is required");
  }

  const application = await Application.findById(req.params.id);

  if (!application) {
    res.status(404);
    throw new Error("Application not found");
  }

  if (application.status !== "interview_scheduled") {
    res.status(400);
    throw new Error("Application is not in interview scheduled status");
  }

  application.status = status;
  await application.save();

  const populatedApplication = await Application.findById(application._id)
    .populate("job", "title company location")
    .populate("student", "name email phone");

  res.status(200).json({
    success: true,
    message: `Application marked as ${status}`,
    data: populatedApplication,
  });
});

// @desc    Get application statistics
// @route   GET /api/applications/stats/overview
// @access  Private (Admin)
const getApplicationStats = asyncHandler(async (req, res) => {
  const totalApplications = await Application.countDocuments();
  const pendingApplications = await Application.countDocuments({
    status: "pending",
  });
  const verifiedApplications = await Application.countDocuments({
    status: "verified",
  });
  const interviewScheduled = await Application.countDocuments({
    status: "interview_scheduled",
  });
  const completedApplications = await Application.countDocuments({
    status: "completed",
  });
  const rejectedApplications = await Application.countDocuments({
    status: "rejected",
  });

  // Applications by status
  const applicationsByStatus = await Application.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Applications by job
  const applicationsByJob = await Application.aggregate([
    {
      $lookup: {
        from: "jobs",
        localField: "job",
        foreignField: "_id",
        as: "jobDetails",
      },
    },
    { $unwind: "$jobDetails" },
    {
      $group: {
        _id: "$jobDetails.title",
        company: { $first: "$jobDetails.company" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    success: true,
    message: "Application statistics fetched successfully",
    data: {
      total: totalApplications,
      pending: pendingApplications,
      verified: verifiedApplications,
      interviewScheduled,
      completed: completedApplications,
      rejected: rejectedApplications,
      byStatus: applicationsByStatus,
      byJob: applicationsByJob,
    },
  });
});

export {
  createApplication,
  getApplications,
  getApplication,
  getStudentApplications,
  updateApplicationStatus,
  scheduleInterview,
  updateInterview,
  completeApplication,
  getApplicationStats,
};
