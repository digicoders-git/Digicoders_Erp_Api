import express from "express";
import jwt from "jsonwebtoken";
import Setting from "../models/setting.js";
import { auth, authorize } from "../middleware/auth.js";

const router = express.Router();

// Get global settings (creates default if not exists)
// Public sees only student-relevant flags; Admins see full config including Master OTP
router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        isCertificationEnabled: false,
        masterOtp: "123456",
        isMasterOtpEnabled: true,
      });
    }

    // Check if requester is Admin or Super Admin
    let isAdmin = false;
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.accessToken;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && (decoded.role === "Super Admin" || decoded.role === "Admin")) {
          isAdmin = true;
        }
      }
    } catch (e) {
      // Not admin or invalid token
    }

    const responseData = {
      isCertificationEnabled: setting.isCertificationEnabled,
    };

    if (isAdmin) {
      responseData.masterOtp = setting.masterOtp || "123456";
      responseData.isMasterOtpEnabled = setting.isMasterOtpEnabled !== false;
    }

    res.json({ success: true, data: responseData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update the global setting (Super Admin only)
router.put("/", auth, authorize(["Super Admin"]), async (req, res) => {
  try {
    const { isCertificationEnabled, masterOtp, isMasterOtpEnabled } = req.body;
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        isCertificationEnabled: isCertificationEnabled || false,
        masterOtp: masterOtp ? String(masterOtp).trim() : "123456",
        isMasterOtpEnabled: isMasterOtpEnabled !== undefined ? isMasterOtpEnabled : true,
      });
    } else {
      if (typeof isCertificationEnabled !== "undefined") {
        setting.isCertificationEnabled = isCertificationEnabled;
      }
      if (typeof masterOtp !== "undefined") {
        setting.masterOtp = String(masterOtp).trim();
      }
      if (typeof isMasterOtpEnabled !== "undefined") {
        setting.isMasterOtpEnabled = isMasterOtpEnabled;
      }
      await setting.save();
    }
    res.json({ success: true, data: setting, message: "Settings updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Seed or update teacher accounts
router.post("/seed-teachers", async (req, res) => {
  try {
    const { seedTeachers } = await import("../scripts/seedTeacherAccounts.js");
    const results = await seedTeachers();
    res.json({ success: true, message: "Teachers seeded/updated successfully", data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
