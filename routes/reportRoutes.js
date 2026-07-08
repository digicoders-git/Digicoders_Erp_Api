import express from "express";
import { getReportData } from "../controllers/reportController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/data", auth, getReportData);

export default router;
