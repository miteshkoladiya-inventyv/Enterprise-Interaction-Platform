import { useEffect, useCallback, useRef } from "react";
import { useAuthContext } from "../context/AuthContextProvider";
import { useNotificationContext } from "../context/NotificationContextProvider";
import { useTabVisibility } from "../hooks/useTabVisibility";
import { routeNotification } from "../utils/notificationRouter.jsx";
import { toast } from "sonner";

/**
 * NotificationListener Component
 *
 * This is an invisible component that:
 * - Listens to Socket.io notification events
 * - Listens to tab visibility changes
 * - Routes notifications to toast or Service Worker
 * - Handles Service Worker notification actions
 * - Keeps notification state in sync
 *
 * Place this component near the root of your app (in App.jsx)
 */
export const NotificationListener = () => {
  const { socket, user } = useAuthContext();
  const { addNotification, sharedWorkerPort } = useNotificationContext();
  const { isTabActive } = useTabVisibility();

  // Use refs to store current socket and user so event listeners can access them
  const socketRef = useRef(socket);
  const userRef = useRef(user);

  // Update refs when socket or user changes
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Handle incoming notification from Socket.io
   */
  const handleNewNotification = useCallback(
    async (data) => {
      console.log("[NOTIFICATION_LISTENER] New notification received:", data);

      if (!user || !addNotification) return;

      // Build notification object if needed
      let notification = data.notification || data;

      // Ensure notification has required fields
      if (!notification._id) {
        notification._id = data.id || `notif_${Date.now()}`;
      }

      if (!notification.user_id) {
        notification.user_id = user._id || user.id;
      }

      // Ensure sender_name is set (fallback to senderName from Socket event or title)
      if (!notification.sender_name && data.senderName) {
        notification.sender_name = data.senderName;
      }
      if (!notification.sender_name && notification.title) {
        // Extract sender name from title like "New message from John Doe"
        const match = notification.title.match(/from (.+)$/);
        if (match) {
          notification.sender_name = match[1];
        }
      }

      // Route to appropriate display method
      try {
        const route = await routeNotification(notification, isTabActive, {
          onClickAction: handleNotificationClick,
        });

        console.log(
          `[NOTIFICATION_LISTENER] Routed to: ${route} for notification ${notification._id}`
        );

        // Add to local state
        addNotification(notification);

        // Notify SharedWorker
        if (sharedWorkerPort) {
          sharedWorkerPort.postMessage({
            type: "NEW_NOTIFICATION",
            payload: notification,
          });
        }
      } catch (error) {
        console.error(
          "[NOTIFICATION_LISTENER] Error routing notification:",
          error.message
        );
      }
    },
    [user, addNotification, isTabActive, sharedWorkerPort]
  );

  /**
   * Handle notification click (navigate to source)
   */
  const handleNotificationClick = useCallback((notification) => {
    console.log(
      "[NOTIFICATION_LISTENER] Notification clicked:",
      notification._id
    );

    const { action_url } = notification;
    if (action_url) {
      window.location.href = action_url;
    }
  }, []);

  /**
   * Listen to Socket.io events
   */
  useEffect(() => {
    if (!socket) return;

    console.log("[NOTIFICATION_LISTENER] Setting up Socket.io listeners");

    // Listen for new notifications
    socket.on("notification:new", handleNewNotification);

    // Listen for mention notifications
    socket.on("message:mentioned", (data) => {
      console.log("[NOTIFICATION_LISTENER] @Mention received:", data);
      handleNewNotification({
        type: "mention",
        ...data,
      });
    });

    // Listen for unread count updates
    socket.on("notification:unread-count-updated", (data) => {
      console.log(
        "[NOTIFICATION_LISTENER] Unread count updated:",
        data.unreadCount
      );

      // Update SharedWorker
      if (sharedWorkerPort) {
        sharedWorkerPort.postMessage({
          type: "UPDATE_UNREAD_COUNT",
          payload: data.unreadCount,
        });
      }
    });

    // Listen for chat reply success
    socket.on("chat:reply-sent", (data) => {
      console.log("[NOTIFICATION_LISTENER] ✅ Chat reply sent successfully:", data);
    });

    // Listen for chat reply errors
    socket.on("chat:reply-error", (data) => {
      console.error("[NOTIFICATION_LISTENER] ❌ Chat reply error:", data);
      alert("Failed to send reply: " + data.error);
    });

    // Listen for call accepted
    socket.on("call:accepted", (data) => {
      console.log("[NOTIFICATION_LISTENER] ✅ Call accepted by receiver:", data);
      console.log("[NOTIFICATION_LISTENER] Details:", {
        acceptedBy: data.acceptedBy,
        callType: data.callType,
      });
      // The UI should now show the call is accepted and can proceed with video/audio
      // This is handled by the call UI component
      toast.info(`Your ${data.callType} call was accepted!`);
    });

    // Listen for call rejected
    socket.on("call:rejected", (data) => {
      console.log("[NOTIFICATION_LISTENER] ❌ Call rejected by receiver:", data);
      console.log("[NOTIFICATION_LISTENER] Details:", {
        rejectedBy: data.rejectedBy,
        callType: data.callType,
      });
      // The call was rejected, clear the call UI
      toast.error(`Your ${data.callType} call was rejected`);
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("message:mentioned");
      socket.off("notification:unread-count-updated");
      socket.off("chat:reply-sent");
      socket.off("chat:reply-error");
      socket.off("call:accepted");
      socket.off("call:rejected");
    };
  }, [socket, handleNewNotification, sharedWorkerPort]);

  /**
   * Listen to SharedWorker messages for cross-tab notification dismissal
   */
  useEffect(() => {
    if (!sharedWorkerPort) return;

    const handleSharedWorkerMessage = (event) => {
      const { type, notificationId } = event.data;

      console.log("[NOTIFICATION_LISTENER] SharedWorker message:", type);

      // Handle notification dismissed from all tabs (e.g., call rejected)
      if (type === "NOTIFICATION_DISMISSED_ALL_TABS") {
        console.log(`[NOTIFICATION_LISTENER] Notification dismissed from all tabs: ${notificationId}`);
        // Could add logic here to remove notification from UI if displayed
        // For now, Service Worker has already closed the system notification
      }
    };

    sharedWorkerPort.addEventListener("message", handleSharedWorkerMessage);
    return () => {
      sharedWorkerPort.removeEventListener("message", handleSharedWorkerMessage);
    };
  }, [sharedWorkerPort]);

  /**
   * Listen for tab focus/blur changes
   * Notify SharedWorker of tab state
   */
  useEffect(() => {
    if (!sharedWorkerPort) return;

    if (isTabActive) {
      console.log("[NOTIFICATION_LISTENER] Tab gained focus");
      sharedWorkerPort.postMessage({
        type: "TAB_FOCUS",
      });
    } else {
      console.log("[NOTIFICATION_LISTENER] Tab lost focus");
      sharedWorkerPort.postMessage({
        type: "TAB_BLUR",
      });
    }
  }, [isTabActive, sharedWorkerPort]);

  /**
   * Listen for Service Worker notification actions
   */
  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      const { type, action, notificationId, sourceId, callType, reply, metadata } = event.data;

      console.log("[NOTIFICATION_LISTENER] 📨 Message from Service Worker:", {
        type,
        action,
        notificationId,
        sourceId,
        callType,
        hasReply: !!reply,
      });

      // Handle call notification actions (ACCEPT or REJECT)
      if (type === "CALL_ACTION_FROM_NOTIFICATION") {
        console.log(
          `[NOTIFICATION_LISTENER] ☎️ Call ${action === "accept" ? "✅ ACCEPTED" : "❌ REJECTED"} from notification`
        );

        if (action === "accept") {
          console.log(`[NOTIFICATION_LISTENER] 📤 Emitting call:accept with sourceId: ${sourceId}`);

          const currentSocket = socketRef.current;

          if (currentSocket && currentSocket.connected) {
            try {
              // Emit socket event to backend to notify caller
              currentSocket.emit("call:accept", {
                callId: sourceId, // sourceId is the caller's user ID
                callType: callType || "audio",
              });
              console.log("[NOTIFICATION_LISTENER] ✅ call:accept emitted with callId:", sourceId);

              // Also dispatch custom event for the UI to handle
              window.dispatchEvent(new CustomEvent('notification:call-accepted', {
                detail: {
                  callType: callType || "audio",
                  sourceId,
                  notificationId,
                }
              }));
              console.log("[NOTIFICATION_LISTENER] ✅ Custom event dispatched for UI");
            } catch (error) {
              console.error("[NOTIFICATION_LISTENER] ❌ Error in accept flow:", error.message);
            }
          } else {
            console.error("[NOTIFICATION_LISTENER] ❌ Socket not connected!");
          }
        } else if (action === "reject") {
          console.log("[NOTIFICATION_LISTENER] 📤 Rejecting call from notification");

          const currentSocket = socketRef.current;

          if (currentSocket && currentSocket.connected) {
            try {
              currentSocket.emit("call:reject-and-dismiss", {
                callId: sourceId,
                callType: callType || "audio",
                notificationId,
              });
              console.log("[NOTIFICATION_LISTENER] ✅ call:reject-and-dismiss emitted successfully");
            } catch (error) {
              console.error("[NOTIFICATION_LISTENER] ❌ Error emitting call:reject-and-dismiss:", error.message);
            }
          }
        }
      }

      // Handle chat replies from notification
      if (type === "CHAT_REPLY_FROM_NOTIFICATION") {
        console.log("[NOTIFICATION_LISTENER] 💬 Chat reply from notification:", reply.substring(0, 50));

        const currentSocket = socketRef.current;
        const currentUser = userRef.current;

        if (currentSocket && currentUser) {
          currentSocket.emit("chat:send-reply-from-notification", {
            replyText: reply,
            senderUserId: currentUser._id || currentUser.id,
            notificationId,
            metadata,
            timestamp: new Date(),
          });
          console.log("[NOTIFICATION_LISTENER] ✅ Sent reply via socket");
        }
      }
    };

    // Set up listener if Service Worker is active
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      console.log("[NOTIFICATION_LISTENER] ✅ Setting up Service Worker message listener");
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    } else {
      console.warn("[NOTIFICATION_LISTENER] ⚠️ Service Worker not active");
    }

    // Cleanup function at top level of useEffect
    return () => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default NotificationListener;
