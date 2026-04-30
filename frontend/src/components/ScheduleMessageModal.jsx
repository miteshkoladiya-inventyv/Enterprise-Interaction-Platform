import React, { useState } from "react";
import axios from "axios";
// import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";
import { Clock, X } from "lucide-react";
import { toast } from "sonner";

const ScheduleMessageModal = ({ isOpen, onClose, channelId, onMessageScheduled }) => {
  const [content, setContent] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loading, setLoading] = useState(false);

  // Get minimum datetime (now)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // At least 1 minute in the future
    return now.toISOString().slice(0, 16);
  };

  const handleSchedule = async () => {
    try {
      if (!content.trim()) {
        toast.error("Message content is required");
        return;
      }

      if (!scheduledTime) {
        toast.error("Please select a date and time");
        return;
      }

      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${BACKEND_URL}/chat/messages/schedule`,
        {
          channel_id: channelId,
          content: content.trim(),
          scheduled_send_time: new Date(scheduledTime).toISOString(),
          message_type: "text",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Message scheduled successfully!");
      setContent("");
      setScheduledTime("");
      onClose();

      if (onMessageScheduled) {
        onMessageScheduled(response.data.data);
      }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to schedule message";
      toast.error(message);
      console.error("Schedule error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayTime = () => {
    if (!scheduledTime) return "";
    const date = new Date(scheduledTime);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Schedule Message</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Message Content */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to send later?"
              className="w-full p-3 bg-zinc-800 border border-zinc-700/60 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              rows={4}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {content.length}/1000 characters
            </p>
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Send at
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={getMinDateTime()}
              className="w-full p-3 bg-zinc-800 border border-zinc-700/60 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {scheduledTime && (
              <p className="text-xs text-indigo-400 mt-2">
                Message will be sent: <strong>{getDisplayTime()}</strong>
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
            <p className="text-xs text-zinc-400">
              📌 <span className="text-zinc-300">Pro tip:</span> You can edit or cancel this message anytime before it's sent.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 bg-zinc-800 text-zinc-200 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={loading || !content.trim() || !scheduledTime}
            className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleMessageModal;
