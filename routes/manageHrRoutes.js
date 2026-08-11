import express from "express";
import { createHr, deletaHr, getAllHr, updataHr, getHrPerformance, getHrRegistrationsSummary } from "../controllers/manageHrController.js";
import { auth } from "../middleware/auth.js";

const route = express.Router();

// Public routes (validate email in controller)
route.get("/registrations-summary", getHrRegistrationsSummary);
route.post("/registrations-summary", getHrRegistrationsSummary);

route.use(auth);

route.post("/", createHr);
route.get("/", getAllHr);
route.get("/:id/performance", getHrPerformance);
route.put("/:id", updataHr);
route.delete("/:id", deletaHr);

export default route;