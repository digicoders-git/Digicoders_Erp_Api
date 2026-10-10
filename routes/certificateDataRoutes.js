import express from "express";
import {
  searchCertificateData,
  getCertificateDataById,
  getAllCertificateData,
  createCertificateData,
} from "../controllers/certificateDataController.js";

const router = express.Router();

// GET /api/certificate-data/search?mobile=9876543210
// GET /api/certificate-data/search?dctNumber=DCT/2026/2877
// GET /api/certificate-data/search?mobile=9876543210&dctNumber=DCT/2026/2877
router.get("/search", searchCertificateData);

// GET /api/certificate-data/          → sare records (paginated)
router.get("/", getAllCertificateData);

// POST /api/certificate-data/         → insert / upsert certificate record
router.post("/", createCertificateData);

// GET /api/certificate-data/:id       → single record by MongoDB _id
router.get("/:id", getCertificateDataById);

export default router;

