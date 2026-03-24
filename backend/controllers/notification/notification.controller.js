import { Notification } from "../../models/Notification.js";
import { NotificationPreference } from "../../models/NotificationPreference.js";
import User from "../../models/User.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import {
  sendSuccess,
  sendError,
  sendCreated,
  sendForbidden,
  sendBadRequest,
  sendServerError,
} from "../../utils/responseFormatter.js";
import { io } from "../../socket/socketServer.js";

// ============================================================
// NOTIFICATION CRUD
// ============================================================

/**
 * Get unread notifications for current user (paginated)
 * GET /api/notifications?limit=20&offset=0
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    const query = { user_id: userId };
    if (unreadOnly === "true") {
      query.is_read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ created_at: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });

    return sendSuccess(
      res,
      {
        notifications,
        total,
        unreadCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
      "Notifications fetched successfully"
    );
  } catch (error) {
    console.error("[NOTIFICATION] Get notifications error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Get unread count for current user
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const unreadCount = await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });

    return sendSuccess(
      res,
      { unreadCount },
      "Unread count fetched successfully"
    );
  } catch (error) {
    console.error("[NOTIFICATION] Get unread count error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Mark single notification as read
 * PUT /api/notifications/:notificationId/read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return sendBadRequest(res, "Notification not found");
    }

    if (notification.user_id.toString() !== userId) {
      return sendForbidden(res, "You can only read your own notifications");
    }

    notification.is_read = true;
    notification.read_at = new Date();
    await notification.save();

    // Emit socket event to update badge count in real-time
    const unreadCount = await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });

    io.to(`user:${userId}`).emit("notification:unread-count-updated", {
      unreadCount,
    });

    return sendSuccess(
      res,
      notification,
      "Notification marked as read"
    );
  } catch (error) {
    console.error("[NOTIFICATION] Mark as read error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.updateMany(
      { user_id: userId, is_read: false },
      { is_read: true, read_at: new Date() }
    );

    // Emit socket event
    io.to(`user:${userId}`).emit("notification:unread-count-updated", {
      unreadCount: 0,
    });

    return sendSuccess(res, {}, "All notifications marked as read");
  } catch (error) {
    console.error("[NOTIFICATION] Mark all as read error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return sendBadRequest(res, "Notification not found");
    }

    if (notification.user_id.toString() !== userId) {
      return sendForbidden(res, "You can only delete your own notifications");
    }

    await Notification.findByIdAndDelete(notificationId);

    return sendSuccess(res, {}, "Notification deleted successfully");
  } catch (error) {
    console.error("[NOTIFICATION] Delete notification error:", error.message);
    return sendServerError(res, error);
  }
};

// ============================================================
// NOTIFICATION PREFERENCES
// ============================================================

/**
 * Get user notification preferences
 * GET /api/notifications/preferences
 */
export const getPreferences = async (req, res) => {
  try {
    const userId = req.userId;

    let preferences = await NotificationPreference.findOne({ user_id: userId });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = new NotificationPreference({
        user_id: userId,
      });
      await preferences.save();
    }

    return sendSuccess(
      res,
      preferences,
      "Preferences fetched successfully"
    );
  } catch (error) {
    console.error("[NOTIFICATION] Get preferences error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Update user notification preferences
 * PUT /api/notifications/preferences
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      notifications_enabled,
      desktop_notifications_enabled,
      mention_only,
      do_not_disturb_enabled,
      do_not_disturb_start,
      do_not_disturb_end,
      muted_channels,
      muted_users,
    } = req.body;

    let preferences = await NotificationPreference.findOne({ user_id: userId });

    if (!preferences) {
      preferences = new NotificationPreference({ user_id: userId });
    }

    // Update fields if provided
    if (notifications_enabled !== undefined)
      preferences.notifications_enabled = notifications_enabled;
    if (desktop_notifications_enabled !== undefined)
      preferences.desktop_notifications_enabled = desktop_notifications_enabled;
    if (mention_only !== undefined) preferences.mention_only = mention_only;
    if (do_not_disturb_enabled !== undefined)
      preferences.do_not_disturb_enabled = do_not_disturb_enabled;
    if (do_not_disturb_start) preferences.do_not_disturb_start = do_not_disturb_start;
    if (do_not_disturb_end) preferences.do_not_disturb_end = do_not_disturb_end;
    if (muted_channels)
      preferences.muted_channels = muted_channels;
    if (muted_users) preferences.muted_users = muted_users;

    await preferences.save();

    // Emit socket event to confirm update
    io.to(`user:${userId}`).emit("notification-preferences:update-confirmed", {
      preferences,
    });

    return sendSuccess(res, preferences, "Preferences updated successfully");
  } catch (error) {
    console.error("[NOTIFICATION] Update preferences error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Check if notification should be delivered to user
 * Based on user preferences (DND, muted channels, etc.)
 */
export const shouldDeliverNotification = async (
  userId,
  senderUserId,
  channelId,
  notificationType
) => {
  try {
    const preferences = await NotificationPreference.findOne({
      user_id: userId,
    });

    // If notifications disabled globally
    if (preferences && !preferences.notifications_enabled) {
      return false;
    }

    // If only mention notifications
    if (
      preferences &&
      preferences.mention_only &&
      notificationType !== "mention"
    ) {
      return false;
    }

    // Check if DND is active (current time within DND window)
    if (preferences && preferences.do_not_disturb_enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const dndStart = preferences.do_not_disturb_start; // e.g., "22:00"
      const dndEnd = preferences.do_not_disturb_end; // e.g., "08:00"

      // Handle case where DND spans midnight
      if (dndStart <= dndEnd) {
        // DND within same day, e.g., 14:00 - 18:00
        if (currentTime >= dndStart && currentTime <= dndEnd) {
          return false;
        }
      } else {
        // DND spans midnight, e.g., 22:00 - 08:00
        if (currentTime >= dndStart || currentTime <= dndEnd) {
          return false;
        }
      }
    }

    // Check if channel is muted
    if (preferences && preferences.muted_channels.length > 0) {
      const isMuted = preferences.muted_channels.some(
        (id) => id.toString() === channelId.toString()
      );
      if (isMuted) {
        return false;
      }
    }

    // Check if sender is muted
    if (preferences && preferences.muted_users.length > 0) {
      const isMuted = preferences.muted_users.some(
        (id) => id.toString() === senderUserId.toString()
      );
      if (isMuted) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[NOTIFICATION] shouldDeliverNotification error:", error);
    return true; // Default to deliver if error
  }
};

/**
 * Create notification for a user
 */
export const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error("[NOTIFICATION] createNotification error:", error.message);
    throw error;
  }
};
