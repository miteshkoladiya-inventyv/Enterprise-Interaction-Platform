import React from "react";
import { Phone, X } from "lucide-react";

const GroupCallIncomingBanner = ({
  channelName,
  initiatorName,
  onJoin,
  onDismiss,
}) => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
        <Phone className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {initiatorName} started a group call
        </p>
        <p className="text-xs text-zinc-500 truncate">{channelName || "Group"}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onDismiss}
          className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded-lg transition"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onJoin}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition"
        >
          <Phone className="w-3 h-3" />
          Join
        </button>
      </div>
    </div>
  );
};

export default GroupCallIncomingBanner;
