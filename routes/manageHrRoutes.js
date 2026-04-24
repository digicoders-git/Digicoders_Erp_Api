import express from "express";
import { createHr, deletaHr, getAllHr, updataHr } from "../controllers/manageHrController.js";
import { auth } from "../middleware/auth.js";

const route=express.Router()
route.use(auth);

route.post('/',createHr)
route.get('/',getAllHr)
route.put('/:id',updataHr)
route.delete('/:id',deletaHr)

export default route