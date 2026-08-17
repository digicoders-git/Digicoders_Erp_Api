import express from "express";
import { createHr, deletaHr, getAllHr, updataHr, getHrPerformance, getHrRegistrationsSummary, getHrPublic } from "../controllers/manageHrController.js";
import { auth } from "../middleware/auth.js";

const route = express.Router();

// Public routes (validate email in controller)
route.get("/registrations-summary", getHrRegistrationsSummary);
route.post("/registrations-summary", getHrRegistrationsSummary);
route.get("/public/:id", getHrPublic);

route.use(auth);

route.post("/", createHr);
route.get("/", getAllHr);
route.get("/:id/performance", getHrPerformance);
route.put("/:id", updataHr);
route.delete("/:id", deletaHr);

export default route;