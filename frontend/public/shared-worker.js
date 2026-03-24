/**
 * SharedWorker - Central Hub for Tab Coordination
 *
 * This SharedWorker acts as a central coordinator for all tabs in the same domain.
 * It tracks:
 * - Which tabs are currently active/focused
 * - Unread notification count (synced across tabs)
 * - Notification routing (to active tab only for toasts)
 *
 * Flow:
 * 1. Each tab connects and sends TAB_FOCUS/TAB_BLUR messages
 * 2. SharedWorker tracks which tab is currently active
 * 3. When notification arrives, SharedWorker broadcasts to active tab
 * 4. Active tab shows toast, inactive tabs defer to Service Worker
 */

const connectedPorts = [];
let activeTabId = null;
let unreadCount = 0;

console.log("[SHARED_WORKER] Initializing");

self.onconnect = function (event) {
  const port = event.ports[0];
  console.log("[SHARED_WORKER] New tab connected");

  // Add port to list of connected ports
  connectedPorts.push(port);

  // Start listening to messages from this port
  port.start();

  let tabId = null;
  let isTabActive = false;

  const handleMessage = (event) => {
    const { type, payload, tabIdPayload } = event.data;

    console.log(`[SHARED_WORKER] Message received: ${type}`, event.data);

    if (type === "INIT") {
      tabId = event.data.tabId || `tab_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[SHARED_WORKER] Tab initialized: ${tabId}`);

      // Notify all tabs of current state
      broadcastToAll({
        type: "CURRENT_STATE",
        activeTabId,
        unreadCount,
      });
    }

    // Tab gained focus
    if (type === "TAB_FOCUS") {
      isTabActive = true;
      const previousActiveTab = activeTabId;
      activeTabId = tabId;

      console.log(
        `[SHARED_WORKER] Tab gained focus: ${tabId} (was: ${previousActiveTab})`
      );

      // Broadcast to all tabs that active tab changed
      broadcastToAll({
        type: "ACTIVE_TAB_CHANGED",
        activeTabId: tabId,
        previousTabId: previousActiveTab,
      });

      // If there are pending notifications, send to newly active tab
      // (This enables notifications from Service Worker to reach the active tab)
    }

    // Tab lost focus
    if (type === "TAB_BLUR") {
      isTabActive = false;

      console.log(`[SHARED_WORKER] Tab lost focus: ${tabId}`);

      if (activeTabId === tabId) {
        activeTabId = null;
        broadcastToAll({
          type: "NO_ACTIVE_TAB",
        });
      }
    }

    // New notification arrived
    if (type === "NEW_NOTIFICATION") {
      const notification = payload;

      console.log(
        `[SHARED_WORKER] New notification received for tab ${tabId}`,
        notification
      );

      // Route to active tab only
      if (isTabActive && activeTabId === tabId) {
        // This is the active tab - deliver notification for toast display
        port.postMessage({
          type: "NOTIFICATION_RECEIVED",
          payload: notification,
          deliveredToActiveTab: true,
          deliveredVia: "toast",
        });

        console.log(`[SHARED_WORKER] Routed to active tab for toast display`);
      } else {
        // This is an inactive tab - let Service Worker handle it
        port.postMessage({
          type: "NOTIFICATION_RECEIVED",
          payload: notification,
          deliveredToActiveTab: false,
          deliveredVia: "service-worker",
        });

        console.log(
          `[SHARED_WORKER] Routed to inactive tab for Service Worker handling`
        );
      }
    }

    // Update unread count
    if (type === "UPDATE_UNREAD_COUNT") {
      unreadCount = payload;

      console.log(`[SHARED_WORKER] Unread count updated: ${unreadCount}`);

      // Broadcast to all tabs to keep counts in sync
      broadcastToAll({
        type: "UNREAD_COUNT_SYNC",
        count: unreadCount,
      });
    }

    // Notification clicked in Service Worker
    if (type === "NOTIFICATION_CLICKED") {
      const { notificationId, navigate } = payload;

      console.log(
        `[SHARED_WORKER] Notification clicked: ${notificationId}, navigating to: ${navigate}`
      );

      // Send to active tab (or create new window)
      if (activeTabId) {
        const activePort = connectedPorts.find((p) => p.tabId === activeTabId);
        if (activePort) {
          activePort.postMessage({
            type: "NAVIGATE_TO_NOTIFICATION",
            notificationId,
            url: navigate,
          });
        }
      }
    }

    // Mark notification as read
    if (type === "MARK_AS_READ") {
      const { notificationId } = payload;

      console.log(
        `[SHARED_WORKER] Marking notification as read: ${notificationId}`
      );

      // Decrement unread count
      if (unreadCount > 0) {
        unreadCount--;

        // Broadcast new count to all tabs
        broadcastToAll({
          type: "UNREAD_COUNT_SYNC",
          count: unreadCount,
        });
      }
    }

    // Dismiss/close notification from all tabs
    if (type === "DISMISS_NOTIFICATION") {
      const { notificationId } = payload;

      console.log(
        `[SHARED_WORKER] Dismissing notification from all tabs: ${notificationId}`
      );

      // Broadcast to all tabs to dismiss this notification
      broadcastToAll({
        type: "NOTIFICATION_DISMISSED_ALL_TABS",
        notificationId,
      });
    }
  };

  // Attach tabId to port for identification
  port.tabId = tabId;

  port.addEventListener("message", handleMessage);

  // Handle port close/disconnect
  port.addEventListener("messageerror", (error) => {
    console.error("[SHARED_WORKER] Message error:", error);
  });

  // Remove port when closed
  const handlePortClose = () => {
    const index = connectedPorts.indexOf(port);
    if (index >= 0) {
      connectedPorts.splice(index, 1);
    }

    // If this was the active tab, clear active tab
    if (activeTabId === port.tabId) {
      activeTabId = null;
      broadcastToAll({
        type: "NO_ACTIVE_TAB",
      });
    }

    console.log(`[SHARED_WORKER] Tab disconnected: ${port.tabId}`);
  };

  // Listen for port close (when tab is closed)
  port.addEventListener("close", handlePortClose);
};

/**
 * Broadcast message to all connected ports
 */
function broadcastToAll(message) {
  console.log(
    `[SHARED_WORKER] Broadcasting to ${connectedPorts.length} ports:`,
    message.type
  );

  connectedPorts.forEach((port) => {
    try {
      port.postMessage(message);
    } catch (error) {
      console.error("[SHARED_WORKER] Error broadcasting to port:", error);
    }
  });
}

console.log("[SHARED_WORKER] Ready to accept connections");
