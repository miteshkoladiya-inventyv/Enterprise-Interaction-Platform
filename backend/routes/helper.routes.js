import express from "express";
import { isHR, verifyToken } from "../middlewares/auth.middleware.js";

import { getTeamLead } from "../controllers/helper/getTeamLead.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create employee (Admin or HR only)
router.get("/getTeamLead", isHR, getTeamLead);

export default router;
