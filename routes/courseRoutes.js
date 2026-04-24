import express from "express";
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";

const router = express.Router();

router.route("/")
  .get(getAllCourses)
  .post(createCourse);

router.route("/:id")
  .get(getCourseById)
  .put(updateCourse)
  .delete(deleteCourse);

export default router;