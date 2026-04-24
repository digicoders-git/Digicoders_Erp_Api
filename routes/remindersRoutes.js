import express from 'express';
import { auth } from '../middleware/auth.js';
import { pendingFees, pendingRegistrationFee, sendEmails, pendingFeesEmail } from '../controllers/sendEmailReminders.js';

const router = express.Router();

// All routes are protected with auth middleware
router.use(auth);

// Switch case based routes
router.post('/send', sendEmails);
router.get('/pending/registrationfee/:studentId', pendingRegistrationFee);
router.get('/pending/fees/:studentId', pendingFees);
router.get('/pending/fees/email/:studentId', pendingFeesEmail);

export default router;