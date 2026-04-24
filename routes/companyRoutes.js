import express from 'express';
import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus,
  getCompanyStats
} from '../controllers/companyController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(auth);

router.route('/').get(getCompanies).post(createCompany);

router.route('/stats/overview').get(getCompanyStats);

router.route('/:id').get(getCompany).put(updateCompany).delete(deleteCompany);

router.route('/:id/status').patch(toggleCompanyStatus);
router.patch('/:id', toggleCompanyStatus); // For PATCH /api/companies/:id
export default router;