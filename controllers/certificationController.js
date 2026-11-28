import Certification from "../models/certification.js";
import Registration from "../models/regsitration.js";

// Apply for certification
export const applyCertification = async (req, res) => {
  try {
    const {
      student,
      studentName,
      mobile,
      trainingDuration,
      trainingName,
      startDate,
      collegeName,
      course,
      branch,
      technology,
      trainingMode,
    } = req.body;

    // Check student fee status: only students with full fees paid can apply
    const studentDoc = await Registration.findById(student);
    if (!studentDoc) {
      return res.status(404).json({
        success: false,
        message: "Student registration not found.",
      });
    }

    const dueAmount = Number(
      studentDoc.dueAmount !== undefined && studentDoc.dueAmount !== null
        ? studentDoc.dueAmount
        : (studentDoc.finalFee || 0) - (studentDoc.paidAmount || 0)
    );

    const isFullPaid =
      dueAmount <= 0 &&
      (studentDoc.finalFee > 0 ? (studentDoc.paidAmount || 0) >= studentDoc.finalFee : true);

    if (!isFullPaid && studentDoc.trainingFeeStatus !== "full paid") {
      return res.status(400).json({
        success: false,
        message: "Certificate form sirf wahi students fill kar sakte hain jinka full fees paid ho. Please clear your fee dues to apply.",
      });
    }

    const files = req.files || {};
    let feeReceipt = null;
    let aadharFront = null;
    let aadharBack = null;

    if (files.feeReceipt && files.feeReceipt[0]) {
      feeReceipt = `/uploads/${files.feeReceipt[0].filename}`;
    }
    if (files.aadharFront && files.aadharFront[0]) {
      aadharFront = `/uploads/${files.aadharFront[0].filename}`;
    }
    if (files.aadharBack && files.aadharBack[0]) {
      aadharBack = `/uploads/${files.aadharBack[0].filename}`;
    }

    if (!aadharFront || !aadharBack) {
      return res.status(400).json({
        success: false,
        message: "Please upload Aadhar front and Aadhar back images.",
      });
    }

    // Duplicate Check: Prevent applying if already applied and not rejected
    const existingCert = await Certification.findOne({
      student,
      trainingName,
      status: { $in: ["Pending", "Accepted", "Send to Print", "Printed", "Issued"] }
    });

    if (existingCert) {
      return res.status(400).json({
        success: false,
        message: `You have already applied for a certificate for ${trainingName}. Status: ${existingCert.status}`,
      });
    }

    const certification = new Certification({
      student,
      studentName,
      mobile,
      trainingDuration,
      trainingName,
      startDate,
      collegeName,
      course,
      branch,
      technology,
      trainingMode,
      feeReceipt,
      aadharFront,
      aadharBack,
      status: "Pending",
    });

    await certification.save();

    res.status(201).json({
      success: true,
      message: "Certification applied successfully",
      data: certification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error applying for certification",
      error: error.message,
    });
  }
};

// Get certifications for a student
export const getStudentCertifications = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const certifications = await Certification.find({ student: studentId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: certifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching student certifications",
      error: error.message,
    });
  }
};

// Get all certifications (Admin)
export const getAllCertifications = async (req, res) => {
  try {
    const { status, search } = req.query;
    const sessionYear = req.headers["x-session-year"] || req.query.sessionYear;
    let filter = {};

    if (sessionYear && sessionYear !== "All" && sessionYear !== "") {
      const yearInt = parseInt(sessionYear, 10);
      if (!isNaN(yearInt)) {
        const start = new Date(`${yearInt}-01-01T00:00:00.000Z`);
        const end = new Date(`${yearInt}-12-31T23:59:59.999Z`);
        filter.createdAt = { $gte: start, $lte: end };
      }
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const certifications = await Certification.find(filter)
      .populate("student", "userid")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: certifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching certifications",
      error: error.message,
    });
  }
};

// Update certification status
export const updateCertificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;

    if (status === "Rejected" && !rejectReason) {
      return res.status(400).json({
        success: false,
        message: "Reject reason is required when rejecting a certification.",
      });
    }

    const updateData = { status };
    if (rejectReason) {
      updateData.rejectReason = rejectReason;
    }

    const certification = await Certification.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!certification) {
      return res.status(404).json({
        success: false,
        message: "Certification request not found",
      });
    }

    // You can send notification/email here if needed

    res.status(200).json({
      success: true,
      message: `Certification ${status} successfully`,
      data: certification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating certification status",
      error: error.message,
    });
  }
};
