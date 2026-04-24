
import Registration from "../models/regsitration.js";
import bcrypt from "bcryptjs";

// @desc    Update student profile
// @route   PUT /api/student/update
// @access  Private (Student)
export const updateProfile = async (req, res) => {
  try {
    const studentId = req.student?._id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student session not found",
      });
    }

    const {
      studentName,
      email,
      mobile,
      alternateMobile,
      whatshapp,
      fatherName,
      address,
      dateOfBirth,
      gender,
      district,
      pincode,
    } = req.body;

    const student = await Registration.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found",
      });
    }

    // Update fields
    if (studentName) student.studentName = studentName;
    if (email) student.email = email;
    if (mobile) student.mobile = mobile;
    if (alternateMobile) student.alternateMobile = alternateMobile;
    if (whatshapp) student.whatshapp = whatshapp;
    if (fatherName) student.fatherName = fatherName;
    if (address) student.address = address;
    if (dateOfBirth) student.dateOfBirth = dateOfBirth;
    if (gender) student.gender = gender;
    if (district) student.district = district;
    if (pincode) student.pincode = pincode;

    await student.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      student,
    });
  } catch (error) {
    console.error("Student profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Change password
// @route   PUT /api/student/change-password
// @access  Private (Student)
export const changePassword = async (req, res) => {
  try {
    const studentId = req.student?._id;
    const { oldPassword, newPassword } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student session not found",
      });
    }

    const student = await Registration.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found",
      });
    }

    // Directly update password as requested (removing old password check)

    // Update password (plain text for now to match current registration system)
    student.password = newPassword;
    student.isPasswordSet = true;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// @desc    Upload documents
// @route   PUT /api/student/upload-docs
// @access  Private (Student)
export const uploadDocuments = async (req, res) => {
  try {
    const studentId = req.student?._id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student session not found",
      });
    }

    const student = await Registration.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found",
      });
    }

    if (req.files) {
      if (req.files.profilePhoto) {
        student.profilePhoto = {
          url: `/uploads/${req.files.profilePhoto[0].filename}`,
          publicId: req.files.profilePhoto[0].filename,
        };
        student.photoSummited = true;
      }
      if (req.files.aadharCard) {
        student.aadharCard = {
          url: `/uploads/${req.files.aadharCard[0].filename}`,
          publicId: req.files.aadharCard[0].filename,
        };
        student.aadharCardUploded = true;
      }
      if (req.files.cv) {
        student.cv = {
          url: `/uploads/${req.files.cv[0].filename}`,
          publicId: req.files.cv[0].filename,
        };
        student.cvUploded = true;
      }
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      student,
    });
  } catch (error) {
    console.error("Upload documents error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Direct reset password to mobile number
// @route   PUT /api/student/reset-password-direct
// @access  Private (Student)
export const directResetPassword = async (req, res) => {
  try {
    const studentId = req.student?._id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student session not found",
      });
    }

    const student = await Registration.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found",
      });
    }

    // Reset password to mobile number
    student.password = student.mobile;
    student.isPasswordSet = true;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Password reset to default (Mobile No.) successfully",
    });
  } catch (error) {
    console.error("Direct reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
