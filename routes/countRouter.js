import express from "express";
import { getAll, getStudentCounts } from "../controllers/countContrallers.js";
import { auth } from '../middleware/auth.js';
const route = express.Router()
route.use(auth);

route.get('/', getAll)
route.get('/student', getStudentCounts)
export default route