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
import Certification from "../models/certification.js";
import mongoose from "mongoose";


export const getAll = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { eduYear, sessionYear } = req.query; // Add eduYear and sessionYear filter from query params

    // 🔐 Branch filter logic - Super Admin and Admin see all data
    const isGlobalUser = ["Super Admin"].includes(loggedInUser.role);

    const branchFilter = isGlobalUser
      ? {} // global users → all data
      : { branch: loggedInUser.branch }; // employee/trainer/hr → own branch only

    // Add year filter if provided
    const yearFilter = eduYear && eduYear !== "All" && eduYear !== "" ? { eduYear } : {};
    
    let sessionFilter = {};
    if (sessionYear && sessionYear !== "All" && sessionYear !== "") {
      const yearInt = parseInt(sessionYear);
      sessionFilter = {
        createdAt: {
          $gte: new Date(`${yearInt}-01-01T00:00:00.000Z`),
          $lte: new Date(`${yearInt}-12-31T23:59:59.999Z`)
        }
      };
    }
    const combinedFilter = { ...branchFilter, ...yearFilter, ...sessionFilter };

    // Check if Employee is a Teacher (by phone)
    let isTeacher = false;
    let teacherDoc = null;
    let teacherBatchIds = [];
    let teacherStudentIds = [];

    if (loggedInUser.role === "Employee") {
      teacherDoc = await Teachers.findOne({ phone: loggedInUser.phone, isActive: true });
      if (teacherDoc) {
        isTeacher = true;
        const teacherBatches = await Batch.find({ teacher: teacherDoc._id });
        teacherBatchIds = teacherBatches.map(b => b._id);
        teacherStudentIds = teacherBatches.reduce((acc, b) => {
          if (b.students) {
            b.students.forEach(s => {
              if (!acc.includes(s.toString())) acc.push(s.toString());
            });
          }
          return acc;
        }, []);
      }
    }

    // Students (Registrations) - now with year filter
    let studentsNew, studentsAccepted, studentsRejected, studentsPending, studentsAll, studentsCertificateIssued, studentsDueFees, studentsTrainingJoined, studentsCancelled;
    if (isTeacher) {
      studentsNew = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "new", isCancelled: { $ne: true } });
      studentsAccepted = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "accepted", certificateIssued: { $ne: true }, isCancelled: { $ne: true } });
      studentsRejected = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "rejected", isCancelled: { $ne: true } });
      studentsPending = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, tnxStatus: "pending", isCancelled: { $ne: true } });
      studentsAll = await Registration.countDocuments({ _id: { $in: teacherStudentIds } }); // Keep absolute total
      studentsCertificateIssued = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "accepted", certificateIssued: true, isCancelled: { $ne: true } });
      studentsTrainingJoined = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "accepted", isJoin: true, certificateIssued: { $ne: true }, isCancelled: { $ne: true } });
      studentsDueFees = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, status: "accepted", dueAmount: { $gt: 0 }, isCancelled: { $ne: true } });
      studentsCancelled = await Registration.countDocuments({ _id: { $in: teacherStudentIds }, isCancelled: true });
    } else {
      studentsNew = await Registration.countDocuments({ status: "new", isCancelled: { $ne: true }, ...combinedFilter });
      studentsAccepted = await Registration.countDocuments({
        status: "accepted",
        certificateIssued: { $ne: true },
        isCancelled: { $ne: true },
        ...combinedFilter
      });
      studentsRejected = await Registration.countDocuments({
        status: "rejected",
        isCancelled: { $ne: true },
        ...combinedFilter
      });
      studentsPending = await Registration.countDocuments({ tnxStatus: "pending", isCancelled: { $ne: true }, ...combinedFilter });
      studentsAll = await Registration.countDocuments({ ...combinedFilter }); // Keep absolute total
      studentsCertificateIssued = await Registration.countDocuments({
        status: "accepted",
        certificateIssued: true,
        isCancelled: { $ne: true },
        ...combinedFilter
      });
      studentsTrainingJoined = await Registration.countDocuments({
        status: "accepted",
        isJoin: true,
        certificateIssued: { $ne: true },
        isCancelled: { $ne: true },
        ...combinedFilter
      });
      studentsDueFees = await Registration.countDocuments({
        status: "accepted",
        dueAmount: { $gt: 0 },
        isCancelled: { $ne: true },
        ...combinedFilter
      });
      studentsCancelled = await Registration.countDocuments({
        isCancelled: true,
        ...combinedFilter
      });
    }

    // Fees (Payments)
    const getFeeCountByStatus = async (status, loggedInUser, eduYear, paidByRole, sessionYearParam) => {
      const matchStage = {};

      if (status !== "all") {
        matchStage.status = status;
      }

      if (paidByRole === "admin") {
        matchStage.$or = [{ paidBy: { $exists: false } }, { paidBy: null }];
      } else if (paidByRole === "student") {
        matchStage.paidBy = { $exists: true, $ne: null };
      }

      if (isTeacher) {
        matchStage.registrationId = { $in: teacherStudentIds.map(id => new mongoose.Types.ObjectId(id)) };
      } else {
        // 🔐 Branch restriction via registration
        if (loggedInUser.role !== "Super Admin") {
          matchStage["registration.branch"] = new mongoose.Types.ObjectId(
            loggedInUser.branch
          );
        }

        // Add year filter if provided
        if (eduYear && eduYear !== "All" && eduYear !== "") {
          matchStage["registration.eduYear"] = eduYear;
        }

        if (sessionYearParam && sessionYearParam !== "All" && sessionYearParam !== "") {
          const yearInt = parseInt(sessionYearParam);
          matchStage["registration.createdAt"] = {
            $gte: new Date(`${yearInt}-01-01T00:00:00.000Z`),
            $lte: new Date(`${yearInt}-12-31T23:59:59.999Z`)
          };
        }
      }

      const pipeline = [];
      if (!isTeacher) {
        pipeline.push(
          {
            $lookup: {
              from: "registrations",
              localField: "registrationId",
              foreignField: "_id",
              as: "registration",
            },
          },
          { $unwind: "$registration" }
        );
      }
      
      pipeline.push(
        { $match: matchStage },
        { $count: "count" }
      );

      const result = await Fee.aggregate(pipeline);
      return result[0]?.count || 0;
    };

    // Fees (Payments) ✅ CORRECT - now with year filter
    const feesNew = await getFeeCountByStatus("new", loggedInUser, eduYear, null, sessionYear);
    const feesNewAdmin = await getFeeCountByStatus("new", loggedInUser, eduYear, "admin", sessionYear);
    const feesNewStudent = await getFeeCountByStatus("new", loggedInUser, eduYear, "student", sessionYear);
    const feesAccepted = await getFeeCountByStatus("accepted", loggedInUser, eduYear, null, sessionYear);
    const feesRejected = await getFeeCountByStatus("rejected", loggedInUser, eduYear, null, sessionYear);
    const feesAll = await getFeeCountByStatus("all", loggedInUser, eduYear, null, sessionYear);

    //  Batch find
    let batchCount;
    if (isTeacher) {
      batchCount = teacherBatchIds.length;
    } else {
      batchCount = await Batch.countDocuments({ isActive: true, ...branchFilter });
    }

    //  Teachers find
    const teachersCount = isTeacher ? 1 : await Teachers.countDocuments({ isActive: true, ...branchFilter });
    const collegeCount = isTeacher ? 0 : await College.countDocuments({ isActive: true });
    const branchesCount = isTeacher ? 0 : await BranchModal.countDocuments({ isActive: true });
    const manageHrCount = isTeacher ? 0 : await manageHr.countDocuments({ isActive: true, ...branchFilter });
    const technologyCount = isTeacher ? 0 : await TechnologyModal.countDocuments({ isActive: true });
    const tranningCount = isTeacher ? 0 : await TranningModal.countDocuments({ isActive: true });

    // Certifications
    const pendingCertification = await Certification.countDocuments({ status: "Pending", ...branchFilter });
    const acceptedCertification = await Certification.countDocuments({ status: "Accepted", ...branchFilter });
    const rejectedCertification = await Certification.countDocuments({ status: "Rejected", ...branchFilter });

    // Final response object
    const counts = {
      students: {
        new: studentsNew,
        accepted: studentsAccepted,
        rejected: studentsRejected,
        pending: studentsPending,
        all: studentsAll,
        certificateIssued: studentsCertificateIssued,
        trainingJoined: studentsTrainingJoined,
        dueFees: studentsDueFees,
        cancelled: studentsCancelled,
      },
      fees: {
        new: feesNew,
        newAdmin: feesNewAdmin,
        newStudent: feesNewStudent,
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
      certifications: {
        pendingCertification,
        acceptedCertification,
        rejectedCertification,
        all: pendingCertification + acceptedCertification + rejectedCertification, // Show total on main menu
      }
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
    const studentBatchIds = studentReg?.batch
      ? (Array.isArray(studentReg.batch) ? studentReg.batch : [studentReg.batch])
      : [];

    const dbBatches = await Batch.find({
      $or: [
        { students: studentId },
        { _id: { $in: studentBatchIds } }
      ]
    }).select("_id");
    const allBatchIds = dbBatches.map(b => b._id);

    const totalAssignments = await Assignment.countDocuments({
      batches: { $in: allBatchIds },
    });

    const submittedAssignments = await Submission.countDocuments({
      student: studentId,
    });

    // 4. Job Applications
    const totalJobsApplied = await Application.countDocuments({ student: studentId });

    // 5. Batch Count
    const totalBatches = allBatchIds.length;


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
