import express from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware.js";
import {
  getOverviewStats,
  getMessageActivity,
  getMeetingStats,
  getDepartmentStats,
  getBirthdays,
  getOnLeaveToday,
  getNewJoiners,
  getUpcomingHolidays,
  getLeaveDistribution,
} from "../controllers/analytics/analytics.controller.js";

const router = express.Router();

// All analytics routes require authentication + analytics:view permission
router.use(verifyToken, requirePermission("analytics:view"));

router.get("/overview", getOverviewStats);
router.get("/messages", getMessageActivity);
router.get("/meetings", getMeetingStats);
router.get("/departments", getDepartmentStats);
router.get("/birthdays", getBirthdays);
router.get("/on-leave-today", getOnLeaveToday);
router.get("/new-joiners", getNewJoiners);
router.get("/upcoming-holidays", getUpcomingHolidays);
router.get("/leave-distribution", getLeaveDistribution);

export default router;
