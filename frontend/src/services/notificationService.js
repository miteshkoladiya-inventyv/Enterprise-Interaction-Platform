import axios from "axios";
import { BACKEND_URL } from "../config";

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

/**
 * Notification API Service
 * Handles all notification-related API calls
 */
export const notificationService = {
  /**
   * Get paginated notifications
   * GET /api/notifications
   */
  getNotifications: async (token, { limit = 20, offset = 0, unreadOnly = false } = {}) => {
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/notifications`,
        {
          params: { limit, offset, unreadOnly },
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Get notifications error:", error.message);
      throw error;
    }
  },

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  getUnreadCount: async (token) => {
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/notifications/unread-count`,
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Get unread count error:", error.message);
      throw error;
    }
  },

  /**
   * Mark single notification as read
   * PUT /api/notifications/:notificationId/read
   */
  markAsRead: async (token, notificationId) => {
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/notifications/${notificationId}/read`,
        {},
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Mark as read error:", error.message);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  markAllAsRead: async (token) => {
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/notifications/read-all`,
        {},
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Mark all as read error:", error.message);
      throw error;
    }
  },

  /**
   * Delete a notification
   * DELETE /api/notifications/:notificationId
   */
  deleteNotification: async (token, notificationId) => {
    try {
      const { data } = await axios.delete(
        `${BACKEND_URL}/notifications/${notificationId}`,
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Delete notification error:", error.message);
      throw error;
    }
  },

  /**
   * Get user notification preferences
   * GET /api/notifications/preferences
   */
  getPreferences: async (token) => {
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/notifications/preferences`,
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Get preferences error:", error.message);
      throw error;
    }
  },

  /**
   * Update user notification preferences
   * PUT /api/notifications/preferences
   */
  updatePreferences: async (token, preferences) => {
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/notifications/preferences`,
        preferences,
        {
          headers: getAuthHeaders(token),
        }
      );
      return data;
    } catch (error) {
      console.error("[NOTIFICATION_SERVICE] Update preferences error:", error.message);
      throw error;
    }
  },
};

export default notificationService;
