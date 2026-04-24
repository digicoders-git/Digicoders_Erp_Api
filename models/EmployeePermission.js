// models/EmployeePermission.js
import mongoose from "mongoose";

const employeePermissionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    permissions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
    }],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique employee-branch combination
employeePermissionSchema.index({ employee: 1, branch: 1 }, { unique: true });

export default mongoose.model("EmployeePermission", employeePermissionSchema);