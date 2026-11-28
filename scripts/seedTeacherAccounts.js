import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/database.js";
import User from "../models/User.js";
import Teacher from "../models/teachers.js";
import Branch from "../models/branch.js";
import Permission from "../models/Permission.js";
import EmployeePermission from "../models/EmployeePermission.js";

export const teachersList = [
  {
    name: "Ved Prakash",
    email: "vedprakashvp9956@gmail.com",
    phone: "6307275065",
    passwordPlain: "Ved@12345",
    expertise: ["Web Development", "Python", "Full Stack"]
  },
  {
    name: "Yogesh Pal",
    email: "yogeshpal1309@gmail.com",
    phone: "7817095043",
    passwordPlain: "Yogesh@12345",
    expertise: ["Frontend", "React", "JavaScript"]
  },
  {
    name: "Chandrama Prasad Yadav",
    email: "ch4ndrama@gmail.com",
    phone: "8887998273",
    passwordPlain: "Chandrama@12345",
    expertise: ["Programming", "C++", "Java"]
  },
  {
    name: "Asheesh Mishra",
    email: "ashishmishraftp4@gmail.com",
    phone: "7607174623",
    passwordPlain: "Asheesh@12345",
    expertise: ["Backend", "Node.js", "Database"]
  },
  {
    name: "Saurav Sir",
    email: "saurabhkumarssp@gmail.com",
    phone: "7705839870",
    passwordPlain: "Saurav@12345",
    expertise: ["Software Engineering", "Full Stack"]
  }
];

export async function seedTeachers() {
  const branch = await Branch.findOne() || null;
  const branchId = branch ? branch._id : new mongoose.Types.ObjectId("69eb32bc8e8bb1433f7cbc25");

  const permissionNames = [
    "view_batch",
    "mark_attendance",
    "view_attendance",
    "manage_assignments",
    "grade_assignment",
    "manage_lms",
    "view_lms"
  ];
  const permDocs = await Permission.find({ name: { $in: permissionNames } });
  const permIds = permDocs.map(p => p._id);

  const results = [];

  for (const t of teachersList) {
    // 1. Create or update Teacher in Teachers collection
    let teacher = await Teacher.findOne({ phone: t.phone });
    if (!teacher) {
      teacher = new Teacher({
        name: t.name,
        phone: t.phone,
        expertise: t.expertise,
        branch: branchId,
        isActive: true,
        assignedBatches: []
      });
      await teacher.save();
    } else {
      teacher.name = t.name;
      teacher.expertise = t.expertise;
      teacher.isActive = true;
      if (!teacher.branch) teacher.branch = branchId;
      await teacher.save();
    }

    // 2. Create or update User in Users collection
    let user = await User.findOne({ $or: [{ email: t.email }, { phone: t.phone }] });

    if (!user) {
      user = new User({
        name: t.name,
        email: t.email,
        phone: t.phone,
        password: t.passwordPlain, // Pre-save middleware will hash this automatically
        role: "Employee",
        branch: branchId,
        isActive: true,
        isVerified: true
      });
      await user.save();
    } else {
      user.name = t.name;
      user.email = t.email;
      user.phone = t.phone;
      user.password = t.passwordPlain; // Pre-save middleware will hash this automatically
      user.role = "Employee";
      if (!user.branch) user.branch = branchId;
      user.isActive = true;
      user.isVerified = true;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // 3. Set EmployeePermissions
    await EmployeePermission.findOneAndUpdate(
      { employee: user._id, branch: branchId },
      {
        $set: {
          permissions: permIds,
          assignedBy: user._id
        }
      },
      { upsert: true, new: true }
    );

    results.push({
      name: t.name,
      email: t.email,
      phone: t.phone,
      password: t.passwordPlain,
      userId: user._id,
      teacherId: teacher._id
    });
  }

  return results;
}

// Standalone execution
if (process.argv[1]?.endsWith("seedTeacherAccounts.js")) {
  connectDB().then(async () => {
    console.log("Seeding teacher accounts...");
    const res = await seedTeachers();
    console.log("✅ Seeded successfully:\n", JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}
