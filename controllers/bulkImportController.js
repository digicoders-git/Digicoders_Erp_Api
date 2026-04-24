import XLSX from "xlsx";
import fs from "fs";
import Registration from "../models/regsitration.js";
import TechnologyModal from "../models/technology.js";
import Education from "../models/education.js";
import Hr from "../models/manageHr.js";
import TranningModal from "../models/tranning.js";
import Branch from "../models/branch.js";
import College from "../models/college.js";
import Fee from "../models/fee.js";

export const bulkImportRegistrations = async (req, res) => {
  const filePath = req.file?.path;

  if (!filePath) {
    return res.status(400).json({ success: false, message: "Excel file required" });
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    // Pre-load all lookup data once (performance)
    const [allTechs, allEducations, allHrs, allTrainings, allBranches, allColleges] = await Promise.all([
      TechnologyModal.find({}, "name _id"),
      Education.find({}, "name _id"),
      Hr.find({}, "name _id"),
      TranningModal.find({}, "name _id"),
      Branch.find({}, "name _id"),
      College.find({}, "name _id"),
    ]);

    const normalize = (str) => String(str || "").trim().toLowerCase();

    const findId = (list, name) => {
      const n = normalize(name);
      return list.find((item) => normalize(item.name) === n)?._id || null;
    };

    const results = { success: [], failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1=header, so data starts at 2)

      try {
        // Map Excel columns → model fields (exact column names from your Excel)
        const mobile = String(row["Student Primary Mobile *"] || "").trim();
        const studentName = String(row["Student Name *"] || "").trim();
        const fatherName = String(row["Father's / Guardian's Name *"] || "").trim();
        const email = String(row["Student Email (Optional)"] || "").trim().toLowerCase();
        const whatshapp = String(row["WhatsApp Number"] || mobile).trim();
        const alternateMobile = String(row["Alternate Mobile (Optional)"] || "").trim();
        const eduYear = String(row["Year *"] || "").trim();
        const remark = String(row["Remark"] || "").trim();
        const tnxId = String(row["Transaction ID / UTR"] || "").trim();

        // Amount / fee fields
        const totalFeeFromExcel = Number(row["Total Fee Amount *"] || 0);
        const amount = Number(row["Registration Amount *"] || 0);
        const discount = Number(row["Discount Amount"] || 0);
        const discountRemark = String(row["Discount Remark"] || "").trim();
        
        // Payment fields
        const paymentMethodRaw = String(row["Payment Method"] || "cash").trim().toLowerCase();
        const paymentTypeRaw = String(row["Payment Type"] || "registration").trim().toLowerCase();
        const qrCodeName = String(row["QR Code (if UPI)"] || "").trim();

        // Map payment method
        let paymentMethod = "cash";
        if (paymentMethodRaw.includes("online") || paymentMethodRaw.includes("upi")) paymentMethod = "upi_qr";
        else if (paymentMethodRaw.includes("pos")) paymentMethod = "pos";
        else if (paymentMethodRaw.includes("cash")) paymentMethod = "cash";

        // Map payment type
        let paymentType = "registration";
        if (paymentTypeRaw.includes("full")) paymentType = "full";
        else if (paymentTypeRaw.includes("registration")) paymentType = "registration";

        // Lookup names → ObjectIds
        // IMPORTANT: Excel "Technology *" column actually contains Education (Diploma, B.Tech etc.)
        // Real technology (MERN, Python etc.) is not in Excel, so we use "Other" as default
        const educationName = String(row["Technology *"] || "").trim(); // Excel column name is misleading
        const hrNameVal = String(row["Admission By *"] || "").trim();
        const trainingName = String(row["Training *"] || "").trim();
        const branchName = String(row["Branch / Mode *"] || "").trim();
        const collegeName = String(row["College Name *"] || "").trim();

        const errors = [];

        if (!mobile || !/^\d{10}$/.test(mobile)) errors.push("mobile: valid 10-digit number required");
        if (!studentName) errors.push("studentName: Student Name is required");
        if (!fatherName) errors.push("fatherName: Father's Name is required");

        // Use "Other" technology as default since Excel doesn't have actual technology column
        const technologyId = findId(allTechs, "Other");
        if (!technologyId) {
          errors.push("technology: Default 'Other' technology not found in DB. Please create it first.");
        }

        const educationId = findId(allEducations, educationName);
        if (!educationName) {
          errors.push("education: Education (Technology * column) is required");
        } else if (!educationId) {
          errors.push(`education: "${educationName}" not found. Available: ${allEducations.map((e) => e.name).join(", ")}`);
        }

        const trainingId = findId(allTrainings, trainingName);
        if (!trainingName) {
          errors.push("training: Training is required");
        } else if (!trainingId) {
          errors.push(`training: "${trainingName}" not found. Available: ${allTrainings.map((t) => t.name).join(", ")}`);
        }

        const hrId = hrNameVal ? findId(allHrs, hrNameVal) : null;
        if (hrNameVal && !hrId) {
          errors.push(`hrName: "${hrNameVal}" not found. Available: ${allHrs.map((h) => h.name).join(", ")}`);
        }

        const branchId = branchName ? findId(allBranches, branchName) : null;
        if (branchName && !branchId) {
          errors.push(`branch: "${branchName}" not found. Available: ${allBranches.map((b) => b.name).join(", ")}`);
        }

        const collegeId = collegeName ? findId(allColleges, collegeName) : null;
        if (collegeName && !collegeId) {
          errors.push(`collegeName: "${collegeName}" not found. Available: ${allColleges.slice(0, 10).map((c) => c.name).join(", ")}...`);
        }

        if (errors.length) {
          results.failed.push({ row: rowNum, studentName: studentName || `Row ${rowNum}`, mobile, errors });
          continue;
        }

        // Check duplicate mobile
        const existing = await Registration.findOne({ mobile });
        if (existing) {
          results.failed.push({ row: rowNum, studentName, mobile, errors: [`mobile ${mobile} already registered`] });
          continue;
        }

        // Get technology price from DB
        const techDoc = await TechnologyModal.findById(technologyId).select("price");
        const totalFee = techDoc?.price || totalFeeFromExcel || 0;
        const finalFee = totalFee - discount;
        const paidAmount = amount;
        const dueAmount = Math.max(finalFee - paidAmount, 0);

        const newReg = await Registration.create({
          mobile,
          whatshapp: whatshapp || mobile,
          studentName,
          fatherName,
          email: email || undefined,
          alternateMobile: alternateMobile || undefined,
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
          tnxId: tnxId || undefined,
          tnxStatus: paidAmount > 0 ? "paid" : "pending",
          trainingFeeStatus: paidAmount >= finalFee ? "full paid" : paidAmount > 0 ? "partial" : "pending",
          status: "new",
          password: mobile, // default password = mobile number
        });

        // Create fee record if amount > 0
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
            tnxId: tnxId || undefined,
          });
        }

        results.success.push({ row: rowNum, studentName, mobile, registrationId: newReg._id, userid: newReg.userid });
      } catch (rowErr) {
        results.failed.push({
          row: rowNum,
          studentName: String(rows[i]["Student Name *"] || `Row ${rowNum}`),
          mobile: String(rows[i]["Student Primary Mobile *"] || ""),
          errors: [rowErr.message],
        });
      }
    }

    // Cleanup uploaded file
    fs.unlink(filePath, () => {});

    return res.status(200).json({
      success: true,
      message: `Import complete. ${results.success.length} inserted, ${results.failed.length} failed.`,
      inserted: results.success.length,
      failed: results.failed.length,
      successList: results.success,
      failedList: results.failed,
    });
  } catch (err) {
    fs.unlink(filePath, () => {});
    return res.status(500).json({ success: false, message: "Import failed", error: err.message });
  }
};
