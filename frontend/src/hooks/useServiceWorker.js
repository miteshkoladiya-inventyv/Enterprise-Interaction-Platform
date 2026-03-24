import { useState, useEffect, useCallback } from "react";

/**
 * useServiceWorker Hook
 * Registers and manages Service Worker for background notifications
 * Handles messages from Service Worker (notification clicks, etc.)
 */
export const useServiceWorker = () => {
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [registrationState, setRegistrationState] = useState(null);
  const [error, setError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    Notification?.permission || "default"
  );

  // Register Service Worker on mount
  useEffect(() => {
    if (!navigator.serviceWorker) {
      console.warn("[SERVICE_WORKER] Service Workers not supported in this browser");
      return;
    }

    registerServiceWorker();
  }, []);

  /**
   * Register Service Worker
   */
  const registerServiceWorker = useCallback(async () => {
    try {
      console.log("[SERVICE_WORKER] Registering Service Worker...");

      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });

      console.log("[SERVICE_WORKER] Service Worker registered:", registration);
      setRegistrationState(registration);
      setServiceWorkerReady(true);
      setError(null);

      // Listen for messages from Service Worker
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );

      return registration;
    } catch (err) {
      console.error("[SERVICE_WORKER] Registration error:", err.message);
      setError(err.message);
      setServiceWorkerReady(false);
    }
  }, []);

  /**
   * Handle messages from Service Worker
   */
  const handleServiceWorkerMessage = useCallback((event) => {
    const { type, data } = event.data;

    if (type === "NOTIFICATION_CLICKED") {
      console.log(`[SERVICE_WORKER] Notification clicked:`, data);
      // Handle notification click
      if (data.navigate) {
        window.location.href = data.navigate;
      }
    }

    if (type === "NOTIFICATION_CLOSED") {
      console.log(`[SERVICE_WORKER] Notification closed:`, data);
    }
  }, []);

  /**
   * Request notification permission
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("[SERVICE_WORKER] Notifications not supported");
      return false;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      return true;
    }

    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        return permission === "granted";
      } catch (error) {
        console.error("[SERVICE_WORKER] Permission request error:", error.message);
        return false;
      }
    }

    return false;
  }, []);

  /**
   * Check if browser supports notifications
   */
  const supportsNotifications = useCallback(() => {
    return "Notification" in window && "serviceWorker" in navigator;
  }, []);

  /**
   * Show notification (send to Service Worker)
   */
  const showNotification = useCallback(
    async (options) => {
      if (!serviceWorkerReady || !registrationState) {
        console.warn("[SERVICE_WORKER] Service Worker not ready");
        return false;
      }

      if (notificationPermission !== "granted") {
        console.warn("[SERVICE_WORKER] Notification permission not granted");
        return false;
      }

      try {
        // Post message to Service Worker telling it to show notification
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            payload: {
              title: options.title,
              message: options.body || options.message || "",
              icon: options.icon || "/logo.png",
              badge: options.badge || "/logo-badge.png",
              sourceId: options.sourceId,
              actionUrl: options.actionUrl,
              id: options.id || `notif_${Date.now()}`,
            },
          });

          console.log("[SERVICE_WORKER] Notification shown:", options.title);
          return true;
        }
      } catch (error) {
        console.error("[SERVICE_WORKER] Show notification error:", error.message);
        return false;
      }
    },
    [serviceWorkerReady, registrationState, notificationPermission]
  );

  /**
   * Unregister Service Worker
   */
  const unregisterServiceWorker = useCallback(async () => {
    try {
      if (registrationState) {
        await registrationState.unregister();
        console.log("[SERVICE_WORKER] Service Worker unregistered");
        setRegistrationState(null);
        setServiceWorkerReady(false);
      }
    } catch (error) {
      console.error("[SERVICE_WORKER] Unregister error:", error.message);
    }
  }, [registrationState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        );
      }
    };
  }, [handleServiceWorkerMessage]);

  return {
    serviceWorkerReady,
    registrationState,
    error,
    notificationPermission,
    registerServiceWorker,
    requestNotificationPermission,
    supportsNotifications,
    showNotification,
    unregisterServiceWorker,
  };
};

export default useServiceWorker;
