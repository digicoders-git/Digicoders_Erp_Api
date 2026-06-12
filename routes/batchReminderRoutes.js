import express from 'express';
import {
  createBatchReminder,
  sendBatchReminderNow,
  getBatchReminders,
  deleteBatchReminder,
  triggerReminderManually,
  getBatchStudentsForReminder,
  uploadReminderSound
} from '../controllers/batchReminderController.js';
import { auth, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Create batch reminder (scheduled)
router.post('/', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'manage_batch'),
  createBatchReminder
);

// Send batch reminder immediately
router.post('/send-now', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'manage_batch'),
  sendBatchReminderNow
);

// Manually trigger scheduled reminder
router.post('/trigger/:id', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'manage_batch'),
  triggerReminderManually
);

// Get all batch reminders
router.get('/', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'view_batch'),
  getBatchReminders
);

// Get batch students for reminder preview
router.get('/batch/:batchId/students', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'view_batch'),
  getBatchStudentsForReminder
);

// Upload custom sound for reminders
router.post('/upload-sound', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'manage_batch'),
  upload.single('sound'),
  uploadReminderSound
);

// Cancel/Delete batch reminder
router.delete('/:id', 
  auth, 
  authorize(['Admin', 'Super Admin', 'Employee'], 'manage_batch'),
  deleteBatchReminder
);

export default router;