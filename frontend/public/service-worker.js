/**
 * Service Worker - Background Notification Handler
 *
 * This Service Worker runs in the background and handles:
 * - Browser system notifications when tab is inactive
 * - Notification click handling
 * - Notification close handling
 * - Message passing from clients
 *
 * Flow:
 * 1. Client sends SHOW_NOTIFICATION message
 * 2. Service Worker shows browser system notification
 * 3. When user clicks notification, navigate to that page
 * 4. When user closes notification, mark as dismissed
 */

console.log("[SERVICE_WORKER] Service Worker loaded");

// Listen for messages from clients (tabs)
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  console.log(`[SERVICE_WORKER] Message received: ${type}`, payload);

  if (type === "SHOW_NOTIFICATION") {
    handleShowNotification(payload);
  }

  if (type === "NOTIFICATION_CLICKED") {
    handleNotificationClick(payload);
  }

  if (type === "NOTIFICATION_CLOSED") {
    handleNotificationClose(payload);
  }
});

/**
 * Show a browser notification
 */
function handleShowNotification(payload) {
  const { title, message, icon, badge, sourceId, actionUrl, id, notificationType } = payload;

  console.log("[SERVICE_WORKER] handleShowNotification called with:", {
    title,
    message,
    notificationType,
    sourceId,
    id,
  });

  // Call notifications should require interaction (user must dismiss or click action)
  const isCallNotification =
    notificationType === "audio_call" || notificationType === "video_call";

  // Chat notifications support inline reply
  const isChatNotification = notificationType === "message" || notificationType === "mention";

  const options = {
    body: message,
    icon: icon || "/logo.png",
    badge: badge || "/logo-badge.png",
    tag: id || sourceId, // Use id as tag to prevent duplicates
    requireInteraction: isCallNotification, // Calls require user action
    data: {
      notificationId: id,
      sourceId,
      notificationType,
      actionUrl: actionUrl || "/calls",
      title,
      body: message,
    },
    actions: [],
  };

  // Add actions based on notification type
  if (isCallNotification) {
    // Call notifications: Accept or Reject
    options.actions = [
      {
        action: "accept",
        title: "Accept Call",
      },
      {
        action: "reject",
        title: "Reject Call",
      },
    ];
    console.log("[SERVICE_WORKER] Call notification - actions added: accept, reject");
  }
  else if (isChatNotification) {
    // Chat notifications: Inline reply input
    options.actions = [
      {
        action: "reply",
        title: "Reply",
        type: "text",
        placeholder: "Type your reply...",
      },
      {
        action: "open",
        title: "Open Chat",
      },
    ];
    console.log("[SERVICE_WORKER] Chat notification - reply input added");
  }

  self.registration
    .showNotification(title, options)
    .then(() => {
      console.log("[SERVICE_WORKER] ✅ Notification shown:", title);
    })
    .catch((error) => {
      console.error("[SERVICE_WORKER] ❌ Error showing notification:", error);
    });
}

/**
 * Handle notification click
 */
function handleNotificationClick(payload) {
  const { notificationId, url } = payload;

  console.log("[SERVICE_WORKER] Notification clicked:", notificationId);

  if (url) {
    // Focus existing window or open new one
    self.clients
      .matchAll({ type: "window" })
      .then((windowClients) => {
        // Check if already open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // If not open, open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
      .catch((error) => {
        console.error(
          "[SERVICE_WORKER] Error handling notification click:",
          error
        );
      });
  }
}

/**
 * Handle notification close/dismiss
 */
function handleNotificationClose(payload) {
  const { notificationId } = payload;

  console.log("[SERVICE_WORKER] Notification closed/dismissed:", notificationId);

  // Could log analytics here if needed
}

/**
 * Handle notification close from system
 */
self.addEventListener("notificationclose", (event) => {
  const { notificationId } = event.notification.data;

  console.log("[SERVICE_WORKER] System notification closed:", notificationId);

  // Notify clients that notification was dismissed
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "NOTIFICATION_DISMISSED",
        notificationId,
      });
    });
  });
});

/**
 * Handle notification action buttons (accept, reject, reply, etc.)
 */
