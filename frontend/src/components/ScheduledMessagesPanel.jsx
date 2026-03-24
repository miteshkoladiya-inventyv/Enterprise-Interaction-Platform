import React, { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import { Clock, Trash2, Send, Edit2 } from "lucide-react";
import { toast } from "sonner";

const ScheduledMessagesPanel = ({ channelId }) => {
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && channelId) {
      loadScheduledMessages();
    }
  }, [expanded, channelId]);

  const loadScheduledMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${BACKEND_URL}/chat/channels/${channelId}/scheduled`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setScheduledMessages(response.data.data.scheduled_messages || []);
    } catch (error) {
      console.error("Error loading scheduled messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNow = async (scheduledMessageId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${BACKEND_URL}/chat/scheduled-messages/${scheduledMessageId}/send`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Message sent!");
      loadScheduledMessages();
    } catch (error) {
      toast.error("Failed to send message");
      console.error("Error:", error);
    }
  };

  const handleCancel = async (scheduledMessageId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${BACKEND_URL}/chat/scheduled-messages/${scheduledMessageId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Scheduled message cancelled");
      loadScheduledMessages();
    } catch (error) {
      toast.error("Failed to cancel message");
      console.error("Error:", error);
    }
  };

  const formatScheduledTime = (time) => {
    const date = new Date(time);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="border-t border-zinc-700/50">
      {/* Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-zinc-800/50 transition-colors"
      >
        <Clock className={`w-4 h-4 text-amber-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        <span className="text-sm font-medium text-zinc-300 flex-1 text-left">
          Scheduled Messages
        </span>
        {scheduledMessages.length > 0 && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-full">
            {scheduledMessages.length}
          </span>
        )}
      </button>

      {/* Scheduled Messages List */}
      {expanded && (
        <div className="max-h-96 overflow-y-auto border-t border-zinc-700/50">
          {loading ? (
            <div className="px-4 py-3 text-sm text-zinc-500 text-center">
              Loading scheduled messages...
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500 text-center">
              No scheduled messages
            </div>
          ) : (
            <div className="space-y-1">
              {scheduledMessages.map((msg) => (
                <div
                  key={msg._id}
                  className="px-4 py-3 border-b border-zinc-700/30 hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Message Content Preview */}
                  <p className="text-sm text-zinc-200 mb-1 truncate">
                    {msg.content}
                  </p>

                  {/* Scheduled Time */}
                  <p className="text-xs text-amber-400/80 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatScheduledTime(msg.scheduled_send_time)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSendNow(msg._id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 rounded text-xs font-medium transition-colors"
                      title="Send now (don't wait)"
                    >
                      <Send className="w-3 h-3" />
                      Send Now
                    </button>
                    <button
                      onClick={() => handleCancel(msg._id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600/20 text-red-300 hover:bg-red-600/40 rounded text-xs font-medium transition-colors"
                      title="Cancel scheduled send"
                    >
                      <Trash2 className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduledMessagesPanel;
