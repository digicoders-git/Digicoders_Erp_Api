

// export default router;
import express from 'express';
import rateLimit from 'express-rate-limit';
import { auth, authorize } from '../middleware/auth.js';
import {
  register,
  login,
  logout,
  getAll,
  updateUser,
  getMe,
  deleteUser,
  verifyToken, verifyOtp
} from '../controllers/authControllers.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later'
  }
});

// Public routes
router.post('/login', authLimiter, login);
router.get('/verify-token', auth, verifyToken);
router.post('/verify-otp', verifyOtp);

// Protected routes - require authentication
router.post('/register', auth, upload.single("image"), register);
router.get('/getall', auth, getAll);
router.get('/getme', auth, getMe);
router.put('/update/:id', auth, upload.single("image"), updateUser);
router.post('/logout', auth, logout);
router.delete('/delete/:id', auth, deleteUser);

export default router;