self.addEventListener("notificationclick", (event) => {
  console.log("[SERVICE_WORKER] notificationclick event triggered");
  console.log("[SERVICE_WORKER] event.action:", event.action);
  console.log("[SERVICE_WORKER] event.reply:", event.reply);

  const notification = event.notification;
  const { notificationId, sourceId, notificationType, actionUrl, body, title } = notification.data;
  const action = event.action;
  const reply = event.reply;

  console.log(`[SERVICE_WORKER] 📱 Notification action clicked:`, {
    action,
    notificationId,
    sourceId,
    notificationType,
    hasReply: !!reply,
  });

  // IMPORTANT: Prevent default notification close behavior
  event.preventDefault();

  // Close the notification manually
  notification.close();

  // Handle call notifications: Accept/Reject
  if (notificationType === "audio_call" || notificationType === "video_call") {
    console.log(`[SERVICE_WORKER] ☎️ Call notification - action: ${action}`);

    if (action === "accept" || action === "reject") {
      console.log(`[SERVICE_WORKER] ✅ Valid call action detected: ${action}`);

      event.waitUntil(
        (async () => {
          try {
            const clientList = await self.clients.matchAll({
              type: "window",
              includeUncontrolled: true,
            });

            console.log(`[SERVICE_WORKER] Found ${clientList.length} clients`);

            if (clientList.length === 0) {
              console.error(
                "[SERVICE_WORKER] ❌ No app window found! Cannot accept/reject call."
              );
              return;
            }

            // Get the first client
            const targetClient = clientList[0];
            console.log(`[SERVICE_WORKER] Target client URL:`, targetClient.url);

            // Post message BEFORE focusing to ensure it's received
            const messageData = {
              type: "CALL_ACTION_FROM_NOTIFICATION",
              action: action,
              notificationId,
              sourceId,
              callType: notificationType === "video_call" ? "video" : "audio",
            };

            console.log(`[SERVICE_WORKER] 📤 Posting message to client:`, messageData);
            targetClient.postMessage(messageData);

            // Then focus the client
            await targetClient.focus();
            console.log(`[SERVICE_WORKER] ✅ Client focused after posting message`);
          } catch (error) {
            console.error("[SERVICE_WORKER] ❌ Error in call action handler:", error);
          }
        })()
      );
    } else {
      console.log(`[SERVICE_WORKER] ⚠️ Call notification clicked but no action: action="${action}"`);
      // Notification clicked but not an action button (empty action)
      // Just focus the app
      event.waitUntil(
        (async () => {
          const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          if (clientList.length > 0) {
            await clientList[0].focus();
          }
        })()
      );
    }
  }
  // Handle chat notifications: Reply or Open
  else if (notificationType === "message" || notificationType === "mention") {
    if (action === "reply" && reply) {
      console.log(`[SERVICE_WORKER] 💬 Reply action triggered with text:`, reply.substring(0, 50));

      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clientList) => {
            let targetClient = clientList[0];

            if (!targetClient && self.clients.openWindow) {
              return self.clients.openWindow("/");
            }

            if (targetClient) {
              targetClient.focus();
              targetClient.postMessage({
                type: "CHAT_REPLY_FROM_NOTIFICATION",
                reply: reply,
                notificationId,
                sourceId,
                metadata: { title, originalMessage: body },
              });
            }
          })
      );
    } else {
      console.log("[SERVICE_WORKER] Open chat action triggered");
      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clientList) => {
            if (clientList.length > 0) {
              clientList[0].focus();
            } else if (self.clients.openWindow) {
              self.clients.openWindow("/");
            }
          })
      );
    }
  }
  // Default: just open app
  else {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            clientList[0].focus();
          } else if (self.clients.openWindow) {
            self.clients.openWindow("/");
          }
        })
    );
  }
});

/**
 * Handle service worker activated
 */
self.addEventListener("activate", (event) => {
  console.log("[SERVICE_WORKER] Activated");

  // Claim all clients
  event.waitUntil(self.clients.claim());
});

/**
 * Handle service worker installed
 */
self.addEventListener("install", (event) => {
  console.log("[SERVICE_WORKER] Installed");

  // Force activation
  self.skipWaiting(event);
});

console.log("[SERVICE_WORKER] Service Worker ready to handle notifications");
