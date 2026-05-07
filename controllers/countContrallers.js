import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import Batch from "../models/batchs.js";
import Teachers from "../models/teachers.js";
import College from "../models/college.js";
import BranchModal from "../models/branch.js";
import manageHr from "../models/manageHr.js";
import TechnologyModal from "../models/technology.js";
import TranningModal from "../models/tranning.js";
import Attendance from "../models/attendance.js";
import Assignment from "../models/assignment.js";
import Submission from "../models/submission.js";
import Application from "../models/jobApplication.js";
import mongoose from "mongoose";


export const getAll = async (req, res) => {
  try {
    const loggedInUser = req.user;

    // 🔐 Branch filter logic - Super Admin and Admin see all data
    const isGlobalUser = ["Super Admin"].includes(loggedInUser.role);

    const branchFilter = isGlobalUser
      ? {} // global users → all data
      : { branch: loggedInUser.branch }; // employee/trainer/hr → own branch only

    // Students (Registrations)
    const studentsNew = await Registration.countDocuments({ status: "new", ...branchFilter });
    const studentsAccepted = await Registration.countDocuments({
      status: "accepted",
      ...branchFilter
    });
    const studentsRejected = await Registration.countDocuments({
      status: "rejected",
      ...branchFilter
    });
    const studentsPending = await Registration.countDocuments({ tnxStatus: "pending", ...branchFilter });
    const studentsAll = await Registration.countDocuments({ ...branchFilter });

    // Fees (Payments)
    // const feesNew = await Fee.countDocuments({ status: "new", ...branchFilter });


    const getFeeCountByStatus = async (status, loggedInUser) => {
      const matchStage = {};

      if (status !== "all") {
        matchStage.status = status;
      }

      // 🔐 Branch restriction via registration
      if (loggedInUser.role !== "Super Admin") {
        matchStage["registration.branch"] = new mongoose.Types.ObjectId(
          loggedInUser.branch
        );
      }

      const result = await Fee.aggregate([
        {
          $lookup: {
            from: "registrations",
            localField: "registrationId",
            foreignField: "_id",
            as: "registration",
          },
        },
        { $unwind: "$registration" },
        { $match: matchStage },
        { $count: "count" },
      ]);

      return result[0]?.count || 0;
    };

    // Fees (Payments) ✅ CORRECT
    const feesNew = await getFeeCountByStatus("new", loggedInUser);
    const feesAccepted = await getFeeCountByStatus("accepted", loggedInUser);
    const feesRejected = await getFeeCountByStatus("rejected", loggedInUser);
    const feesAll = await getFeeCountByStatus("all", loggedInUser);


    // const feesAccepted = await Fee.countDocuments({ status: "accepted", ...branchFilter });
    // const feesRejected = await Fee.countDocuments({ status: "rejected", ...branchFilter });
    // const feesAll = await Fee.countDocuments({ ...branchFilter });

    //  Batch find
    const batchCount = await Batch.countDocuments({ isActive: true, ...branchFilter });
    //  Teachers find
    const teachersCount = await Teachers.countDocuments({ isActive: true, ...branchFilter });
    const collegeCount = await College.countDocuments({ isActive: true });
    const branchesCount = await BranchModal.countDocuments({ isActive: true });
    const manageHrCount = await manageHr.countDocuments({ isActive: true, ...branchFilter });
    const technologyCount = await TechnologyModal.countDocuments({
      isActive: true,
    });
    const tranningCount = await TranningModal.countDocuments({
      isActive: true,
    });

    // Final response object
    const counts = {
      students: {
        new: studentsNew,
        accepted: studentsAccepted,
        rejected: studentsRejected,
        pending: studentsPending,
        all: studentsAll,
      },
      fees: {
        new: feesNew,
        accepted: feesAccepted,
        rejected: feesRejected,
        all: feesAll,
      },
      batchCount,
      teachersCount,
      collegeCount,
      branchCount: branchesCount,
      manageHrCount,
      technologyCount,
      tranningCount,
    };

    res.status(200).json(counts);
  } catch (error) {
    console.error("Error in getAll controller:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getStudentCounts = async (req, res) => {
  try {
    const studentId = req.student?._id;

    if (!studentId) {
      return res.status(400).json({ message: "Student not identified" });
    }

    // 1. Attendance Counts
    // Aggregate attendance records where this student is present/absent
    // The structure is Attendance -> records [{ studentId, status }]
    const attendanceStats = await Attendance.aggregate([
      { $match: { "records.studentId": studentId } },
      { $unwind: "$records" },
      { $match: { "records.studentId": studentId } },
      {
        $group: {
          _id: "$records.status",
          count: { $sum: 1 },
        },
      },
    ]);

    let present = 0;
    let absent = 0;

    attendanceStats.forEach((stat) => {
      if (stat._id === "Present") present = stat.count;
      if (stat._id === "Absent") absent = stat.count;
    });

    const totalClasses = present + absent;

    // 2. Fee Counts
    const studentReg = await Registration.findById(studentId).select(
      "totalFee finalFee dueAmount paidAmount batch mobile"
    );

    const totalFee = studentReg?.totalFee || 0;
    const finalFee = studentReg?.finalFee || 0;
    const dueFee = studentReg?.dueAmount || 0;
    const paidAmount = studentReg?.paidAmount || 0;

    // 3. Assignment Counts
    const studentBatches = studentReg?.batch || [];

    const totalAssignments = await Assignment.countDocuments({
      batches: { $in: studentBatches },
    });

    const submittedAssignments = await Submission.countDocuments({
      student: studentId,
    });

    // 4. Job Applications
    const totalJobsApplied = await Application.countDocuments({ student: studentId });

    // 5. Batch Count
    const totalBatches = studentBatches.length;


    res.status(200).json({
      attendance: {
        totalClasses,
        present,
        absent,
      },
      fee: {
        totalFee: finalFee, // Use finalFee as the base for percentage calculation
        dueFee,
        paidAmount,
        originalTotalFee: totalFee, // Keep original for reference
      },
      assignments: {
        total: totalAssignments,
        submitted: submittedAssignments,
      },
      jobs: {
        applied: totalJobsApplied,
      },
      batches: totalBatches,
    });
  } catch (error) {
    console.error("Error in getStudentCounts:", error);
    res.status(500).json({ message: "Server error" });
  }
};
