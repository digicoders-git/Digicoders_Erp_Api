
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import cloudinary from "../config/cloudinary.js";
import EmployeePermission from "../models/EmployeePermission.js";
import Permission from "../models/Permission.js";
import Registration from "../models/regsitration.js";
import Teacher from "../models/teachers.js";
import Batch from "../models/batchs.js";
import { sendEmail, sendOTPEmail, sendLoginAlertEmail, getLocationFromIP } from "../utils/sendEmail.js";
import { sendSmsOtp } from "../utils/sendSMS.js";
import axios from "axios";
dotenv.config();

// Login Function
export const login = async (req, res) => {
  try {
    const { email, password, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Location permission is required to log in. Please enable location in your browser."
      });
    }

    // Find user with password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "Invalid email or password",
        success: false,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is inactive. Please contact administrator.",
        success: false,
      });
    }

    // Check if account is locked
    if (user.isAccountLocked) {
      return res.status(403).json({
        message: "Account is temporarily locked. Try again later.",
        success: false,
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incLoginAttempts();
      const attemptsLeft = 5 - user.loginAttempts;

      return res.status(400).json({
        message: `Invalid password. ${attemptsLeft > 0 ? attemptsLeft + ' attempts left' : 'Account locked for 2 hours'}`,
        success: false
      });
    }

    if (user.isTwoFactor || user.role === "Admin") {
      const otp = Math.floor(100000 + Math.random() * 900000);
      user.otp = otp;
      user.otpExpire = new Date(Date.now() + 5 * 60 * 1000);
      
      // Always print OTP in console for easy development/debugging
      console.log(`🔑 [OTP DEBUG] Generated OTP for ${user.email} (${user.role}): ${otp}`);
      
      // Get user location and device info
      const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      const userAgent = req.get('User-Agent');
      
      const handleBackground2FA = async () => {
        try {
          const location = await getLocationFromIP(userIP);
          if (latitude && longitude) {
            location.lat = latitude;
            location.lon = longitude;
            location.mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
          }
          
          if (user.role === "Super Admin") {
            // Send OTP to specific emails for Super Admin
            const superAdminEmails = [
              "digicoderstech@gmail.com", 
              "Kashyapaditya2781@gmail.com"
            ];
            
            for (const email of superAdminEmails) {
              try {
                await sendLoginAlertEmail(email, {
                  email: user.email,
                  ip: userIP,
                  location: location,
                  userAgent: userAgent
                });
                
                await sendOTPEmail(email, { otp, ip: userIP, location, userAgent });
              } catch (err) {
                console.error(`Error sending Super Admin security email to ${email}:`, err);
              }
            }
            console.log(`🔐 Super Admin OTP ${otp} sent to security emails`);
          } else if (user.role === "Admin") {
            // Send OTP to Admin's registered email
            if (user.email) {
              await sendOTPEmail(user.email, { 
                otp, 
                ip: userIP, 
                location, 
                userAgent, 
                userInfo: { name: user.name, loginTime: new Date().toLocaleString('en-IN') } 
              });
              console.log(`🔐 Admin OTP ${otp} sent to ${user.email}`);
            }
          } else {
            // Regular user - send to their email
            if (user.email) {
              await sendOTPEmail(user.email, { otp, ip: userIP, location, userAgent });
            }
          }
        } catch (err) {
          console.error("Error in background 2FA tasks:", err);
        }
      };

      // Fire and forget background email/location task
      handleBackground2FA();
      
      // Send SMS OTP if phone exists (fire and forget)
      if (user.phone) {
        sendSmsOtp(user.phone, otp).catch(err => console.error("Error sending SMS OTP:", err));
      }
      
      await user.save();

      return res.status(200).json({
        success: true,
        message: user.role === "Super Admin" 
          ? "Super Admin 2FA required. OTP sent to security team emails." 
          : user.role === "Admin"
          ? "Admin 2FA required. OTP sent to your registered email address."
          : "Two-factor authentication required, OTP sent to your email and mobile",
        isTwoFactor: true,
        requiresOTP: true,
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only show OTP in development
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isSuperAdmin: user.role === "Super Admin",
          isAdmin: user.role === "Admin"
        }
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Send login alert for Super Admin (non-blocking)
    if (user.role === "Super Admin") {
      const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      const userAgent = req.get('User-Agent');
      
      const handleBackgroundSuccessAlert = async () => {
        try {
          const location = await getLocationFromIP(userIP);
          const superAdminEmails = [
            "digicoderstech@gmail.com", 
            "Kashyapaditya2781@gmail.com"
          ];
          
          for (const email of superAdminEmails) {
            try {
              await sendLoginAlertEmail(email, {
                email: user.email,
                ip: userIP,
                location: location,
                userAgent: userAgent
              });
            } catch (err) {
              console.error(`Error sending background Super Admin login alert to ${email}:`, err);
            }
          }
          console.log(`🚨 Super Admin login alert sent to security emails`);
        } catch (err) {
          console.error("Error in background login alert tasks:", err);
        }
      };

      handleBackgroundSuccessAlert();
    }

    // Generate token
    const token = user.generateToken();

    // Get employee permissions if employee or admin
    let permissions = [];
    let isTeacher = false;
    let teacherInfo = null;

    if ((user.role === "Employee" || user.role === "Admin") && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate('permissions', 'name description category');

      permissions = employeePerm
        ? employeePerm.permissions.map(p => p.name)
        : [];
    }

    // 🧑‍🏫 Check if employee is a teacher and inject teacher permissions
    if (user.role === "Employee") {
      const teacherDoc = await Teacher.findOne({ phone: user.phone, isActive: true })
        .populate("assignedBatches", "batchName subject classTime startDate");
      if (teacherDoc) {
        isTeacher = true;
        teacherInfo = {
          teacherId: teacherDoc._id,
          assignedBatches: teacherDoc.assignedBatches || []
        };
        // Grant teacher permissions automatically
        const teacherPermissions = [
          "view_batch", "mark_attendance", "view_attendance",
          "manage_assignments", "grade_assignment", "manage_lms",
          "view_lms", "view_dashboard"
        ];
        teacherPermissions.forEach(p => {
          if (!permissions.includes(p)) permissions.push(p);
        });
      }
    }

    // Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      isTwoFactor: user.isTwoFactor,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        permissions,
        isSuperAdmin: user.role === "Super Admin",
        isTeacher,
        teacherInfo
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false,
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    console.log(email, password, otp);
    const user = await User.findOne({ email: email })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incLoginAttempts();
      const attemptsLeft = 5 - user.loginAttempts;

      return res.status(400).json({
        message: `Invalid password. ${attemptsLeft > 0 ? attemptsLeft + ' attempts left' : 'Account locked for 2 hours'}`,
        success: false
      });
    }
    if (user.otp !== otp || user.otpExpire < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Update user
    user.otp = undefined;
    user.otpExpire = undefined;
    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();

    await user.save();

    // 🚨 Super Admin and Admin Login Security Alert (non-blocking)
    if (user.role === "Super Admin" || user.role === "Admin") {
      const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      const userAgent = req.get('User-Agent');
      
      const handleBackgroundVerifyAlert = async () => {
        try {
          const location = await getLocationFromIP(userIP);
          
          if (user.role === "Super Admin") {
            const superAdminEmails = [
              "digicoderstech@gmail.com", 
              "Kashyapaditya2781@gmail.com"
            ];
            
            for (const email of superAdminEmails) {
              try {
                await sendLoginAlertEmail(email, {
                  email: user.email,
                  ip: userIP,
                  location: location,
                  userAgent: userAgent
                });
              } catch (err) {
                console.error(`Error sending background Super Admin OTP verify alert to ${email}:`, err);
              }
            }
            console.log(`🚨 Super Admin login alert sent to security emails`);
          } else if (user.role === "Admin") {
            // Send login success notification to Admin
            if (user.email) {
              await sendLoginAlertEmail(user.email, {
                email: user.email,
                ip: userIP,
                location: location,
                userAgent: userAgent,
                isAdmin: true
              });
              console.log(`🚨 Admin login success alert sent to ${user.email}`);
            }
          }
        } catch (err) {
          console.error("Error in background verify alert tasks:", err);
        }
      };

      handleBackgroundVerifyAlert();
    }



    // Generate token
    const token = user.generateToken();

    // Get employee permissions if employee or admin
    let permissions = [];
    let isTeacher = false;
    let teacherInfo = null;

    if ((user.role === "Employee" || user.role === "Admin") && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate('permissions', 'name description category');

      permissions = employeePerm
        ? employeePerm.permissions.map(p => p.name)
        : [];
    }

    // 🧑‍🏫 Check if employee is a teacher and inject teacher permissions
    if (user.role === "Employee") {
      const teacherDoc = await Teacher.findOne({ phone: user.phone, isActive: true })
        .populate("assignedBatches", "batchName subject classTime startDate");
      if (teacherDoc) {
        isTeacher = true;
        teacherInfo = {
          teacherId: teacherDoc._id,
          assignedBatches: teacherDoc.assignedBatches || []
        };
        const teacherPermissions = [
          "view_batch", "mark_attendance", "view_attendance",
          "manage_assignments", "grade_assignment", "manage_lms",
          "view_lms", "view_dashboard"
        ];
        teacherPermissions.forEach(p => {
          if (!permissions.includes(p)) permissions.push(p);
        });
      }
    }

    // Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        permissions,
        isSuperAdmin: user.role === "Super Admin",
        isTeacher,
        teacherInfo
      }
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Register User with Role-Based Access Control
export const register = async (req, res) => {
  try {
    const { name, email, password, role, branch } = req.body;
    const file = req.file;
    const loggedInUser = req.user;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required!",
        success: false
      });
    }

    // Check permissions based on who is creating
    if (role === "Super Admin") {
      // Only Super Admin can create another Super Admin
      if (!loggedInUser || loggedInUser.role !== "Super Admin") {
        return res.status(403).json({
          message: "Only Super Admin can create another Super Admin",
          success: false
        });
      }
    } else if (role === "Admin") {
      // Only Super Admin can create Admin
      if (!loggedInUser || loggedInUser.role !== "Super Admin") {
        return res.status(403).json({
          message: "Only Super Admin can create Admin",
          success: false
        });
      }
      if (!branch) {
        return res.status(400).json({
          message: "Branch is required for Admin",
          success: false
        });
      }
    } else if (role === "Employee") {
      // Super Admin or Admin can create Employee
      if (!loggedInUser || (loggedInUser.role !== "Admin" && loggedInUser.role !== "Super Admin")) {
        return res.status(403).json({
          message: "Only Super Admin or Admin can create Employee",
          success: false
        });
      }
      if (!branch) {
        return res.status(400).json({
          message: "Branch is required for Employee",
          success: false
        });
      }
      // Admin can only create employees for their own branch
      if (loggedInUser.role === "Admin" && branch !== loggedInUser.branch?._id?.toString()) {
        return res.status(403).json({
          message: "Admin can only create employees for their own branch",
          success: false
        });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists",
        success: false
      });
    }

    // Final role and branch determination
    const finalRole = loggedInUser.role === "Admin" ? "Employee" : role;
    const finalBranch = loggedInUser.role === "Admin" ? loggedInUser.branch : branch;

    // Format image object
    let imageObject = null;
    if (file) {
      imageObject = {
        url: `/uploads/${file.filename}`,
        public_id: file.filename,
      };
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role: finalRole,
      branch: finalRole !== "Super Admin" ? finalBranch : undefined,
      registeredBy: loggedInUser?._id || null,
      image: imageObject,
      isVerified: finalRole === "Super Admin" || finalRole === "Admin" ? true : false,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: `${role} registered successfully`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false
    });
  }
};

