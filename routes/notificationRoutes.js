import express from 'express';
const router = express.Router();
import { auth } from '../middleware/auth.js';
import {
  saveFcmToken,
  deleteFcmToken,
  sendNotification,
  getNotificationStats,
  getNotificationHistory,
  deleteNotification
} from '../controllers/notificationController.js';

// FCM Token Management
router.post('/fcm/save-token', auth, saveFcmToken);
router.delete('/fcm/delete-token', auth, deleteFcmToken);

// Test endpoint for debugging
router.get('/test', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Notification routes working',
    user: {
      id: req.user?.id || req.user?._id,
      role: req.user?.role,
      email: req.user?.email
    },
    timestamp: new Date().toISOString()
  });
});

// Send Notifications (Super Admin only)
router.post('/send', auth, (req, res, next) => {
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
  }
  next();
}, sendNotification);

// Get Statistics (Super Admin only)
router.get('/stats', auth, (req, res, next) => {
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
  }
  next();
}, getNotificationStats);

// Get History (Super Admin only)
router.get('/history', auth, (req, res, next) => {
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
  }
  next();
}, getNotificationHistory);

// Delete Notification (Super Admin only)
router.delete('/:id', auth, (req, res, next) => {
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
  }
  next();
}, deleteNotification);

export default router;