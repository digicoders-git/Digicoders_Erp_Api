// controllers/permissionController.js
import Permission from "../models/Permission.js";
import EmployeePermission from "../models/EmployeePermission.js";
import User from "../models/User.js"; // ये IMPORT करना जरूरी है

// Get all permissions
export const getAllPermissions = async (req, res) => {
  try {
    console.log("Fetching all permissions...");
    const permissions = await Permission.find().sort({ category: 1, name: 1 });
    console.log(`Found ${permissions.length} permissions`);
    
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

    // Check if employee is actually an employee
    if (employee.role !== "Employee") {
      return res.status(400).json({
        success: false,
        message: "Only employees can be assigned permissions",
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