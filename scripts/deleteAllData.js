import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected");

const Registration = (await import("../models/regsitration.js")).default;
const Fee = (await import("../models/fee.js")).default;
const TechnologyModal = (await import("../models/technology.js")).default;
const Education = (await import("../models/education.js")).default;
const Hr = (await import("../models/manageHr.js")).default;
const Training = (await import("../models/tranning.js")).default;
const Branch = (await import("../models/branch.js")).default;
const College = (await import("../models/college.js")).default;
const Batch = (await import("../models/batchs.js")).default;
const Tag = (await import("../models/tag.js")).default;
const QrCode = (await import("../models/qrCode.js")).default;
const Assignment = (await import("../models/assignment.js")).default;
const Attendance = (await import("../models/attendance.js")).default;
const Duration = (await import("../models/durationModel.js")).default;
const Course = (await import("../models/courseModel.js")).default;
const Industry = (await import("../models/industry.js")).default;
const Company = (await import("../models/company.js")).default;
const Job = (await import("../models/Job.js")).default;
const JobApplication = (await import("../models/jobApplication.js")).default;
const Submission = (await import("../models/submission.js")).default;

const models = [
  { name: "Registration", model: Registration },
  { name: "Fee", model: Fee },
  { name: "Technology", model: TechnologyModal },
  { name: "Education", model: Education },
  { name: "Hr", model: Hr },
  { name: "Training", model: Training },
  { name: "Branch", model: Branch },
  { name: "College", model: College },
  { name: "Batch", model: Batch },
  { name: "Tag", model: Tag },
  { name: "QrCode", model: QrCode },
  { name: "Assignment", model: Assignment },
  { name: "Attendance", model: Attendance },
  { name: "Duration", model: Duration },
  { name: "Course", model: Course },
  { name: "Industry", model: Industry },
  { name: "Company", model: Company },
  { name: "Job", model: Job },
  { name: "JobApplication", model: JobApplication },
  { name: "Submission", model: Submission },
];

for (const { name, model } of models) {
  try {
    const result = await model.deleteMany({});
    console.log("✅ " + name + " — deleted " + result.deletedCount + " records");
  } catch (err) {
    console.log("❌ " + name + " — error: " + err.message);
  }
}

console.log("\nDone. SuperAdmin & Permissions untouched.");
await mongoose.disconnect();
