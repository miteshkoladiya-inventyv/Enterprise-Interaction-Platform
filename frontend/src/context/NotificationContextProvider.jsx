import { createContext, useContext } from "react";
import useNotifications from "../hooks/useNotifications";

/**
 * NotificationContext
 * Provides global access to notification state and functions
 */
export const NotificationContext = createContext(null);

/**
 * NotificationContextProvider Component
 * Wraps app to provide notification functionality to all child components
 */
export const NotificationContextProvider = ({ children }) => {
  const notificationState = useNotifications();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * useNotificationContext Hook
 * Access notification context from any component
 */
export const useNotificationContext = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationContextProvider"
    );
  }

  return context;
};

export default NotificationContextProvider;
