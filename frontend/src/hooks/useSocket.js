// hooks/useSocket.js
import { io } from "socket.io-client";
// import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";

export const createSocketConnection = (userId, onNotificationReceived) => {
  if (!userId) return null;

  const backendBase = BACKEND_URL.replace("/api", "");

  const socket = io(backendBase, {
    withCredentials: true,
    auth: {
      userId: userId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts:`, socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Disconnected:", reason);
  });

  // ============================================================
  // NOTIFICATION LISTENERS
  // ============================================================

  /**
   * New notification arrived in real-time
   */
  socket.on("notification:new", (data) => {
    console.log("[SOCKET] New notification received:", data);

    if (onNotificationReceived) {
      onNotificationReceived(data);
    }
  });

  /**
   * Notification was marked as read
   */
  socket.on("notification:read-confirm", (data) => {
    const { notification_id } = data;
    console.log("[SOCKET] Notification marked as read:", notification_id);
  });

  /**
   * Unread count updated
   */
  socket.on("notification:unread-count-updated", (data) => {
    const { unreadCount } = data;
    console.log("[SOCKET] Unread count updated:", unreadCount);

    // Emit custom event for components to listen to
    window.dispatchEvent(
      new CustomEvent("notificationCountUpdated", {
        detail: { unreadCount },
      })
    );
  });

  /**
   * User preferences were updated
   */
  socket.on("notification-preferences:update-confirmed", (data) => {
    const { preferences } = data;
    console.log("[SOCKET] Notification preferences updated:", preferences);
  });

  /**
   * @Mention notification
   */
  socket.on("message:mentioned", (data) => {
    console.log("[SOCKET] User was mentioned:", data);

    if (onNotificationReceived) {
      // Format mention as notification
      onNotificationReceived({
        type: "mention",
        ...data,
      });
    }
  });

  return socket;
};
