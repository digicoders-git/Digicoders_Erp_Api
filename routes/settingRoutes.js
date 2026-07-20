import express from "express";
import Setting from "../models/setting.js";

const router = express.Router();

// Get the global setting (creates one if not exists)
router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ isCertificationEnabled: false });
    }
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update the global setting
router.put("/", async (req, res) => {
  try {
    const { isCertificationEnabled } = req.body;
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ isCertificationEnabled });
    } else {
      setting.isCertificationEnabled = isCertificationEnabled;
      await setting.save();
    }
    res.json({ success: true, data: setting, message: "Setting updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
