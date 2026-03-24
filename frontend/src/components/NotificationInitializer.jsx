import { useEffect, useState } from "react";
import useServiceWorker from "../hooks/useServiceWorker";

/**
 * NotificationInitializer Component
 *
 * Initializes the notification system on app load:
 * 1. Registers Service Worker
 * 2. Requests notification permission
 * 3. Sets up browser notifications
 *
 * Place this component near the root of your app (in App.jsx)
 */
export const NotificationInitializer = () => {
  const {
    serviceWorkerReady,
    notificationPermission,
    requestNotificationPermission,
    supportsNotifications,
  } = useServiceWorker();

  const [permissionRequested, setPermissionRequested] = useState(false);

  useEffect(() => {
    // Only run once on mount
    if (permissionRequested) return;

    const initializeNotifications = async () => {
      console.log("[NOTIFICATION_INIT] Starting notification system initialization");

      // Check browser support
      if (!supportsNotifications()) {
        console.warn("[NOTIFICATION_INIT] Browser does not support notifications");
        return;
      }

      // Wait for Service Worker to be ready
      if (!serviceWorkerReady) {
        console.log("[NOTIFICATION_INIT] Waiting for Service Worker...");
        return;
      }

      console.log("[NOTIFICATION_INIT] Service Worker ready");

      // If permission is already granted, we're done
      if (notificationPermission === "granted") {
        console.log("[NOTIFICATION_INIT] ✅ Notification permission already granted");
        setPermissionRequested(true);
        return;
      }

      // If permission was already denied by user, don't ask again
      if (notificationPermission === "denied") {
        console.log("[NOTIFICATION_INIT] ⛔ Notification permission denied by user");
        setPermissionRequested(true);
        return;
      }

      // Ask user for permission (only once)
      console.log("[NOTIFICATION_INIT] Requesting notification permission from user...");
      const granted = await requestNotificationPermission();

      if (granted) {
        console.log("[NOTIFICATION_INIT] ✅ Notification permission granted!");
      } else {
        console.log("[NOTIFICATION_INIT] ⛔ Notification permission denied");
      }

      setPermissionRequested(true);
    };

    initializeNotifications();
  }, [serviceWorkerReady, notificationPermission, requestNotificationPermission, supportsNotifications, permissionRequested]);

  // This component doesn't render anything
  return null;
};

export default NotificationInitializer;
