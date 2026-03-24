import { useState, useEffect, useCallback } from "react";

/**
 * useSharedWorker Hook
 * Manages SharedWorker connection and message passing
 * Enables communication between multiple tabs
 */
export const useSharedWorker = () => {
  const [sharedWorkerPort, setSharedWorkerPort] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tabId, setTabId] = useState(null);

  // Initialize SharedWorker connection
  useEffect(() => {
    try {
      // Create SharedWorker instance
      const worker = new SharedWorker("/shared-worker.js");
      const port = worker.port;

      // Generate unique tab ID
      const uniqueTabId = `tab_${Math.random().toString(36).substr(2, 9)}`;
      setTabId(uniqueTabId);

      // Start listening
      port.start();

      // Send init message
      port.postMessage({
        type: "INIT",
        tabId: uniqueTabId,
        timestamp: new Date().toISOString(),
      });

      console.log(`[SHARED_WORKER] Connected with tabId: ${uniqueTabId}`);

      // Set up message listener
      const handleMessage = (event) => {
        const { type, data } = event.data;
        console.log(`[SHARED_WORKER] Message received: ${type}`, data);
      };

      port.addEventListener("message", handleMessage);
      setSharedWorkerPort(port);
      setIsConnected(true);

      return () => {
        port.removeEventListener("message", handleMessage);
        port.close?.();
      };
    } catch (error) {
      console.error("[SHARED_WORKER] Initialization error:", error.message);
      // SharedWorker may not be supported
      setIsConnected(false);
    }
  }, []);

  /**
   * Send message to SharedWorker
   */
  const postMessage = useCallback(
    (message) => {
      if (!sharedWorkerPort) {
        console.warn("[SHARED_WORKER] Port not connected");
        return false;
      }

      try {
        sharedWorkerPort.postMessage(message);
        return true;
      } catch (error) {
        console.error("[SHARED_WORKER] Post message error:", error.message);
        return false;
      }
    },
    [sharedWorkerPort]
  );

  /**
   * Register message listener
   */
  const addEventListener = useCallback(
    (messageType, callback) => {
      if (!sharedWorkerPort) {
        console.warn("[SHARED_WORKER] Port not connected");
        return;
      }

      const handler = (event) => {
        if (event.data.type === messageType) {
          callback(event.data);
        }
      };

      sharedWorkerPort.addEventListener("message", handler);

      // Return unsubscribe function
      return () => {
        sharedWorkerPort.removeEventListener("message", handler);
      };
    },
    [sharedWorkerPort]
  );

  /**
   * Notify that tab gained focus
   */
  const notifyTabFocus = useCallback(() => {
    postMessage({
      type: "TAB_FOCUS",
      tabId,
      timestamp: new Date().toISOString(),
    });
  }, [postMessage, tabId]);

  /**
   * Notify that tab lost focus
   */
  const notifyTabBlur = useCallback(() => {
    postMessage({
      type: "TAB_BLUR",
      tabId,
      timestamp: new Date().toISOString(),
    });
  }, [postMessage, tabId]);

  /**
   * Notify of new notification
   */
  const notifyNewNotification = useCallback(
    (notification) => {
      postMessage({
        type: "NEW_NOTIFICATION",
        payload: notification,
        tabId,
        timestamp: new Date().toISOString(),
      });
    },
    [postMessage, tabId]
  );

  /**
   * Update unread count across tabs
   */
  const syncUnreadCount = useCallback(
    (count) => {
      postMessage({
        type: "UPDATE_UNREAD_COUNT",
        payload: count,
        tabId,
        timestamp: new Date().toISOString(),
      });
    },
    [postMessage, tabId]
  );

  return {
    sharedWorkerPort,
    isConnected,
    tabId,
    postMessage,
    addEventListener,
    notifyTabFocus,
    notifyTabBlur,
    notifyNewNotification,
    syncUnreadCount,
  };
};

export default useSharedWorker;
