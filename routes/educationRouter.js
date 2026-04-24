import express from 'express';
import {
  addEducation,
  getEducation,
  getAllEducations,
  updateEducation,
  deleteEducation
} from '../controllers/education.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected with auth middleware
// Define routes directly with their handlers
router.get('/', getAllEducations);
router.get('/:id', getEducation);

router.use(auth);

router.post('/',addEducation);
router.put('/:id',updateEducation);
router.delete('/:id',deleteEducation);

export default router;