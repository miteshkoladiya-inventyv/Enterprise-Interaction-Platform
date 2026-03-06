import React from "react";
import { Loader2, X } from "lucide-react";

const GroupCallWaitingModal = ({ channelName, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl shadow-black/30 p-5 max-w-xs w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Starting group call</h3>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-white mb-0.5">{channelName || "Group"}</p>
          <p className="text-xs text-zinc-500">Waiting for others to join...</p>
        </div>
        <button
          onClick={onCancel}
          className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default GroupCallWaitingModal;
