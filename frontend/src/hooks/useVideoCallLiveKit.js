import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { requestMediaPermissions, PermissionDeniedError } from "./useMediaPermissions";

function extractErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export function useVideoCallLiveKit(
  socket,
  currentUserId,
  currentUserName,
  requestCallApi,
  getLiveKitTokenApi,
  enabled = true
) {
  const [callState, setCallState] = useState("idle");
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const roomRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const isCallerRef = useRef(false);
  const callingTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setRemoteUser(null);
    setErrorMessage(null);
    setIsMuted(false);
    setIsVideoOff(false);
    isCallerRef.current = false;
  }, []);

  const attachRoomHandlers = useCallback((room) => {
    const ensureRemoteStream = () => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      return remoteStreamRef.current;
    };

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      setRemoteUser({
        id: participant.identity,
        name: participant.name || "User",
      });
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      const stream = ensureRemoteStream();
      stream.addTrack(track.mediaStreamTrack);
      setRemoteStream(new MediaStream(stream.getTracks()));
      setRemoteUser({
        id: participant.identity,
        name: participant.name || "User",
      });
      setCallState("active");
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (!remoteStreamRef.current) return;
      remoteStreamRef.current.getTracks().forEach((t) => {
        if (t.id === track.mediaStreamTrack.id) {
          remoteStreamRef.current.removeTrack(t);
        }
      });
      const remainingTracks = remoteStreamRef.current.getTracks();
      setRemoteStream(remainingTracks.length ? new MediaStream(remainingTracks) : null);
    });

    room.on(RoomEvent.Disconnected, () => {
      cleanup();
    });
  }, [cleanup]);

  const connectToLiveKit = useCallback(async (toUserId) => {
    if (!getLiveKitTokenApi) {
      throw new Error("LiveKit token API not configured");
    }

    // Prevent duplicate participant/room state between retries.
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setLocalStream(null);

    const tokenPayload = await getLiveKitTokenApi(toUserId, "video");
    const stream = await requestMediaPermissions({ audio: true, video: true });

    localStreamRef.current = stream;
    setLocalStream(stream);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    attachRoomHandlers(room);

    await room.connect(tokenPayload.url, tokenPayload.token);

    for (const track of stream.getTracks()) {
      await room.localParticipant.publishTrack(track);
    }
  }, [attachRoomHandlers, getLiveKitTokenApi]);

  const endCall = useCallback(() => {
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (remoteId && socket?.connected) {
      socket.emit("video-call-end", { toUserId: remoteId });
    }
    cleanup();
  }, [cleanup, remoteUser?.id, socket]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  }, [isVideoOff]);

  const startCall = useCallback(
    async (remoteUserId, remoteUserName) => {
      if (!enabled) return;
      const toId = remoteUserId != null ? String(remoteUserId) : remoteUserId;
      if (!currentUserId || !toId) return;
      if (!requestCallApi) {
        setErrorMessage("Call not configured");
        return;
      }

      try {
        const stream = await requestMediaPermissions({ audio: true, video: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Camera/microphone access denied");
        return;
      }

      if (callingTimeoutRef.current) {
        clearTimeout(callingTimeoutRef.current);
      }

      setRemoteUser({ id: toId, name: remoteUserName || "User" });
      setCallState("calling");
      setErrorMessage(null);
      isCallerRef.current = true;

      try {
        await requestCallApi(toId);
      } catch (err) {
        isCallerRef.current = false;
        setCallState("idle");
        setRemoteUser(null);
        setErrorMessage(err.response?.data?.message || err.response?.data?.error || "User unavailable");
        return;
      }

      callingTimeoutRef.current = setTimeout(() => {
        if (isCallerRef.current) {
          setErrorMessage("No answer");
          endCall();
        }
        callingTimeoutRef.current = null;
      }, 45000);
    },
    [currentUserId, enabled, endCall, requestCallApi]
  );

  const rejectCall = useCallback(() => {
    if (!enabled) return;
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    if (remoteId && socket?.connected) {
      socket.emit("video-call-reject", { toUserId: remoteId });
    }
    setCallState("idle");
    setRemoteUser(null);
  }, [enabled, remoteUser?.id, socket]);

  const acceptCall = useCallback(async () => {
    if (!enabled) return;
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    if (!remoteId || !socket?.connected || !currentUserId) {
      return;
    }

    setCallState("connecting");
    setErrorMessage(null);

    try {
      socket.emit("video-call-accept", { toUserId: remoteId });
      await connectToLiveKit(remoteId);
      setCallState("active");
    } catch (err) {
      setErrorMessage(
        err instanceof PermissionDeniedError
          ? err.message
          : extractErrorMessage(err, "Failed to set up video connection")
      );
      setCallState("incoming");
    }
  }, [connectToLiveKit, currentUserId, enabled, remoteUser?.id, socket]);

  useEffect(() => {
    if (!enabled || !socket || !currentUserId) return;

    const handleIncomingCall = (data) => {
      const fromId = data.fromUserId?.toString?.() ?? data.fromUserId;
      if (callState !== "idle") return;
      setRemoteUser({ id: fromId, name: data.fromUserName || "Someone" });
      setCallState("incoming");
    };

    const handleCallAccepted = async (data) => {
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      if (fromIdStr !== remoteIdStr || !isCallerRef.current) {
        return;
      }

      if (callingTimeoutRef.current) {
        clearTimeout(callingTimeoutRef.current);
        callingTimeoutRef.current = null;
      }

      setCallState("connecting");

      try {
        await connectToLiveKit(fromIdStr);
        setCallState("active");
      } catch (err) {
        setErrorMessage(
          err instanceof PermissionDeniedError
            ? err.message
            : extractErrorMessage(err, "Failed to start video")
        );
        endCall();
      }
    };

    const handleCallRejected = (data) => {
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      if (fromIdStr === remoteIdStr) {
        if (callingTimeoutRef.current) {
          clearTimeout(callingTimeoutRef.current);
          callingTimeoutRef.current = null;
        }
        setCallState("idle");
        setRemoteUser(null);
        setErrorMessage("Call declined");
      }
    };

    const handleCallEnded = (data) => {
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      if (fromIdStr === remoteIdStr) {
        cleanup();
      }
    };

    socket.on("incoming-video-call", handleIncomingCall);
    socket.on("video-call-accepted", handleCallAccepted);
    socket.on("video-call-rejected", handleCallRejected);
    socket.on("video-call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-video-call", handleIncomingCall);
      socket.off("video-call-accepted", handleCallAccepted);
      socket.off("video-call-rejected", handleCallRejected);
      socket.off("video-call-ended", handleCallEnded);
    };
  }, [
    enabled,
    socket,
    currentUserId,
    remoteUser?.id,
    callState,
    cleanup,
    connectToLiveKit,
    endCall,
  ]);

  return {
    callState,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    errorMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    cleanup,
  };
}
