import React from "react";
import { Video, VideoOff, AlertTriangle } from "lucide-react";

const IncomingVideoCallModal = ({ remoteUser, onAccept, onReject, errorMessage }) => {
  if (!remoteUser) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-2xl shadow-black/40 w-full max-w-xs overflow-hidden">
        <div className="bg-zinc-800 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Video className="w-7 h-7 text-indigo-400 animate-pulse" />
          </div>
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
            Incoming video call
          </p>
          <h2 className="text-lg font-semibold text-white truncate px-2">
            {remoteUser.name}
          </h2>
        </div>
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 leading-relaxed">{errorMessage}</p>
          </div>
        )}
        <div className="p-4 flex gap-2">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
          >
            <VideoOff className="w-4 h-4" />
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition"
          >
            <Video className="w-4 h-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingVideoCallModal;
