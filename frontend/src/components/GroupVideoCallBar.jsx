import React, { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, Grid3x3, Grid2x2 } from "lucide-react";

const GroupVideoCallBar = ({
  channelName,
  participants,
  localStream,
  remoteStreams,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onHangUp,
  currentUserId,
  isConnecting,
}) => {
  const currentUserIdStr = currentUserId != null ? String(currentUserId) : null;
  const videoRefs = useRef({});
  const localVideoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [gridColumns, setGridColumns] = useState(2); // 1, 2, or 3 columns
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [windowPosition, setWindowPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const draggableRef = useRef(null);

  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 300;
  const MAX_WIDTH = window.innerWidth * 0.95;
  const MAX_HEIGHT = window.innerHeight * 0.95;

  // Attach video streams
  useEffect(() => {
    // Attach local video
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => {
        console.error("Error playing local video:", err);
      });
    }

    // Attach remote videos
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const videoEl = videoRefs.current[userId];
      if (videoEl && stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch((err) => {
          console.error(`Error playing remote video for ${userId}:`, err);
        });
      }
    });

    return () => {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = null;
      }
      Object.values(videoRefs.current).forEach((el) => {
        if (el && el.srcObject) {
          el.srcObject = null;
        }
      });
    };
  }, [localStream, remoteStreams]);

  // Re-attach streams when mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
      Object.entries(remoteStreams).forEach(([userId, stream]) => {
        const videoEl = videoRefs.current[userId];
        if (videoEl && stream) {
          videoEl.srcObject = stream;
          videoEl.play().catch(() => {});
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullScreen, localStream, remoteStreams]);

  // Calculate grid layout
  const allParticipants = participants || [];
  const totalVideos = allParticipants.length;
  const gridCols = Math.min(gridColumns, totalVideos || 1);
  const gridRows = Math.ceil(totalVideos / gridCols);

  const handleMouseDown = (e) => {
    if (!isFullScreen && e.target.closest('.draggable-header') && !e.target.closest('.resize-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - windowPosition.x,
        y: e.clientY - windowPosition.y,
      });
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (e) => {
    if (isResizing && !isFullScreen) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = resizeStart.left;
      let newY = resizeStart.top;

      if (resizeDirection.includes('right')) {
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.width + deltaX));
      }
      if (resizeDirection.includes('left')) {
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.width - deltaX));
        newX = resizeStart.left + (resizeStart.width - newWidth);
      }
      if (resizeDirection.includes('bottom')) {
        newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.height + deltaY));
      }
      if (resizeDirection.includes('top')) {
        newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStart.height - deltaY));
        newY = resizeStart.top + (resizeStart.height - newHeight);
      }

      if (newX + newWidth > window.innerWidth) {
        newWidth = window.innerWidth - newX;
      }
      if (newY + newHeight > window.innerHeight) {
        newHeight = window.innerHeight - newY;
      }
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
        if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
      }
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
      }

      setWindowSize({ width: newWidth, height: newHeight });
      setWindowPosition({ x: newX, y: newY });
    } else if (isDragging && !isFullScreen) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const maxX = window.innerWidth - windowSize.width;
      const maxY = window.innerHeight - windowSize.height;
      setWindowPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection(null);
  };

  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowSize.width,
      height: windowSize.height,
      left: windowPosition.x,
      top: windowPosition.y,
    });
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeDirection, windowSize]);

  const toggleFullScreen = async () => {
    if (!isFullScreen) {
      setIsFullScreen(true);
      setTimeout(async () => {
        const elementToFullscreen = containerRef.current;
        if (elementToFullscreen) {
          try {
            if (elementToFullscreen.requestFullscreen) {
              await elementToFullscreen.requestFullscreen();
            } else if (elementToFullscreen.webkitRequestFullscreen) {
              await elementToFullscreen.webkitRequestFullscreen();
            } else if (elementToFullscreen.msRequestFullscreen) {
              await elementToFullscreen.msRequestFullscreen();
            } else if (elementToFullscreen.mozRequestFullScreen) {
              await elementToFullscreen.mozRequestFullScreen();
            }
          } catch (err) {
            console.error("Error entering fullscreen:", err);
            setIsFullScreen(false);
          }
        }
      }, 50);
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        }
      } catch (err) {
        console.error("Error exiting fullscreen:", err);
        setIsFullScreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullScreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const renderVideoGrid = () => {
    return (
      <div
        className="w-full h-full grid gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        }}
      >
        {/* Local video */}
        {localStream && (
          <div className="relative bg-zinc-900 rounded-lg overflow-hidden border-2 border-zinc-700">
            <video
              ref={localVideoRef}
              key="local-group"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-zinc-600" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium">
              You {isMuted && <MicOff className="w-3 h-3 inline ml-1" />}
            </div>
          </div>
        )}

        {/* Remote videos */}
        {allParticipants
          .filter((p) => p.id !== currentUserIdStr)
          .map((participant) => {
            const stream = remoteStreams[participant.id];
            return (
              <div
                key={participant.id}
                className="relative bg-zinc-900 rounded-lg overflow-hidden border-2 border-zinc-700"
              >
                {stream ? (
                  <video
                    ref={(r) => {
                      videoRefs.current[participant.id] = r;
                    }}
                    key={`remote-${participant.id}`}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-2">
                        <span className="text-indigo-400 font-semibold text-2xl">
                          {participant.name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium">{participant.name || "User"}</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium">
                  {participant.name || "User"}
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  // Fullscreen mode
  if (isFullScreen) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black z-[100] flex flex-col">
        <div className="flex-1 relative">{renderVideoGrid()}</div>

        {/* Controls Bar */}
        <div className="bg-zinc-900/98 border-t border-zinc-700/50 px-6 py-5 z-50 relative">
          <div className="flex items-center justify-center gap-4">
            {/* Grid size controls */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setGridColumns(1)}
                className={`p-2 rounded transition-colors ${
                  gridColumns === 1 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
                title="1 column"
              >
                <Grid2x2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridColumns(2)}
                className={`p-2 rounded transition-colors ${
                  gridColumns === 2 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
                title="2 columns"
              >
                <Grid2x2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridColumns(3)}
                className={`p-2 rounded transition-colors ${
                  gridColumns === 3 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
                title="3 columns"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onToggleMute}
              className={`p-4 rounded-full transition-all shadow-lg ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-full transition-all shadow-lg ${
                isVideoOff
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleFullScreen}
              className="p-4 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all shadow-lg"
              title="Exit fullscreen"
            >
              <Minimize2 className="w-6 h-6" />
            </button>

            <button
              onClick={onHangUp}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg"
              title="End call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Draggable window mode
  return (
    <>
      <div
        ref={draggableRef}
        className={`fixed bg-zinc-900 rounded-lg border-2 border-zinc-700 shadow-2xl overflow-hidden z-[100] ${
          isDragging ? "cursor-move" : "cursor-default"
        }`}
        style={{
          left: `${windowPosition.x}px`,
          top: `${windowPosition.y}px`,
          width: `${windowSize.width}px`,
          height: `${windowSize.height}px`,
        }}
      >
        {/* Resize Handles */}
        <div
          className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "top")}
        />
        <div
          className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "bottom")}
        />
        <div
          className="resize-handle absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "left")}
        />
        <div
          className="resize-handle absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "right")}
        />
        <div
          className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "top-left")}
        />
        <div
          className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "top-right")}
        />
        <div
          className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "bottom-left")}
        />
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, "bottom-right")}
        />

        {/* Window Header */}
        <div
          className="draggable-header bg-zinc-800 px-3 py-2 flex items-center justify-between border-b border-zinc-700 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-zinc-300 font-medium">{channelName || "Group Video Call"}</span>
            <span className="text-xs text-zinc-500">({totalVideos} participants)</span>
          </div>
          <button
            onClick={toggleFullScreen}
            className="p-1 hover:bg-zinc-700 rounded transition-colors"
            title="Enter fullscreen"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Maximize2 className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Video Grid */}
        <div className="relative w-full h-[calc(100%-7rem)] bg-zinc-900">{renderVideoGrid()}</div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 px-3 py-2 flex items-center justify-center gap-2 border-t border-zinc-700">
          {/* Grid size controls */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setGridColumns(1)}
              className={`p-1.5 rounded transition-colors ${
                gridColumns === 1 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
              }`}
              title="1 column"
            >
              <Grid2x2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setGridColumns(2)}
              className={`p-1.5 rounded transition-colors ${
                gridColumns === 2 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
              }`}
              title="2 columns"
            >
              <Grid2x2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setGridColumns(3)}
              className={`p-1.5 rounded transition-colors ${
                gridColumns === 3 ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"
              }`}
              title="3 columns"
            >
              <Grid3x3 className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleVideo}
            className={`p-2 rounded-lg transition-colors ${
              isVideoOff
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
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
    </>
  );
};

export default GroupVideoCallBar;
