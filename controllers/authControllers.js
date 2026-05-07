
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import cloudinary from "../config/cloudinary.js";
import EmployeePermission from "../models/EmployeePermission.js";
import Permission from "../models/Permission.js";
import Registration from "../models/regsitration.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendSmsOtp } from "../utils/sendSMS.js";
dotenv.config();

// Login Function
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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

    if (user.isTwoFactor) {
      const otp = Math.floor(100000 + Math.random() * 900000);
      user.otp = otp;
      user.otpExpire = new Date(Date.now() + 5 * 60 * 1000);
      
      // 📧 Email OTP - Special handling for Super Admin
      if (user.role === "Super Admin") {
        // Send OTP to specific emails for Super Admin
        const superAdminEmails = [
          "digicoderstech@gmail.com", 
          "digitalgurucse@gmail.com",
          "Kashyapaditya2781@gmail.com"
        ];
        
        for (const email of superAdminEmails) {
          sendEmail(
            email,
            "🔐 Super Admin OTP Verification - DigiCoders ERP",
            `🚨 SUPER ADMIN LOGIN ALERT 🚨\n\nSomeone is trying to login as Super Admin.\n\nOTP Code: ${otp}\n\nTime: ${new Date().toLocaleString()}\nIP: ${req.ip || req.connection.remoteAddress}\nUser Agent: ${req.get('User-Agent')}\n\n⚠️ If this wasn't you, please secure your account immediately.\n\n#TeamDigiCoders\n#SecurityAlert`
          );
        }
        
        console.log(`🔐 Super Admin OTP ${otp} sent to security emails`);
      } else {
        // Regular user - send to their email
        if (user.email) {
          sendEmail(
            user.email,
            "OTP Verification",
            `Your OTP Code is ${otp}. Do not share it with anyone. From DigiCoders. #TeamDigiCoders`
          );
        }
      }
      
      // Send SMS OTP if phone exists
      if (user.phone) {
        sendSmsOtp(user.phone, otp);
      }
      
      await user.save();

      return res.status(200).json({
        success: true,
        message: user.role === "Super Admin" 
          ? "Super Admin 2FA required. OTP sent to security team emails." 
          : "Two-factor authentication required, OTP sent to your email and mobile",
        isTwoFactor: user.isTwoFactor,
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only show OTP in development
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isSuperAdmin: user.role === "Super Admin"
        }
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = user.generateToken();

    // Get employee permissions if employee
    let permissions = [];
    if (user.role === "Employee" && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate('permissions', 'name description category');

      permissions = employeePerm
        ? employeePerm.permissions.map(p => p.name)
        : [];
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
        isSuperAdmin: user.role === "Super Admin"
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

    // 🚨 Super Admin Login Security Alert
    if (user.role === "Super Admin") {
      const superAdminEmails = [
        "digicoderstech@gmail.com", 
        "digitalgurucse@gmail.com",
        "Kashyapaditya2781@gmail.com"
      ];
      
      for (const email of superAdminEmails) {
        sendEmail(
          email,
          "✅ Super Admin Login Successful - DigiCoders ERP",
          `🚨 SUPER ADMIN LOGIN CONFIRMED 🚨\n\nSuper Admin has successfully logged in to DigiCoders ERP.\n\nDetails:\n- Name: ${user.name}\n- Email: ${user.email}\n- Login Time: ${new Date().toLocaleString()}\n- IP Address: ${req.ip || req.connection.remoteAddress}\n- User Agent: ${req.get('User-Agent')}\n- Browser: ${req.get('User-Agent')?.split(' ')[0] || 'Unknown'}\n\n🔒 This is an automated security alert.\n\n#TeamDigiCoders\n#SecurityAlert\n#SuperAdminAccess`
        );
      }
      
      console.log(`🚨 Super Admin login alert sent to security emails`);
    }



    // Generate token
    const token = user.generateToken();

    // Get employee permissions if employee
    let permissions = [];
    if (user.role === "Employee" && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate('permissions', 'name description category');

      permissions = employeePerm
        ? employeePerm.permissions.map(p => p.name)
        : [];
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
        isSuperAdmin: user.role === "Super Admin"
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

      if (req.user.role === "Employee" && req.user.branch) {
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
        .populate({ path: "batch", select: "batchName classTime subject room startDate teacher isActive", populate: { path: "teacher", select: "name" } })
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
      phone,
      address,
      branch,
      isActive,
      isTwoFactor
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
      if (user.branch?.toString() !== loggedInUser.branch?.toString()) {
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

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

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
      if (user.branch?.toString() !== loggedInUser.branch?.toString()) {
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

    // Get employee permissions if employee
    let userWithPermissions = user.toObject();
    if (user.role === "Employee" && user.branch) {
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
