import express from "express";

import { verifyToken } from "../middlewares/auth.middleware.js";
import { chatSummary } from "../controllers/ai/ai.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/chatsummary/:channel_id" , chatSummary)
export default router;
