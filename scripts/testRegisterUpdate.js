import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected");

const Registration = (await import("../models/regsitration.js")).default;
const Tech = (await import("../models/technology.js")).default;
const Education = (await import("../models/education.js")).default;
const Training = (await import("../models/tranning.js")).default;
const Branch = (await import("../models/branch.js")).default;

// Get real IDs from DB
const tech = await Tech.findOne({ isActive: true });
const edu = await Education.findOne();
const training = await Training.findOne();
const branch = await Branch.findOne();

console.log("Using:");
console.log("  tech    :", tech?.name, tech?._id, "price:", tech?.price);
console.log("  edu     :", edu?.name, edu?._id);
console.log("  training:", training?.name, training?._id);
console.log("  branch  :", branch?.name, branch?._id);

// Cleanup old test
await Registration.deleteOne({ mobile: "9999988888" });

// ─── STEP 1: REGISTER ───────────────────────────────────────────────────────
const totalFee = tech.price;
const discount = 0;
const finalFee = totalFee - discount;
const amount = 500;

const reg = await Registration.create({
  mobile: "9999988888",
  whatshapp: "9999988888",
  studentName: "Test Student",
  fatherName: "Test Father",
  training: training._id,
  technology: tech._id,
  education: edu._id,
  branch: branch._id,
  eduYear: "2nd Year",
  totalFee,
  discount,
  finalFee,
  amount,
  paidAmount: amount,
  dueAmount: finalFee - amount,
  paymentType: "registration",
  paymentMethod: "cash",
  tnxStatus: "paid",
  trainingFeeStatus: "partial",
  status: "new",
  password: "9999988888",
});

console.log("\n✅ STEP 1 - REGISTRATION CREATED:");
console.log("  _id      :", reg._id);
console.log("  userid   :", reg.userid);
console.log("  name     :", reg.studentName);
console.log("  totalFee :", reg.totalFee);
console.log("  finalFee :", reg.finalFee);
console.log("  paidAmount:", reg.paidAmount);
console.log("  dueAmount:", reg.dueAmount);

// ─── STEP 2: UPDATE via controller logic ────────────────────────────────────
const student = await Registration.findById(reg._id).populate("technology");

// Simulate what updateRegistration controller does with FormData fields
const body = {
  studentName: "Test Student UPDATED",
  fatherName: "Test Father UPDATED",
  gender: "male",
  address: "123 Test Street, Lucknow",
  district: "Lucknow",
  pincode: "226001",
  eduYear: "3rd Year",
  remark: "Updated via API test",
  idCardIssued: "true",
  certificateIssued: "false",
  hardForm: "true",
  isJoin: "true",
  joiningData: "2025-01-15",
  education: edu._id.toString(),
  branch: branch._id.toString(),
};

if (body.whatshapp) student.whatshapp = body.whatshapp;
if (body.studentName) student.studentName = body.studentName;
if (body.eduYear) student.eduYear = body.eduYear;
if (body.fatherName) student.fatherName = body.fatherName;
if (body.joiningData) student.joiningData = body.joiningData;
if (typeof body.isJoin !== "undefined") student.isJoin = body.isJoin;
if (body.gender) student.gender = body.gender;
if (body.address) student.address = body.address;
if (body.district) student.district = body.district;
if (body.pincode) student.pincode = body.pincode;
if (typeof body.idCardIssued !== "undefined") student.idCardIssued = body.idCardIssued;
if (typeof body.certificateIssued !== "undefined") student.certificateIssued = body.certificateIssued;
if (typeof body.hardForm !== "undefined") student.hardForm = body.hardForm;
if (body.remark) student.remark = body.remark;
if (body.education) student.education = body.education;
if (body.branch) student.branch = body.branch;

await student.save();

const updated = await Registration.findById(reg._id)
  .populate("education", "name")
  .populate("branch", "name");

console.log("\n✅ STEP 2 - REGISTRATION UPDATED:");
console.log("  name       :", updated.studentName);
console.log("  fatherName :", updated.fatherName);
console.log("  gender     :", updated.gender);
console.log("  address    :", updated.address);
console.log("  district   :", updated.district);
console.log("  pincode    :", updated.pincode);
console.log("  eduYear    :", updated.eduYear);
console.log("  remark     :", updated.remark);
console.log("  idCardIssued:", updated.idCardIssued);
console.log("  hardForm   :", updated.hardForm);
console.log("  isJoin     :", updated.isJoin);
console.log("  education  :", updated.education?.name);
console.log("  branch     :", updated.branch?.name);

// ─── CLEANUP ────────────────────────────────────────────────────────────────
await Registration.deleteOne({ _id: reg._id });
console.log("\n🧹 Test data cleaned up.");

await mongoose.disconnect();
console.log("✅ All tests passed!");
