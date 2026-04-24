import express from "express";
import {
    addIndustry,
    getIndustry,
    getAllIndustries,
    updateIndustry,
    deleteIndustry
} from "../controllers/industryController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();
router.use(auth);

// Create new industry
router.post("/", addIndustry);

// Get all industries with pagination & search
router.get("/", getAllIndustries);

// Get single industry by ID
router.get("/:id", getIndustry);

// Update industry by ID
router.put("/:id", updateIndustry);

// Delete industry by ID
router.delete("/:id", deleteIndustry);

export default router;
