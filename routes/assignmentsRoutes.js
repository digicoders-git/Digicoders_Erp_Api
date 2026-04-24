import express from 'express';
import {
  getAllAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  removeFileFromAssignment,studentGetAllAssignments,submitAssignment,gradeAssignment
} from '../controllers/assignmentController.js';
import { auth } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes are protected
router.use(auth);

// Get all assignments
router.get('/', getAllAssignments);

router.get('/student', studentGetAllAssignments);

router.post('/submit', upload.single('submittedFile'), submitAssignment);

// Get assignment by ID
router.get('/:id', getAssignmentById);

// Create new assignment (Admin/Instructor only)
router.post('/create',upload.array('assignmentFiles', 5),createAssignment);

// Update assignment (Admin/Instructor only)
router.put(
  '/:id',
//   authorize('admin', 'instructor'),
  upload.array('assignmentFiles', 5),
  updateAssignment
);

// Delete assignment (Admin/Instructor only)
router.delete(
  '/:id',
//   authorize('admin', 'instructor'),
  deleteAssignment
);

// Remove file from assignment (Admin/Instructor only)
router.delete(
  '/:assignmentId/files/:fileIndex',
//   authorize('admin', 'instructor'),
  removeFileFromAssignment
);

// Grade assignment
router.post('/:id/grade', gradeAssignment);

export default router;