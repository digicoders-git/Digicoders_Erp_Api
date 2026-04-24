import express from "express";
import {
    addTag,
    getTag,
    getAllTags,
    updateTag,
    deleteTag
} from "../controllers/tagController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();
router.use(auth);

// Create new tag
router.post("/", addTag);

// Get all tags with pagination & search
router.get("/", getAllTags);

// Get single tag by ID
router.get("/:id", getTag);

// Update tag by ID
router.put("/:id", updateTag);

// Delete tag by ID
router.delete("/:id", deleteTag);

export default router;
