import express from 'express';
import { trainingController } from '../controllers/TranningController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected with auth middleware
// Switch case based routes
router.get('/:action', trainingController);       // Public: For getAll
router.get('/:action/:id', trainingController);   // Public: For getById

router.use(auth);

router.post('/:action', trainingController);      // For create
router.patch('/:action/:id', trainingController);   // For update
router.delete('/:action/:id', trainingController); // For delete

export default router;