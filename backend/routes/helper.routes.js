import express from "express";
import { isHR, verifyToken } from "../middlewares/auth.middleware.js";

import { getTeamLead } from "../controllers/helper/getTeamLead.controller.js";
import { searchUsers } from "../controllers/helper/searchUsers.controller.js";
import { getCollaborationOverview } from "../controllers/helper/collaboration.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create employee (Admin or HR only)
router.get("/getTeamLead", isHR, getTeamLead);

// Search users (anyone can search)
router.get("/search-users", searchUsers);

// Cross-country collaboration overview
router.get("/collaboration-overview", getCollaborationOverview);

export default router;
