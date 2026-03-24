import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
} from "../controllers/notification/notification.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============================================================
// Notification CRUD Endpoints
// ============================================================

/**
 * GET /api/notifications
 * Get paginated notifications for current user
 * Query params: limit, offset, unreadOnly
 */
router.get("/", getNotifications);

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get("/unread-count", getUnreadCount);

/**
 * PUT /api/notifications/:notificationId/read
 * Mark single notification as read
 */
router.put("/:notificationId/read", markAsRead);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put("/read-all", markAllAsRead);

/**
 * DELETE /api/notifications/:notificationId
 * Delete a notification
 */
router.delete("/:notificationId", deleteNotification);

// ============================================================
// Notification Preferences Endpoints
// ============================================================

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get("/preferences", getPreferences);

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put("/preferences", updatePreferences);

export default router;
