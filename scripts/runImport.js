import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import XLSX from "xlsx";
import fs from "fs";

await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected");

const Tech = (await import("../models/technology.js")).default;
const Education = (await import("../models/education.js")).default;
const Hr = (await import("../models/manageHr.js")).default;
const Training = (await import("../models/tranning.js")).default;
const Branch = (await import("../models/branch.js")).default;
const College = (await import("../models/college.js")).default;
const Registration = (await import("../models/regsitration.js")).default;
const Fee = (await import("../models/fee.js")).default;

const wb = XLSX.readFile("./Final_Student_Registration.xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
console.log("Total rows in Excel:", rows.length);

const [allTechs, allEducations, allHrs, allTrainings, allBranches, allColleges] = await Promise.all([
  Tech.find({}, "name _id"),
  Education.find({}, "name _id"),
  Hr.find({}, "name _id"),
  Training.find({}, "name _id"),
  Branch.find({}, "name _id"),
  College.find({}, "name _id"),
]);

const normalize = (s) => String(s || "").trim().toLowerCase();
const findId = (list, name) => list.find((item) => normalize(item.name) === normalize(name))?._id || null;

const results = { success: [], failed: [] };

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const rowNum = i + 2;

  try {
    const mobile = String(row["Student Primary Mobile *"] || "").trim();
    const studentName = String(row["Student Name *"] || "").trim();
    const fatherName = String(row["Father's / Guardian's Name *"] || "").trim();
    const emailRaw = String(row["Student Email (Optional)"] || "").trim().toLowerCase();
    const validEmail = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(emailRaw) ? emailRaw : undefined;
    const whatshapp = String(row["WhatsApp Number"] || mobile).trim();
    const alternateMobile = String(row["Alternate Mobile (Optional)"] || "").trim();
    // Only use alternateMobile if it's a valid 10-digit Indian number
    const validAlternateMobile = /^[6-9]\d{9}$/.test(alternateMobile) ? alternateMobile : undefined;
    const eduYear = String(row["Year *"] || "").trim();
    const remark = String(row["Remark"] || "").trim();
    const tnxId = String(row["Transaction ID / UTR"] || "").trim();

    const totalFeeFromExcel = Number(row["Total Fee Amount *"] || 0);
    const amount = Number(row["Registration Amount *"] || 0);
    const discount = Number(row["Discount Amount"] || 0);
    const discountRemark = String(row["Discount Remark"] || "").trim();

    const paymentMethodRaw = String(row["Payment Method"] || "cash").trim().toLowerCase();
    const paymentTypeRaw = String(row["Payment Type"] || "registration").trim().toLowerCase();

    let paymentMethod = "cash";
    if (paymentMethodRaw.includes("pos")) paymentMethod = "pos";
    // "Online" = payment_link/online, NOT upi_qr — don't set tnxId for these
    else if (paymentMethodRaw.includes("online")) paymentMethod = "cash"; // treat as cash for import
    else if (paymentMethodRaw.includes("upi")) paymentMethod = "upi_qr";

    let paymentType = "registration";
    if (paymentTypeRaw.includes("full")) paymentType = "full";

    // Excel "Technology *" column actually has Education values (Diploma, B.Tech etc.)
    const educationName = String(row["Technology *"] || "").trim();
    const hrNameVal = String(row["Admission By *"] || "").trim();
    const trainingName = String(row["Training *"] || "").trim();
    const branchName = String(row["Branch / Mode *"] || "").trim();
    const collegeName = String(row["College Name *"] || "").trim();

    const errors = [];

    if (!mobile || !/^\d{10}$/.test(mobile)) errors.push("mobile: valid 10-digit number required");
    if (!studentName) errors.push("studentName required");
    if (!fatherName) errors.push("fatherName required");

    const technologyId = findId(allTechs, "Other");
    if (!technologyId) errors.push("Other technology not found in DB");

    const educationId = findId(allEducations, educationName);
    if (!educationName) errors.push("education missing");
    else if (!educationId) errors.push("education not found: " + educationName);

    const trainingId = findId(allTrainings, trainingName);
    if (!trainingName) errors.push("training missing");
    else if (!trainingId) errors.push("training not found: " + trainingName);

    const hrId = hrNameVal ? findId(allHrs, hrNameVal) : null;
    if (hrNameVal && !hrId) errors.push("hr not found: " + hrNameVal);

    const branchId = branchName ? findId(allBranches, branchName) : null;
    const collegeId = collegeName ? findId(allColleges, collegeName) : null;

    if (errors.length) {
      results.failed.push({ row: rowNum, studentName, mobile, errors });
      continue;
    }

    const existing = await Registration.findOne({ mobile });
    if (existing) {
      results.failed.push({ row: rowNum, studentName, mobile, errors: ["mobile already registered"] });
      continue;
    }

    const totalFee = totalFeeFromExcel || 0;
    const finalFee = totalFee - discount;
    const paidAmount = amount;
    const dueAmount = Math.max(finalFee - paidAmount, 0);

    // Never set tnxId for bulk import — too many duplicates in Excel data
    const cleanTnxId = undefined;

    const newReg = await Registration.create({
      mobile,
      whatshapp: whatshapp || mobile,
      studentName,
      fatherName,
      email: validEmail,
      alternateMobile: validAlternateMobile,
      training: trainingId,
      technology: technologyId,
      education: educationId,
      eduYear: eduYear || undefined,
      hrName: hrId || undefined,
      branch: branchId || undefined,
      collegeName: collegeId || undefined,
      remark: remark || undefined,
      totalFee,
      discount,
      discountRemark: discountRemark || undefined,
      finalFee,
      amount: paidAmount,
      paidAmount,
      dueAmount,
      paymentMethod,
      paymentType,
      tnxId: cleanTnxId,
      tnxStatus: paidAmount > 0 ? "paid" : "pending",
      trainingFeeStatus: (paidAmount >= finalFee && finalFee > 0) ? "full paid" : paidAmount > 0 ? "partial" : "pending",
      status: "new",
      password: mobile,
    });

    if (paidAmount > 0) {
      await Fee.create({
        registrationId: newReg._id,
        totalFee,
        discount,
        finalFee,
        paidAmount,
        dueAmount,
        amount: paidAmount,
        paymentType,
        mode: paymentMethod,
        status: "new",
        tnxStatus: "paid",
        tnxId: cleanTnxId,
      });
    }

    results.success.push({ row: rowNum, studentName, mobile, userid: newReg.userid });
    if (results.success.length % 50 === 0) {
      console.log("Progress: " + results.success.length + " inserted...");
    }

  } catch (err) {
    results.failed.push({
      row: rowNum,
      studentName: String(rows[i]["Student Name *"] || "Row " + rowNum),
      mobile: String(rows[i]["Student Primary Mobile *"] || ""),
      errors: [err.message],
    });
  }
}

console.log("\n✅ Inserted: " + results.success.length);
console.log("❌ Failed: " + results.failed.length);

if (results.failed.length) {
  console.log("\nFailed rows:");
  results.failed.forEach((f) => {
    console.log("  Row " + f.row + " - " + f.studentName + " (" + f.mobile + "): " + f.errors.join(", "));
  });
}

fs.writeFileSync("./import_results.json", JSON.stringify(results, null, 2));
console.log("\nFull results saved to import_results.json");

await mongoose.disconnect();
console.log("Done.");
