import React, { useEffect, useRef } from "react";
import { PhoneOff, Mic, MicOff, Users } from "lucide-react";

const GroupCallActiveBar = ({
  channelName,
  participants,
  remoteStreams,
  isMuted,
  onToggleMute,
  onHangUp,
  currentUserId,
}) => {
  const currentUserIdStr = currentUserId != null ? String(currentUserId) : null;
  const audioRefs = useRef({});

  const others = participants.filter((p) => p.id !== currentUserIdStr);

  useEffect(() => {
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const el = audioRefs.current[userId];
      if (el && stream) el.srcObject = stream;
    });
  }, [remoteStreams]);

  return (
    <div className="fixed bottom-4 left-1/2 -tranzinc-x-1/2 z-[90] w-full max-w-md px-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl shadow-black/30 overflow-hidden">
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <audio key={userId} ref={(r) => { audioRefs.current[userId] = r; }} autoPlay playsInline />
        ))}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-white text-sm truncate">{channelName || "Group call"}</h3>
                <p className="text-zinc-400 text-xs">
                  {others.length + 1} participant{(others.length + 1) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={onToggleMute}
                className={`p-2 rounded-lg transition-colors ${isMuted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white hover:bg-white/20"}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={onHangUp}
                className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                title="Leave call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
          {others.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {others.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-medium">
                  {p.name?.charAt(0) || "?"}
                  <span className="truncate max-w-[70px]">{p.name || "User"}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupCallActiveBar;
