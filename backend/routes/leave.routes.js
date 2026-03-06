import express from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware.js";
import {
  getMyLeaveBalance,
  requestLeave,
  cancelLeave,
  getMyLeaveRequests,
  getAllLeaveRequests,
  updateLeaveStatus,
  getAllLeaveBalances,
  updateLeaveBalance,
} from "../controllers/leave/leave.controller.js";

const router = express.Router();

// ─── Employee routes ───
router.get("/balance", verifyToken, getMyLeaveBalance);
router.post("/request", verifyToken, requestLeave);
router.put("/cancel/:id", verifyToken, cancelLeave);
router.get("/my-requests", verifyToken, getMyLeaveRequests);

// ─── Admin/HR routes ───
router.get("/all-requests", verifyToken, requirePermission("leave:read_all"), getAllLeaveRequests);
router.put("/update-status/:id", verifyToken, requirePermission("leave:approve"), updateLeaveStatus);
router.get("/all-balances", verifyToken, requirePermission("leave:manage"), getAllLeaveBalances);
router.put("/update-balance", verifyToken, requirePermission("leave:manage"), updateLeaveBalance);

export default router;
