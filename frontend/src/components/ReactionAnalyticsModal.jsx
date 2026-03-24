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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <h2 className="text-base font-semibold text-white">
            Reaction Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[28rem] space-y-4 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : analytics && analytics.total_reactions > 0 ? (
            <>
              <div className="flex items-center gap-4 rounded-lg bg-zinc-800 px-4 py-3">
                <div>
                  <p className="text-xs text-zinc-500">Total Reactions</p>
                  <p className="text-xl font-semibold text-white">
                    {analytics.total_reactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Emoji Types</p>
                  <p className="text-xl font-semibold text-white">
                    {analytics.reaction_count}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(analytics.reactions).map(
                  ([emoji, reactionData]) => (
                    <div
                      key={emoji}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/70 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{emoji}</span>
                          <span className="text-sm font-medium text-white">
                            {reactionData.count}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {reactionData.users.map((user, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-zinc-300">
                              {user.name || user.email}
                            </span>
                            {reactionData.recent[idx] && (
                              <span className="text-xs text-zinc-500">
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
            </>
          ) : (
            <p className="text-sm text-zinc-400">No reactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReactionAnalyticsModal;
