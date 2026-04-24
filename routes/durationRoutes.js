import express from "express";
import {
  getAllDurations,
  createDuration,
  updateDuration,
  deleteDuration,
} from "../controllers/durationController.js";

const router = express.Router();

// Routes with query parameter support for frontend
router.route("/")
  .get(getAllDurations) // GET /api/duration?action=get
  .post(createDuration); // POST /api/duration?action=add

router.route("/:id")
  .put(updateDuration) // PUT /api/duration/:id?action=update
  .delete(deleteDuration); // DELETE /api/duration/:id?action=delete

export default router;