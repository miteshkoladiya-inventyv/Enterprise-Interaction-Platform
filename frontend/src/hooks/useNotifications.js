import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "../context/AuthContextProvider";
import notificationService from "../services/notificationService";

/**
 * useNotifications Hook
 * Manages notification state and operations
 * Integrates with SharedWorker and backend API
 */
export const useNotifications = () => {
  const { user } = useAuthContext();
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sharedWorkerPort, setSharedWorkerPort] = useState(null);

  // Initialize SharedWorker connection
  useEffect(() => {
    if (!user || !token) return;

    try {
      const worker = new SharedWorker("/shared-worker.js");
      setSharedWorkerPort(worker.port);

      // Start listening to messages
      worker.port.start();

      // Send init message to SharedWorker
      worker.port.postMessage({
        type: "INIT",
        userId: user._id,
      });

      console.log("[NOTIFICATIONS] SharedWorker connected");

      // Listen for messages from SharedWorker
      const handleWorkerMessage = (event) => {
        const { type, payload } = event.data;

        if (type === "UNREAD_COUNT_SYNC") {
          console.log(`[NOTIFICATIONS] Unread count synced: ${payload}`);
          setUnreadCount(payload);
        }

        if (type === "NOTIFICATION_RECEIVED") {
          console.log("[NOTIFICATIONS] Notification received from SharedWorker");
          // This will be handled by NotificationListener component
        }

        if (type === "ACTIVE_TAB_CHANGED") {
          console.log(
            `[NOTIFICATIONS] Active tab changed to: ${event.data.activeTabId}`
          );
        }

        if (type === "CURRENT_STATE") {
          console.log("[NOTIFICATIONS] Received current state from SharedWorker");
          if (event.data.unreadCount !== undefined) {
            setUnreadCount(event.data.unreadCount);
          }
        }

        if (type === "NO_ACTIVE_TAB") {
          console.log("[NOTIFICATIONS] No active tab");
        }
      };

      worker.port.addEventListener("message", handleWorkerMessage);

      return () => {
        worker.port.removeEventListener("message", handleWorkerMessage);
      };
    } catch (error) {
      console.error("[NOTIFICATIONS] SharedWorker init error:", error.message);
      // SharedWorker may not be supported in all browsers
    }
  }, [user, token]);

  // Fetch initial notifications on mount
  useEffect(() => {
    if (!user || !token) return;

    fetchNotifications();
  }, [user, token]);

  /**
   * Fetch notifications from backend
   */
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const result = await notificationService.getNotifications(token, {
        limit: 50,
        offset: 0,
        unreadOnly: false,
      });

      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
      setError(null);

      console.log(
        `[NOTIFICATIONS] Fetched ${result.notifications?.length || 0} notifications`
      );
    } catch (err) {
      console.error("[NOTIFICATIONS] Fetch error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(
    async (notificationId) => {
      if (!token) return;

      try {
        await notificationService.markAsRead(token, notificationId);

        // Update local state optimistically
        setNotifications((prev) =>
          prev.map((notif) =>
            notif._id === notificationId ? { ...notif, is_read: true } : notif
          )
        );

        // Decrement unread count
        setUnreadCount((prev) => Math.max(prev - 1, 0));

        // Notify SharedWorker
        if (sharedWorkerPort) {
          sharedWorkerPort.postMessage({
            type: "UPDATE_UNREAD_COUNT",
            payload: unreadCount - 1,
          });
        }

        console.log(`[NOTIFICATIONS] Marked notification ${notificationId} as read`);
      } catch (err) {
        console.error("[NOTIFICATIONS] Mark as read error:", err.message);
        // Re-fetch on error
        fetchNotifications();
      }
    },
    [token, sharedWorkerPort, unreadCount]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      await notificationService.markAllAsRead(token);

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);

      // Notify SharedWorker
      if (sharedWorkerPort) {
        sharedWorkerPort.postMessage({
          type: "UPDATE_UNREAD_COUNT",
          payload: 0,
        });
      }

      console.log("[NOTIFICATIONS] All notifications marked as read");
    } catch (err) {
      console.error("[NOTIFICATIONS] Mark all as read error:", err.message);
      fetchNotifications();
    }
  }, [token, sharedWorkerPort]);

  /**
   * Delete a notification
   */
  const deleteNotification = useCallback(
    async (notificationId) => {
      if (!token) return;

      try {
        await notificationService.deleteNotification(token, notificationId);

        // Update local state
        setNotifications((prev) =>
          prev.filter((notif) => notif._id !== notificationId)
        );

        console.log(`[NOTIFICATIONS] Deleted notification ${notificationId}`);
      } catch (err) {
        console.error("[NOTIFICATIONS] Delete error:", err.message);
      }
    },
    [token]
  );

  /**
   * Notify SharedWorker of new notification
   * (called from NotificationListener)
   */
  const addNotification = useCallback(
    (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Notify SharedWorker
      if (sharedWorkerPort) {
        sharedWorkerPort.postMessage({
          type: "NEW_NOTIFICATION",
          payload: notification,
        });
      }
    },
    [sharedWorkerPort]
  );

  /**
   * Update tab focus status in SharedWorker
   */
  useEffect(() => {
    const handleFocus = () => {
      if (sharedWorkerPort) {
        sharedWorkerPort.postMessage({
          type: "TAB_FOCUS",
        });
      }
    };

    const handleBlur = () => {
      if (sharedWorkerPort) {
        sharedWorkerPort.postMessage({
          type: "TAB_BLUR",
        });
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sharedWorkerPort]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    sharedWorkerPort,
  };
};

export default useNotifications;
