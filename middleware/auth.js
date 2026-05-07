
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import EmployeePermission from "../models/EmployeePermission.js";
import Registration from "../models/regsitration.js";

export const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user without password field
    const user = await User.findById(decoded.id)
      .select("-password")
      .populate("branch", "name address");

    let student = null;
    if (!user) {
      student = await Registration.findById(decoded.id)
        .select("-password -otp -otpExpire")
        .populate("training", "name duration")
        .populate("technology", "name price")
        .populate("education", "name")
        .populate("branch", "name address")
        .populate("hrName", "name email")
        .populate("collegeName", "name district")
        .populate("batch", "batchName startDate endDate")
        .populate("tag", "name");
    }

    if (!user && !student) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user && !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    // For Employee role, fetch permissions
    if (user && user.role === "Employee" && user.branch) {
      const employeePerm = await EmployeePermission.findOne({
        employee: user._id,
        branch: user.branch
      }).populate("permissions", "name description category");

      // Add permissions to user object
      user.permissions = employeePerm ?
        employeePerm.permissions.map(p => p.name) : [];
    }

    // Add isSuperAdmin flag
    if (user) {
      user.isSuperAdmin = user.role === "Super Admin";
    }

    // Attach user to request
    req.user = user;
    req.student = student;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error,",
      error,
    });
  }
};

// Permission checking middleware
export const authorize = (roles = [], requiredPermission = null) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check role
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient role.",
      });
    }

    // Check permissions for Employee
    if (req.user.role === "Employee" && requiredPermission) {
      if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Insufficient permissions.",
        });
      }
    }

    next();
  };
};

// Branch filter middleware
export const filterByBranch = (model) => {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) return next();

    if (user.isSuperAdmin) {
      return next(); // Super Admin sees all
    }

    // For Admin and Employee, filter by their branch
    if (user.branch) {
      // For mongoose queries, we can attach this to the request
      req.branchFilter = { branch: user.branch?._id || user.branch };
    }

    next();
  };
};