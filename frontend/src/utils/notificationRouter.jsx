/**
 * Notification Router Utility
 * Determines whether to show a toast or let Service Worker handle it
 * based on tab visibility and user settings
 */

import { toast } from "sonner";

/**
 * Route notification to appropriate handler
 *
 * @param {Object} notification - The notification object
 * @param {boolean} isTabActive - Is the current tab active/focused
 * @param {Object} options - Additional options
 * @returns {string} - 'toast' if shown as toast, 'service-worker' if queued for SW
 */
export const routeNotification = async (
  notification,
  isTabActive,
  options = {}
) => {
  const {
    onClickAction = null,
    durationMs = 4000,
    showAction = true,
  } = options;

  console.log("[NOTIFICATION_ROUTER] Routing notification", {
    tabActive: isTabActive,
    type: notification.type,
    id: notification._id,
    sender_name: notification.sender_name,
  });

  // If tab is active, show toast
  if (isTabActive) {
    console.log("[NOTIFICATION_ROUTER] Tab IS ACTIVE - showing TOAST notification");
    return showNotificationToast(
      notification,
      onClickAction,
      durationMs,
      showAction
    );
  }

  // If tab is inactive, Service Worker will handle it
  console.log("[NOTIFICATION_ROUTER] Tab IS INACTIVE - using SERVICE WORKER for system notification");
  queueForServiceWorker(notification);
  return "service-worker";
};

/**
 * Display notification as toast using Sonner
 */
export const showNotificationToast = (
  notification,
  onClickAction,
  durationMs,
  showAction
) => {
  const {
    _id,
    title,
    body,
    type,
    sender_name,
    sender_avatar,
    action_url,
  } = notification;

  const handleToastClick = () => {
    console.log("[NOTIFICATION_ROUTER] Toast clicked");

    if (onClickAction) {
      onClickAction(notification);
    } else if (action_url) {
      window.location.href = action_url;
    }
  };

  // Choose toast variant based on type
  let toastType = "default";
  let duration = durationMs;

  if (type === "mention") toastType = "warning";
  if (type === "meeting") toastType = "info";
  if (type === "system") toastType = "error";
  if (type === "audio_call" || type === "video_call") {
    toastType = "error"; // Calls are urgent
    duration = 0; // Don't auto-dismiss calls
  }

  // Create toast notification
  const toastId = toast[toastType](
    () => (
      <div
        onClick={handleToastClick}
        className="cursor-pointer w-full"
        style={{ userSelect: "none" }}
      >
        <div className="flex items-start gap-3">
          {sender_avatar && (
            <img
              src={sender_avatar}
              alt={sender_name}
              className="w-10 h-10 rounded-full flex-shrink-0"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">
              {type === "video_call" && "📹 "}
              {type === "audio_call" && "☎️ "}
              {sender_name || title}
            </div>
            <div className="text-xs text-gray-600 truncate">{body}</div>
          </div>
        </div>
      </div>
    ),
    {
      duration: duration,
      description:
        type === "mention"
          ? "You were mentioned"
          : type === "audio_call"
            ? "Incoming audio call"
            : type === "video_call"
              ? "Incoming video call"
              : undefined,
      icon:
        type === "mention"
          ? "🔔"
          : type === "audio_call"
            ? "☎️"
            : type === "video_call"
              ? "📹"
              : type === "meeting"
                ? "📞"
                : type === "message"
                  ? "💬"
                  : "ℹ️",
    }
  );

  console.log(`[NOTIFICATION_ROUTER] Toast shown: ${_id}`);

  return "toast";
};

/**
 * Queue notification for Service Worker to handle
 * Sends message to client to trigger Service Worker notification
 */
export const queueForServiceWorker = async (notification) => {
  const { _id, sender_id, sender_name, body, sender_avatar, action_url, type } = notification;

  console.log(
    "[NOTIFICATION_ROUTER] Queueing notification for Service Worker",
    { notificationId: _id, sender_name, body, type }
  );

  try {
    // Check browser notification support
    if (!("Notification" in window)) {
      console.warn("[NOTIFICATION_ROUTER] Browser does not support notifications");
      return false;
    }

    // Check notification permission
    const permission = Notification.permission;
    console.log(`[NOTIFICATION_ROUTER] Notification permission status: ${permission}`);

    if (permission !== "granted") {
      console.warn(
        `[NOTIFICATION_ROUTER] Notification permission not granted (${permission}). Cannot show system notification.`
      );
      return false;
    }

    // Check if Service Worker is active
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      console.warn(
        "[NOTIFICATION_ROUTER] Service Worker not active, falling back to toast"
      );
      return false;
    }

    // Use sender_name for title, fallback to default
    const displayTitle = sender_name && sender_name.trim() ? sender_name : "New Notification";

    const messagePayload = {
      title: displayTitle,
      message: body,
      icon: sender_avatar || "/logo.png",
      badge: "/logo-badge.png",
      sourceId: sender_id, // Use sender_id (caller's user ID) not notification _id
      actionUrl: action_url,
      id: _id, // Keep notification ID for reference
      notificationType: type,
    };

    console.log("[NOTIFICATION_ROUTER] Sending to Service Worker:", messagePayload);

    // Send message to Service Worker to show notification
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: messagePayload,
    });

    console.log(
      "[NOTIFICATION_ROUTER] ✅ Message sent to Service Worker for notification",
      _id
    );

    return true;
  } catch (error) {
    console.error(
      "[NOTIFICATION_ROUTER] Error queuing for Service Worker:",
      error.message,
      error
    );
    return false;
  }
};

/**
 * Parse notification type for display
 */
export const getNotificationIcon = (type) => {
  const icons = {
    message: "💬",
    mention: "🔔",
    meeting: "📞",
    system: "ℹ️",
  };
  return icons[type] || "📬";
};

/**
 * Get notification color based on type
 */
export const getNotificationColor = (type) => {
  const colors = {
    message: "blue",
    mention: "yellow",
    meeting: "purple",
    system: "gray",
  };
  return colors[type] || "gray";
};

/**
 * Get notification action URL
 */
export const getNotificationActionUrl = (notification) => {
  const { action_url, source_type, metadata } = notification;

  if (action_url) return action_url;

  // Generate URL based on source type
  if (source_type === "message" && metadata?.data?.channel_id) {
    return `/chat/${metadata.data.channel_id}`;
  }

  if (source_type === "meeting" && metadata?.data?.meeting_id) {
    return `/meetings/${metadata.data.meeting_id}`;
  }

  return "/";
};

export default {
  routeNotification,
  showNotificationToast,
  queueForServiceWorker,
  getNotificationIcon,
  getNotificationColor,
  getNotificationActionUrl,
};
