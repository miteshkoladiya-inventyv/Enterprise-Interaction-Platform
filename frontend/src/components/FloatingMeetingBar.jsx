import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  GripHorizontal,
  MonitorPlay,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Draggable floating bar shown when a meeting is active but the user
 * is on a different tab. Provides quick mute / camera / leave controls.
 *
 * Props:
 *  - meetingTitle: string
 *  - isHost: boolean
 *  - isMuted: boolean
 *  - isVideoOff: boolean
 *  - onToggleMute: () => void
 *  - onToggleVideo: () => void
 *  - onLeaveMeeting: () => void   (leave for participant, end for host)
 *  - onReturnToMeeting: () => void
 *  - startedAt: string | Date | null   (shows elapsed time)
 */
export default function FloatingMeetingBar({
  meetingTitle = "Meeting",
  isHost = false,
  isMuted = false,
  isVideoOff = false,
  onToggleMute,
  onToggleVideo,
  onLeaveMeeting,
  onReturnToMeeting,
  startedAt,
}) {
  // ---- Elapsed timer ----
  const [elapsed, setElapsed] = useState("00:00");
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // ---- Dragging logic ----
  const barRef = useRef(null);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialise centred near bottom
  useEffect(() => {
    if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setPosition({
        x: Math.max(0, (window.innerWidth - rect.width) / 2),
        y: Math.max(0, window.innerHeight - rect.height - 32),
      });
    }
  }, []);

  const handlePointerDown = useCallback((e) => {
    // Only start dragging from the grip handle area
    if (!e.target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    const rect = barRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    barRef.current?.setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      // Clamp inside viewport
      const rect = barRef.current?.getBoundingClientRect();
      const w = rect?.width ?? 300;
      const h = rect?.height ?? 56;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - w, newX)),
        y: Math.max(0, Math.min(window.innerHeight - h, newY)),
      });
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Clamp on resize
  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => {
        const rect = barRef.current?.getBoundingClientRect();
        const w = rect?.width ?? 300;
        const h = rect?.height ?? 56;
        return {
          x: Math.max(0, Math.min(window.innerWidth - w, prev.x)),
          y: Math.max(0, Math.min(window.innerHeight - h, prev.y)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "fixed",
        left: position.x >= 0 ? position.x : "50%",
        top: position.y >= 0 ? position.y : undefined,
        bottom: position.y < 0 ? 32 : undefined,
        transform: position.x < 0 ? "translateX(-50%)" : undefined,
        zIndex: 9999,
        touchAction: "none",
      }}
      className={cn(
        "select-none rounded-2xl border border-zinc-700/70 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40",
        "flex items-center gap-2 px-2 py-1.5 transition-shadow",
        isDragging && "shadow-indigo-500/20 ring-1 ring-indigo-500/30"
      )}
    >
      {/* Drag handle */}
      <div
        data-drag-handle
        className="flex items-center justify-center cursor-grab active:cursor-grabbing px-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Drag to move"
      >
        <GripHorizontal className="size-4" />
      </div>

      {/* Pulse indicator + meeting info */}
      <button
        onClick={onReturnToMeeting}
        className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-zinc-800/60 transition-colors group min-w-0"
        title="Return to meeting"
      >
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs font-semibold text-zinc-100 truncate max-w-[140px] group-hover:text-indigo-300 transition-colors">
            {meetingTitle}
          </span>
          <span className="text-[10px] text-zinc-500 tabular-nums">{elapsed}</span>
        </div>
        <MonitorPlay className="size-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
      </button>

      {/* Divider */}
      <div className="w-px h-7 bg-zinc-700/60" />

      {/* Mute toggle */}
      <button
        onClick={onToggleMute}
        className={cn(
          "p-2 rounded-xl transition-all duration-150",
          isMuted
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        )}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </button>

      {/* Camera toggle */}
      <button
        onClick={onToggleVideo}
        className={cn(
          "p-2 rounded-xl transition-all duration-150",
          isVideoOff
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        )}
        title={isVideoOff ? "Turn camera on" : "Turn camera off"}
      >
        {isVideoOff ? (
          <VideoOff className="size-4" />
        ) : (
          <Video className="size-4" />
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-7 bg-zinc-700/60" />

      {/* Leave / End meeting */}
      <button
        onClick={onLeaveMeeting}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150",
          isHost
            ? "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/25"
            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
        )}
        title={isHost ? "End meeting for all" : "Leave meeting"}
      >
        <PhoneOff className="size-3.5" />
        <span className="hidden sm:inline">{isHost ? "End" : "Leave"}</span>
      </button>
    </div>
  );
}
