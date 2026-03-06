import React from "react";
import { VideoOff, Loader2 } from "lucide-react";

const OutgoingVideoCallModal = ({ remoteUser, onHangUp }) => {
  if (!remoteUser) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-2xl shadow-black/40 w-full max-w-xs overflow-hidden">
        <div className="bg-zinc-800 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
          </div>
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
            Calling
          </p>
          <h2 className="text-lg font-semibold text-white truncate px-2">
            {remoteUser.name}
          </h2>
          <p className="text-zinc-500 text-xs mt-1">Waiting for response...</p>
        </div>
        <div className="p-4">
          <button
            onClick={onHangUp}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
          >
            <VideoOff className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutgoingVideoCallModal;
