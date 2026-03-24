import React, { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import { X } from "lucide-react";

const ReactionAnalyticsModal = ({ messageId, channelId, isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && messageId) {
      loadAnalytics();
    }
  }, [isOpen, messageId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${BACKEND_URL}/chat/messages/${messageId}/reactions/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAnalytics(response.data.data);
    } catch (error) {
      console.error("Error loading reaction analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">{analytics?.top_emoji || "😊"}</span>
            Reaction Analytics
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-400">Loading analytics...</p>
            </div>
          ) : analytics && analytics.total_reactions > 0 ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-zinc-800 rounded-lg">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Total Reactions</p>
                  <p className="text-2xl font-bold text-white">
                    {analytics.total_reactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Unique Emojis</p>
                  <p className="text-2xl font-bold text-white">
                    {analytics.reaction_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Reaction Speed</p>
                  <p className="text-2xl font-bold text-white">
                    {analytics.reaction_speed_ms
                      ? `${Math.round(analytics.reaction_speed_ms / 1000)}s`
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Emoji Reactions */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                  Reactions Breakdown
                </h3>
                <div className="space-y-2">
                  {Object.entries(analytics.reactions).map(
                    ([emoji, reactionData]) => (
                      <div key={emoji} className="bg-zinc-800 rounded-lg p-3">
                        {/* Emoji header with count */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{emoji}</span>
                            <span className="text-sm font-medium text-zinc-300">
                              {reactionData.count} {reactionData.count === 1 ? "reaction" : "reactions"}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            {((reactionData.count / analytics.total_reactions) * 100).toFixed(
                              0
                            )}
                            %
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-zinc-700 rounded-full h-2 mb-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all"
                            style={{
                              width: `${(reactionData.count / analytics.total_reactions) * 100}%`,
                            }}
                          />
                        </div>

                        {/* User list */}
                        <div className="text-xs text-zinc-400 space-y-1">
                          {reactionData.users.map((user, idx) => (
                            <div key={idx} className="flex items-center justify-between pl-2">
                              <span>{user.name || user.email}</span>
                              {reactionData.recent[idx] && (
                                <span className="opacity-75">
                                  {new Date(
                                    reactionData.recent[idx].reacted_at
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-400">No reactions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReactionAnalyticsModal;
