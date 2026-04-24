import express from "express";
import {
  addBranch,
  getBranch,
  getAllBranches,
  updateBranch,
  deleteBranch
} from "../controllers/branchController.js"; // apne file ka actual naam yaha lagana
import { auth } from "../middleware/auth.js";
const router = express.Router();
// Get all branches with pagination & search
router.get("/", getAllBranches);

// Get single branch by ID
router.get("/:id", getBranch);

router.use(auth);

// Create new branch
router.post("/",addBranch);

// Update branch by ID
router.put("/:id",updateBranch);

// Delete branch by ID
router.delete("/:id", deleteBranch);

export default router;
