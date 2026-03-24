import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationContext } from "../context/NotificationContextProvider";

/**
 * NotificationBell Component
 * Displays unread notification count badge
 * Shows/hides NotificationCenter dropdown when clicked
 */
export const NotificationBell = ({ onOpenCenter = null }) => {
  const { unreadCount } = useNotificationContext();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onOpenCenter) {
      onOpenCenter();
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={`${unreadCount} unread notifications`}
      aria-label="Notifications"
    >
      {/* Bell Icon */}
      <Bell
        size={24}
        className={`transition-colors ${
          isHovered
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-400"
        }`}
      />

      {/* Badge with unread count */}
      {unreadCount > 0 && (
        <div className="absolute top-0 right-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        </div>
      )}

      {/* Dot indicator when unread exist */}
      {unreadCount > 0 && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
      )}
    </button>
  );
};

export default NotificationBell;
