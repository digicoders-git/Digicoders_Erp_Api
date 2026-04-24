// routes/permissionRoutes.js
import express from 'express';
import { 
  getAllPermissions, 
  getEmployeePermissions, 
  assignPermissions,
  // createDefaultPermissions 
} from '../controllers/permissionController.js';
import { auth, authorize } from '../middleware/auth.js';

const router = express.Router();

// Only Super Admin can create default permissions
// router.post('/create-default', auth, authorize(['Super Admin']), createDefaultPermissions);

// Admin and Super Admin can access these routes
router.get('/all', auth, authorize(['Super Admin', 'Admin']), getAllPermissions);
router.get('/employee/:employeeId', auth, authorize(['Super Admin', 'Admin']), getEmployeePermissions);
router.post('/assign', auth, authorize(['Super Admin', 'Admin']), assignPermissions);

export default router;
