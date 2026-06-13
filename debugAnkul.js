import mongoose from "mongoose";
import User from "./models/User.js";
import Teacher from "./models/teachers.js";
import EmployeePermission from "./models/EmployeePermission.js";
import Batch from "./models/batchs.js";
import Branch from "./models/branch.js";
import dotenv from "dotenv";

dotenv.config();

async function debugAnkul() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // 1. Check User
    const user = await User.findOne({ email: "ankul@gmail.com" }).populate("branch");
    if (!user) {
      console.log("User 'ankul@gmail.com' not found.");
      return;
    }
    console.log(`User found: ${user.name} | Phone: ${user.phone} | Branch: ${user.branch?.name} (${user.branch?._id})`);

    // 2. Check permissions (skip population to avoid missing schema)
    const perms = await EmployeePermission.findOne({ employee: user._id });
    console.log("Permissions count:", perms ? perms.permissions?.length || 0 : "None");

    // 3. Check if he is a teacher
    if (user.phone) {
      const teacher = await Teacher.findOne({ phone: user.phone });
      if (teacher) {
        console.log(`Found as Teacher: ${teacher.name} | Assigned Batches count: ${teacher.assignedBatches.length}`);
      } else {
        console.log("Not a teacher.");
      }
    }

    // 4. Check Batches in his branch
    if (user.branch) {
      const branchBatches = await Batch.find({ branch: user.branch._id });
      console.log(`Total batches in branch '${user.branch.name}': ${branchBatches.length}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

debugAnkul();
