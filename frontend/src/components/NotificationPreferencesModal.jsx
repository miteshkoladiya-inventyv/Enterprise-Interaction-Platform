import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { useAuthContext } from "../context/AuthContextProvider";
import notificationService from "../services/notificationService";
import { toast } from "sonner";

/**
 * NotificationPreferencesModal Component
 * Modal for managing notification settings:
 * - Enable/disable all notifications
 * - Enable/disable desktop notifications
 * - Mention-only mode
 * - Do Not Disturb scheduling
 * - Mute channels
 * - Mute users
 */
export const NotificationPreferencesModal = ({ isOpen = false, onClose = null }) => {
  const { user } = useAuthContext();
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    notifications_enabled: true,
    desktop_notifications_enabled: true,
    mention_only: false,
    do_not_disturb_enabled: false,
    do_not_disturb_start: "22:00",
    do_not_disturb_end: "08:00",
    muted_channels: [],
    muted_users: [],
  });

  // Fetch current preferences on modal open
  useEffect(() => {
    if (!isOpen || !token) return;

    fetchPreferences();
  }, [isOpen, token]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const result = await notificationService.getPreferences(token);

      if (result.data) {
        setPreferences(result.data);
      }
    } catch (error) {
      console.error("[NOTIFICATION_PREFS] Fetch error:", error.message);
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleTimeChange = (field, value) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      await notificationService.updatePreferences(token, preferences);

      toast.success("Preferences saved successfully");

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("[NOTIFICATION_PREFS] Save error:", error.message);
      toast.error("Failed to save preferences");
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Preferences
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Master Toggle */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.notifications_enabled}
                  onChange={() => handleToggle("notifications_enabled")}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    Enable all notifications
                  </p>
                  <p className="text-xs text-gray-500">
                    Turn off to disable all notifications
                  </p>
                </div>
              </label>
            </div>

            {/* Desktop Notifications */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.desktop_notifications_enabled}
                  onChange={() =>
                    handleToggle("desktop_notifications_enabled")
                  }
                  disabled={!preferences.notifications_enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50"
                />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    Browser notifications
                  </p>
                  <p className="text-xs text-gray-500">
                    Show system notifications when tab is inactive
                  </p>
                </div>
              </label>
            </div>

            {/* Mention Only */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.mention_only}
                  onChange={() => handleToggle("mention_only")}
                  disabled={!preferences.notifications_enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50"
                />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    @Mentions only
                  </p>
                  <p className="text-xs text-gray-500">
                    Only notify when someone mentions you
                  </p>
                </div>
              </label>
            </div>

            {/* Do Not Disturb */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.do_not_disturb_enabled}
                  onChange={() =>
                    handleToggle("do_not_disturb_enabled")
                  }
                  disabled={!preferences.notifications_enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50"
                />
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    Do Not Disturb
                  </p>
                  <p className="text-xs text-gray-500">
                    Mute notifications during specific hours
                  </p>
                </div>
              </label>

              {preferences.do_not_disturb_enabled && (
                <div className="ml-7 space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      From:
                    </label>
                    <input
                      type="time"
                      value={preferences.do_not_disturb_start}
                      onChange={(e) =>
                        handleTimeChange(
                          "do_not_disturb_start",
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      To:
                    </label>
                    <input
                      type="time"
                      value={preferences.do_not_disturb_end}
                      onChange={(e) =>
                        handleTimeChange("do_not_disturb_end", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Info Text */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-xs text-blue-700 dark:text-blue-300">
              💡 You can also mute specific channels or users while in any chat.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveLoading || loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesModal;
