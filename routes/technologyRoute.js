import express from "express";
import { technologyController } from "../controllers/technologyControllers.js";
import { auth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected with auth middleware
// Basic CRUD operations
router.get('/:action', technologyController);       // Public: getAll
router.get('/:action/:id', technologyController);   // Public: getById ,getByTrainingDuration

router.use(auth);

router.post('/:action', technologyController);      // create
router.patch('/:action/:id', technologyController);   // update
router.delete('/:action/:id', technologyController); // delete


export default router;
