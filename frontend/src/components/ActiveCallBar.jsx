import React, { useEffect, useRef } from "react";
import { PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";

const ActiveCallBar = ({
  remoteUser,
  remoteStream,
  isMuted,
  onToggleMute,
  onHangUp,
  isConnecting,
  errorMessage,
}) => {
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!remoteUser) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -tranzinc-x-1/2 z-[90] w-full max-w-sm px-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl shadow-black/30 overflow-hidden">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center">
              {isConnecting ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : (
                <span className="text-indigo-400 font-semibold text-sm">
                  {remoteUser.name?.charAt(0) || "?"}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-medium text-white text-sm truncate max-w-[160px]">
                {remoteUser.name}
              </h3>
              <p className="text-zinc-400 text-xs">
                {isConnecting ? "Connecting..." : "In call"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
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
              title="End call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
        {errorMessage && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-400 text-xs">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveCallBar;
