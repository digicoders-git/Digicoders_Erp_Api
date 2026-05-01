import express from 'express';
import upload from '../middleware/upload.js';
import auth from '../middleware/auth.js';
import {
  getCoursesByTechnology,
  createCourse,
  updateCourse,
  deleteCourse,
  getVideosByCourse,
  uploadVideo,
  updateVideo,
  deleteVideo
} from '../controllers/lmsController.js';

const router = express.Router();

// Course routes
router.get('/courses', getCoursesByTechnology);
router.post('/courses', auth, upload.any(), createCourse);
router.put('/courses/:id', auth, upload.any(), updateCourse);
router.delete('/courses/:id', auth, deleteCourse);

// Video routes
router.get('/courses/:courseId/videos', getVideosByCourse);
router.post('/videos', auth, upload.any(), uploadVideo);
router.put('/videos/:id', auth, upload.any(), updateVideo);
router.delete('/videos/:id', auth, deleteVideo);

export default router;