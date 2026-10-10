import CertificateData from "../models/certificateData.js";

// ─────────────────────────────────────────────
// GET /api/certificate-data/search
// Query params: mobile  OR  dctNumber
// ─────────────────────────────────────────────
export const searchCertificateData = async (req, res) => {
  try {
    const { mobile, dctNumber } = req.query;

    if (!mobile && !dctNumber) {
      return res.status(400).json({
        success: false,
        message: "mobile ya dctNumber mein se koi ek parameter zaroor do",
      });
    }

    const query = {};

    if (mobile) {
      // mobile number se search (exact ya partial match)
      query.mobile = { $regex: mobile.trim(), $options: "i" };
    }

    if (dctNumber) {
      // DCT number se search — DCT/2026/2877 ya DCT-2026-2877 dono accept karo
      const normalized = dctNumber.trim().replace(/\//g, "/").toUpperCase();
      query.dctNumber = { $regex: normalized, $options: "i" };
    }

    const records = await CertificateData.find(query).sort({ createdAt: -1 });

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Koi record nahi mila",
      });
    }

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("searchCertificateData error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/certificate-data/:id
// MongoDB _id se single record
// ─────────────────────────────────────────────
export const getCertificateDataById = async (req, res) => {
  try {
    const record = await CertificateData.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record nahi mila",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("getCertificateDataById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/certificate-data/
// Sare records (pagination ke saath)
// ─────────────────────────────────────────────
export const getAllCertificateData = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;

    const total   = await CertificateData.countDocuments();
    const records = await CertificateData.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("getAllCertificateData error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/certificate-data/
// Create / Upsert Certificate Record
// ─────────────────────────────────────────────
export const createCertificateData = async (req, res) => {
  try {
    const { dctNumber, refNo } = req.body;
    const certificateNumber = dctNumber || refNo;

    if (!certificateNumber) {
      return res.status(400).json({
        success: false,
        message: "dctNumber ya refNo required hai",
      });
    }

    const payload = {
      ...req.body,
      dctNumber: (dctNumber || refNo).trim().toUpperCase(),
      refNo: (refNo || dctNumber).trim().toUpperCase(),
    };

    const record = await CertificateData.findOneAndUpdate(
      { dctNumber: payload.dctNumber },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: "Certificate data successfully save ho gaya",
      data: record,
    });
  } catch (error) {
    console.error("createCertificateData error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