// Get current user with permissions
// export const getMe = async (req, res) => {
//   try {
//     const user = req.user;

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Get employee permissions if employee
//     let userWithPermissions = user.toObject();
//     if (user.role === "Employee" && user.branch) {
//       const employeePerm = await EmployeePermission.findOne({
//         employee: user._id,
//         branch: user.branch
//       }).populate('permissions', 'name description category');

//       userWithPermissions.permissions = employeePerm ?
//         employeePerm.permissions.map(p => p.name) : [];
//     }

//     // Add isSuperAdmin flag
//     userWithPermissions.isSuperAdmin = user.role === "Super Admin";

//     res.status(200).json({
//       success: true,
//       message: "User fetched successfully",
//       data: userWithPermissions
//     });
//   } catch (error) {
//     console.error("Get me error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };
export const getMe = async (req, res) => {
  try {
    // 🔹 CASE 1: Admin / Employee
    if (req.user) {
      let userWithPermissions = req.user.toObject();

      if ((req.user.role === "Employee" || req.user.role === "Admin") && req.user.branch) {
        const employeePerm = await EmployeePermission.findOne({
          employee: req.user._id,
          branch: req.user.branch
        }).populate("permissions", "name description category");

        userWithPermissions.permissions = employeePerm
          ? employeePerm.permissions.map(p => p.name)
          : [];
      }

      userWithPermissions.isSuperAdmin =
        req.user.role === "Super Admin";

      return res.status(200).json({
        success: true,
        message: "User fetched successfully",
        type: "user",
        data: userWithPermissions,
      });
    }

    // 🔹 CASE 2: Student
    if (req.student) {

      const student = await Registration.findById(req.student._id)
        .select("+password") 
        .populate({ path: "branch", select: "name" })
        .populate({ path: "collegeName", select: "name" })
        .populate({ path: "education", select: "title" })
        .populate({ path: "hrName", select: "name mobile" })
        .populate({ path: "technology", select: "name" })
        .populate({ path: "batch", select: "batchName classTime subject room startDate teacher isActive wpLink gmeetLink", populate: { path: "teacher", select: "name" } })
        .populate({
          path: "training",
          select: "name duration",   // 👈 training fields
          populate: {
            path: "duration",
            select: "name"   // 👈 duration fields
          }
        });
      
      const studentObj = student.toObject();
      if (!studentObj.isPasswordSet && studentObj.password && studentObj.password !== studentObj.mobile) {
        studentObj.isPasswordSet = true;
      }
      delete studentObj.password;

      // 🔍 Debug: Log batch information
      console.log("🔍 Student batch debug:", {
        studentId: student._id,
        studentName: student.studentName,
        batchArray: student.batch,
        batchCount: student.batch ? student.batch.length : 0
      });

      return res.status(200).json({
        success: true,
        message: "Student fetched successfully",
        type: "student",
        data: studentObj,
      });
    }

    // ❌ None found
    return res.status(404).json({
      success: false,
      message: "User not found",
    });

  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all users with role-based filtering
export const getAll = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const {
      search,
      role,
      isActive,
      branch,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Apply role-based filtering
    if (loggedInUser.role === "Admin") {
      // Admin can only see users from their branch
      filter.branch = loggedInUser.branch;
      filter.role = { $ne: "Super Admin" }; // Admin cannot see Super Admin
    } else if (loggedInUser.role === "Employee") {
      // Employee can only see themselves
      return res.status(200).json({
        success: true,
        message: "Successfully fetched user",
        data: [loggedInUser],
        total: 1,
        page: 1,
        pages: 1
      });
    }

    // Apply filters
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role && role !== "All") {
      filter.role = role;
    }

    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    if (branch && branch !== "All" && loggedInUser.role === "Super Admin") {
      filter.branch = branch;
    }

    // Exclude Super Admin from non-Super Admin users
    if (loggedInUser.role !== "Super Admin") {
      filter.role = { $ne: "Super Admin" };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const totalCount = await User.countDocuments(filter);

    // Get users
    const users = await User.find(filter)
      .populate("branch", "name address")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get permissions for employees
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const userObj = user.toObject();
        if (user.role === "Employee" && user.branch) {
          const employeePerm = await EmployeePermission.findOne({
            employee: user._id,
            branch: user.branch
          }).populate('permissions', 'name');

          userObj.permissions = employeePerm ?
            employeePerm.permissions.map(p => p.name) : [];
        }
        userObj.isSuperAdmin = user.role === "Super Admin";
        return userObj;
      })
    );

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: usersWithPermissions.length,
      total: totalCount,
      page: pageNum,
      pages: Math.ceil(totalCount / limitNum),
      data: usersWithPermissions,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      branch,
      isActive,
      isTwoFactor,
      password
    } = req.body;

    const file = req.file;
    const loggedInUser = req.user;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check permissions
    if (loggedInUser.role === "Admin") {
      // Admin can only update users in their branch
      const loggedInBranchId = loggedInUser.branch?._id?.toString() || loggedInUser.branch?.toString();
      const userBranchId = user.branch?._id?.toString() || user.branch?.toString();
      if (userBranchId !== loggedInBranchId) {
        return res.status(403).json({
          success: false,
          message: "You can only update users in your branch",
        });
      }
      // Admin cannot update role
      if (req.body.role && req.body.role !== user.role) {
        return res.status(403).json({
          success: false,
          message: "Admin cannot change user roles",
        });
      }
    } else if (loggedInUser.role === "Employee") {
      // Employee can only update their own profile
      if (user._id.toString() !== loggedInUser._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own profile",
        });
      }
    }

    // Check if email is being updated and validate uniqueness
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists with another user",
        });
      }
      user.email = email;
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (password) user.password = password;

    // Branch can only be changed by Super Admin
    if (branch && loggedInUser.role === "Super Admin") {
      user.branch = branch;
    }

    // Image update
    if (file) {
      if (user.image?.public_id) {
        await cloudinary.uploader.destroy(user.image.public_id);
      }
      user.image = {
        url: `/uploads/${file.filename}`,
        public_id: file.filename,
      };
    }

    // Only Super Admin/Admin can update these fields
    if (loggedInUser.role === "Super Admin" || loggedInUser.role === "Admin") {
      if (isActive !== undefined) user.isActive = isActive;
    }

    if (isTwoFactor !== undefined) user.isTwoFactor = isTwoFactor;

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user
    });

  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check permissions
    if (user._id.toString() === loggedInUser._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete yourself",
      });
    }

    if (loggedInUser.role === "Admin") {
      // Admin can only delete users from their branch
      const loggedInBranchId = loggedInUser.branch?._id?.toString() || loggedInUser.branch?.toString();
      const userBranchId = user.branch?._id?.toString() || user.branch?.toString();
      if (userBranchId !== loggedInBranchId) {
        return res.status(403).json({
          success: false,
          message: "You can only delete users from your branch",
        });
      }
      // Admin cannot delete other Admins
      if (user.role === "Admin") {
        return res.status(403).json({
          success: false,
          message: "Admin cannot delete another Admin",
        });
      }
    } else if (loggedInUser.role === "Employee") {
      return res.status(403).json({
        success: false,
        message: "Employees cannot delete users",
      });
    }

    // Delete image from Cloudinary if exists
    if (user.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(user.image.public_id);
      } catch (error) {
        console.error("Error deleting image:", error.message);
      }
    }

    // Delete employee permissions if exists
    if (user.role === "Employee" && user.branch) {
      await EmployeePermission.deleteOne({
        employee: user._id,
        branch: user.branch
      });
    }

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    res.clearCookie("accessToken");
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Verify token
export const verifyToken = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Get employee permissions if employee or admin
    let userWithPermissions = user.toObject();
    if ((user.role === "Employee" || user.role === "Admin") && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate('permissions', 'name');

      userWithPermissions.permissions = employeePerm ?
        employeePerm.permissions.map(p => p.name) : [];
    }

    // Add isSuperAdmin flag
    userWithPermissions.isSuperAdmin = user.role === "Super Admin";

    res.status(200).json({
      success: true,
      message: "Token is valid",
      user: userWithPermissions
    });
  } catch (error) {
    console.error("Verify token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
