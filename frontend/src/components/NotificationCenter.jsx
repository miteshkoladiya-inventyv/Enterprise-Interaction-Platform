import { useState, useRef, useEffect } from "react";
import { X, Trash2, Check, Settings } from "lucide-react";
import { useNotificationContext } from "../context/NotificationContextProvider";
import { getNotificationIcon } from "../utils/notificationRouter.jsx";
import { toast } from "sonner";

/**
 * NotificationCenter Component
 * Dropdown showing list of notifications with actions
 */
export const NotificationCenter = ({
  isOpen = false,
  onClose = null,
  onOpenPreferences = null,
}) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
  } = useNotificationContext();

  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();

    try {
      setIsLoading(true);
      await markAsRead(notificationId);
      toast.success("Marked as read");
    } catch (error) {
      console.error("[NOTIFICATION_CENTER] Mark as read error:", error);
      toast.error("Failed to mark as read");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();

    try {
      setIsLoading(true);
      await deleteNotification(notificationId);
      toast.success("Notification deleted");
    } catch (error) {
      console.error("[NOTIFICATION_CENTER] Delete error:", error);
      toast.error("Failed to delete notification");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsLoading(true);
      await markAllAsRead();
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("[NOTIFICATION_CENTER] Mark all as read error:", error);
      toast.error("Failed to mark all as read");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-16 right-0 w-96 max-h-96 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-gray-500">
            {unreadCount} unread
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="ml-3 text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications && notifications.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-500 text-center">No notifications</p>
          </div>
        )}
      </div>

      {/* Footer with Preferences button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={() => {
            if (onOpenPreferences) onOpenPreferences();
            if (onClose) onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <Settings size={16} />
          Notification Preferences
        </button>
      </div>
    </div>
  );
};

/**
 * Individual notification item component
 */
const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  isLoading,
}) => {
  const { _id, title, body, is_read, sender_avatar, type } = notification;

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group ${
        !is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
      }`}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        {sender_avatar && (
          <img
            src={sender_avatar}
            alt={title}
            className="w-10 h-10 rounded-full flex-shrink-0"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getNotificationIcon(type)}</span>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                {title}
              </h3>
            </div>
            {!is_read && (
              <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></div>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {body}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!is_read && (
            <button
              onClick={(e) => onMarkAsRead(_id, e)}
              disabled={isLoading}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors disabled:opacity-50"
              title="Mark as read"
            >
              <Check size={16} className="text-blue-600" />
            </button>
          )}
          <button
            onClick={(e) => onDelete(_id, e)}
            disabled={isLoading}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
