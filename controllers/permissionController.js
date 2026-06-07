// controllers/permissionController.js
import Permission from "../models/Permission.js";
import EmployeePermission from "../models/EmployeePermission.js";
import User from "../models/User.js"; // ये IMPORT करना जरूरी है

// Get all permissions
export const getAllPermissions = async (req, res) => {
  try {
    console.log("Fetching all permissions...");
    let permissions;

    if (req.user.role === "Admin") {
      // Admin can only see permissions that are assigned to them
      const adminPermissions = await EmployeePermission.findOne({
        employee: req.user._id,
        branch: req.user.branch
      }).populate('permissions');

      permissions = adminPermissions ? adminPermissions.permissions : [];
      console.log(`Admin ${req.user.name} has ${permissions.length} permissions`);
    } else {
      // Super Admin can see all permissions
      permissions = await Permission.find().sort({ category: 1, name: 1 });
      console.log(`Found ${permissions.length} permissions`);
    }
    
    res.status(200).json({
      success: true,
      data: permissions, // Array return करें, object नहीं
    });
  } catch (error) {
    console.error("Get all permissions error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employee permissions
export const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log(`Fetching permissions for employee: ${employeeId}`);

    // Find employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if current user can view this employee's permissions
    if (req.user.role === "Admin") {
      // Admin can only view employees from their branch
      const employeeBranch = employee.branch?.toString();
      const userBranch = req.user.branch?._id?.toString();
      
      if (employeeBranch !== userBranch) {
        return res.status(403).json({
          success: false,
          message: "You can only view permissions for employees in your branch",
        });
      }
    }

    // Get employee permissions
    const employeePerm = await EmployeePermission.findOne({
      employee: employeeId,
      branch: employee.branch || req.user.branch
    }).populate("permissions", "name description category");

    const permissions = employeePerm ? employeePerm.permissions : [];

    res.status(200).json({
      success: true,
      data: {
        permissions: permissions,
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          branch: employee.branch
        }
      },
    });
  } catch (error) {
    console.error("Get employee permissions error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Assign permissions to employee
export const assignPermissions = async (req, res) => {
  try {
    const { employeeId, permissionIds } = req.body;
    const assignedBy = req.user._id;

    // console.log("Assigning permissions:", {
    //   employeeId,
    //   permissionIds,
    //   assignedBy
    // });

    // Validate input
    if (!employeeId || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and permission IDs array required",
      });
    }

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if user has permission to assign permissions
    if (req.user.role === "Admin") {
      // Admin can only assign to employees in their branch
      const employeeBranch = employee.branch?.toString();
      const userBranch = req.user.branch?._id?.toString();

      if (employeeBranch !== userBranch) {
        return res.status(403).json({
          success: false,
          message: "You can only assign permissions to employees in your branch",
        });
      }
    }

    // Check if employee is actually an employee or admin
    if (employee.role !== "Employee" && employee.role !== "Admin") {
      return res.status(400).json({
        success: false,
        message: "Only employees and admins can be assigned permissions",
      });
    }

    // Verify permissions exist
    const permissions = await Permission.find({
      _id: { $in: permissionIds }
    });

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some permissions are invalid or inactive",
      });
    }

    // Check if Admin is trying to assign permissions they don't have
    if (req.user.role === "Admin") {
      const adminPermissions = await EmployeePermission.findOne({
        employee: req.user._id,
        branch: req.user.branch
      });

      const adminPermissionIds = adminPermissions ? adminPermissions.permissions.map(p => p.toString()) : [];
      
      // Check if all requested permissions are in admin's permissions
      const unauthorizedPermissions = permissionIds.filter(permId => 
        !adminPermissionIds.includes(permId.toString())
      );

      if (unauthorizedPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          message: "You can only assign permissions that are assigned to you",
        });
      }
    }

    // Get employee's branch
    const employeeBranch = employee.branch;

    // Create or update employee permissions
    const employeePermission = await EmployeePermission.findOneAndUpdate(
      { 
        employee: employeeId,
        branch: employeeBranch
      },
      {
        employee: employeeId,
        branch: employeeBranch,
        permissions: permissionIds,
        assignedBy: assignedBy,
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    ).populate("permissions", "name description category");

    console.log("Permissions assigned successfully:", employeePermission);

    res.status(200).json({
      success: true,
      message: "Permissions assigned successfully",
      data: employeePermission,
    });
  } catch (error) {
    console.error("Assign permissions error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};