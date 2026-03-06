import React, { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Loader2, Maximize2, Minimize2 } from "lucide-react";

const ActiveVideoCallBar = ({
  remoteUser,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onHangUp,
  isConnecting,
  errorMessage,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draggablePosition, setDraggablePosition] = useState({ x: 100, y: 100 });
  const [draggableSize, setDraggableSize] = useState({ width: 480, height: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const draggableRef = useRef(null);
  
  const MIN_WIDTH = 320;
  const MIN_HEIGHT = 240;
  const MAX_WIDTH = window.innerWidth * 0.9;
  const MAX_HEIGHT = window.innerHeight * 0.9;

  // Ensure video streams are properly attached
  const attachVideoStream = (videoRef, stream, isLocal = false) => {
    if (!videoRef.current || !stream) return;
    
    const videoElement = videoRef.current;
    
    // Always update srcObject to ensure stream is connected
    // This handles cases where video element is recreated (e.g., mode change)
    if (videoElement.srcObject !== stream) {
      // Stop previous stream tracks if any
      if (videoElement.srcObject) {
        const oldStream = videoElement.srcObject;
        oldStream.getTracks().forEach(track => track.stop());
      }
      
      videoElement.srcObject = stream;
      
      // Ensure video plays
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error(`Error playing ${isLocal ? 'local' : 'remote'} video:`, err);
        });
      }
    } else {
      // Even if srcObject is the same, ensure video is playing
      if (videoElement.paused) {
        videoElement.play().catch((err) => {
          console.error(`Error resuming ${isLocal ? 'local' : 'remote'} video:`, err);
        });
      }
    }
  };

  // Attach local video stream
  useEffect(() => {
    if (localStream) {
      attachVideoStream(localVideoRef, localStream, true);
    }
  }, [localStream]);

  // Attach remote video stream
  useEffect(() => {
    if (remoteStream) {
      attachVideoStream(remoteVideoRef, remoteStream, false);
    }
  }, [remoteStream]);

  // Re-attach video streams when mode changes or component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localStream) {
        attachVideoStream(localVideoRef, localStream, true);
      }
      if (remoteStream) {
        attachVideoStream(remoteVideoRef, remoteStream, false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullScreen, localStream, remoteStream]);

  const handleMouseDown = (e) => {
    if (!isFullScreen && e.target.closest('.draggable-header') && !e.target.closest('.resize-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - draggablePosition.x,
        y: e.clientY - draggablePosition.y,
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
      
      // Handle resize based on direction
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
      
      // Keep window within viewport bounds
      if (newX + newWidth > window.innerWidth) {
        newWidth = window.innerWidth - newX;
      }
      if (newY + newHeight > window.innerHeight) {
        newHeight = window.innerHeight - newY;
      }
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
      }
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
      }
      
      setDraggableSize({ width: newWidth, height: newHeight });
      setDraggablePosition({ x: newX, y: newY });
    } else if (isDragging && !isFullScreen) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep window within viewport bounds
      const maxX = window.innerWidth - draggableSize.width;
      const maxY = window.innerHeight - draggableSize.height;
      
      setDraggablePosition({
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
      width: draggableSize.width,
      height: draggableSize.height,
      left: draggablePosition.x,
      top: draggablePosition.y,
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
  }, [isDragging, isResizing, dragStart, resizeStart, resizeDirection, draggableSize]);

  const toggleFullScreen = async () => {
    if (!isFullScreen) {
      // Enter browser fullscreen
      // Set state first so React renders the fullscreen container
      setIsFullScreen(true);
      
      // Then request fullscreen after a brief delay to ensure DOM is updated
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
      // Exit browser fullscreen
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
        // State will be updated by the fullscreenchange event handler
      } catch (err) {
        console.error("Error exiting fullscreen:", err);
        setIsFullScreen(false);
      }
    }
  };

  // Listen for fullscreen changes
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

  if (!remoteUser) return null;

  // Full Screen Mode (Browser Fullscreen)
  if (isFullScreen) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black z-[100] flex flex-col">
        {/* Remote Video - Full Screen */}
        <div className="flex-1 relative bg-zinc-900">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              key="remote-fullscreen"
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              {isConnecting ? (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                  <p className="text-zinc-400 text-sm">Connecting...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-indigo-400 font-semibold text-3xl">
                      {remoteUser.name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <p className="text-white text-lg font-medium">{remoteUser.name}</p>
                  <p className="text-zinc-400 text-sm mt-1">Waiting for video...</p>
                </div>
              )}
            </div>
          )}

          {/* Local Video - Picture-in-Picture */}
          {localStream && (
            <div className="absolute top-4 right-4 w-64 h-48 rounded-lg overflow-hidden border-2 border-zinc-700 bg-zinc-900 shadow-xl">
              <video
                ref={localVideoRef}
                key="local-fullscreen"
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
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="absolute top-4 left-4 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg">
              {errorMessage}
            </div>
          )}

          {/* Mode Toggle Button */}
          <button
            onClick={toggleFullScreen}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm z-10"
            title="Exit fullscreen"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar - Always Visible */}
        <div className="bg-zinc-900/98 border-t border-zinc-700/50 px-6 py-5 z-50 relative">
          <div className="flex items-center justify-center gap-4">
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

  // Draggable Mode - No overlay blocking other activities
  return (
    <>
      {/* Draggable Remote Video Window - Floating above other content */}
      <div
        ref={draggableRef}
        className={`fixed bg-zinc-900 rounded-lg border-2 border-zinc-700 shadow-2xl overflow-hidden z-[100] ${
          isDragging ? "cursor-move" : "cursor-default"
        }`}
        style={{
          left: `${draggablePosition.x}px`,
          top: `${draggablePosition.y}px`,
          width: `${draggableSize.width}px`,
          height: `${draggableSize.height}px`,
        }}
      >
        {/* Resize Handles */}
        {/* Top Edge */}
        <div
          className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />
        {/* Bottom Edge */}
        <div
          className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        {/* Left Edge */}
        <div
          className="resize-handle absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
        {/* Right Edge */}
        <div
          className="resize-handle absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-zinc-500/30 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        {/* Top-Left Corner */}
        <div
          className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        />
        {/* Top-Right Corner */}
        <div
          className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        />
        {/* Bottom-Left Corner */}
        <div
          className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        />
        {/* Bottom-Right Corner */}
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-zinc-500/40 transition-colors z-20"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        />
        {/* Window Header - Draggable */}
        <div
          className="draggable-header bg-zinc-800 px-3 py-2 flex items-center justify-between border-b border-zinc-700 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-zinc-300 font-medium">
              {remoteUser.name || "Video Call"}
            </span>
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

        {/* Remote Video */}
        <div className="relative w-full h-[calc(100%-7rem)] bg-zinc-900">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              key="remote-draggable"
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isConnecting ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                  <p className="text-zinc-400 text-xs">Connecting...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-indigo-400 font-semibold text-xl">
                      {remoteUser.name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium">{remoteUser.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Local Video Overlay */}
          {localStream && (
            <div className="absolute bottom-2 right-2 w-32 h-24 rounded-lg overflow-hidden border-2 border-zinc-700 bg-zinc-900 shadow-lg">
              <video
                ref={localVideoRef}
                key="local-draggable"
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                  <VideoOff className="w-4 h-4 text-zinc-600" />
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="absolute top-2 left-2 px-3 py-1.5 bg-red-500/90 text-white text-xs rounded-lg shadow-lg">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Controls Bar - Always Visible */}
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 px-3 py-2 flex items-center justify-center gap-2 border-t border-zinc-700">
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

export default ActiveVideoCallBar;
