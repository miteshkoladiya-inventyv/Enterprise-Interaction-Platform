import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
//import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";
import { Check, CheckCheck, Clock } from "lucide-react";

const MessageStatusIndicators = ({ messageId, channelId, senderId, currentUserId }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  // Load status on mount
  useEffect(() => {
    if (currentUserId === senderId) {
      loadMessageStatus();
    }
  }, [messageId, currentUserId, senderId]);

  const loadMessageStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${BACKEND_URL}/chat/messages/${messageId}/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setStatus(response.data.data);
    } catch (error) {
      console.error("Error loading message status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!status || currentUserId !== senderId) {
    return null;
  }

  // Determine overall status indicator
  const getStatusIcon = () => {
    if (!status.delivered_to || status.delivered_to.length === 0) {
      return <Clock className="w-3 h-3 text-gray-400" title="Sent" />;
    }

    if (status.read_by && status.read_by.length > 0) {
      return <CheckCheck className="w-3 h-3 text-blue-500" title="Read" />;
    }

    return <Check className="w-3 h-3 text-gray-400" title="Delivered" />;
  };

  const handleStatusClick = () => {
    setShowTooltip(!showTooltip);
  };

  return (
    <div className="relative inline-block ml-2">
      <button
        onClick={handleStatusClick}
        className="inline-flex items-center opacity-70 hover:opacity-100 transition-opacity"
        title="View message status"
      >
        {getStatusIcon()}
      </button>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg p-3 text-xs min-w-max z-50"
        >
          {/* Delivered Status */}
          <div className="mb-3 pb-3 border-b border-zinc-700">
            <p className="font-semibold text-zinc-300 mb-2 flex items-center">
              <Check className="w-3 h-3 mr-2" />
              Delivered ({status.delivered_count || 0})
            </p>
            {status.delivered_to && status.delivered_to.length > 0 ? (
              <div className="space-y-1 text-zinc-400">
                {status.delivered_to.map((user) => (
                  <div key={user.user_id} className="flex justify-between items-center gap-2">
                    <span>{user.name}</span>
                    <span className="text-xs opacity-75">
                      {new Date(user.delivered_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 italic">No one has received this yet</p>
            )}
          </div>

          {/* Read Status */}
          <div>
            <p className="font-semibold text-zinc-300 mb-2 flex items-center">
              <CheckCheck className="w-3 h-3 mr-2" />
              Read ({status.read_count || 0})
            </p>
            {status.read_by && status.read_by.length > 0 ? (
              <div className="space-y-1 text-zinc-400">
                {status.read_by.map((user) => (
                  <div key={user.user_id} className="flex justify-between items-center gap-2">
                    <span>{user.name}</span>
                    <span className="text-xs opacity-75">
                      {new Date(user.read_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 italic">No one has read this yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageStatusIndicators;
