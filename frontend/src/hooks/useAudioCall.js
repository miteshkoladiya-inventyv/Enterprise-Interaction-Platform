import { useState, useRef, useEffect, useCallback } from "react";
import { requestMediaPermissions, PermissionDeniedError } from "./useMediaPermissions";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * @param {object} socket - Socket.IO client (same as chat)
 * @param {string} currentUserId - Current user id
 * @param {string} currentUserName - Current user display name
 * @param { (toUserId: string) => Promise<void> } requestCallApi - HTTP request to trigger incoming call on server (same mechanism as chat: server emits to target socket)
 */
export function useAudioCall(socket, currentUserId, currentUserName, requestCallApi) {
  const [callState, setCallState] = useState("idle"); // idle | calling | incoming | connecting | active | ended
  const [remoteUser, setRemoteUser] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const isCallerRef = useRef(false);
  const callingTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setRemoteUser(null);
    setErrorMessage(null);
    isCallerRef.current = false;
  }, []);

  const endCall = useCallback(() => {
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    console.log("[AUDIO_CALL] endCall: hanging up", { toUserId: remoteId });
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (remoteId && socket?.connected) {
      socket.emit("audio-call-end", { toUserId: remoteId });
    }
    cleanup();
  }, [remoteUser?.id, socket, cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const startCall = useCallback(
    async (remoteUserId, remoteUserName) => {
      const toId = remoteUserId != null ? String(remoteUserId) : remoteUserId;
      console.log("[AUDIO_CALL] startCall: sending call request via HTTP (same as chat)", { currentUserId, toUserId: toId, remoteUserName });
      if (!currentUserId || !toId) {
        console.log("[AUDIO_CALL] startCall: abort - missing currentUserId or toUserId");
        return;
      }
      if (!requestCallApi) {
        console.error("[AUDIO_CALL] startCall: requestCallApi not provided");
        setErrorMessage("Call not configured");
        return;
      }

      // Request microphone permission BEFORE initiating the call
      try {
        const stream = await requestMediaPermissions({ audio: true });
        // Stop the stream immediately — we only needed it to secure permission.
        // The actual stream will be created when the callee accepts.
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.error("[AUDIO_CALL] startCall: microphone permission denied", err);
        setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Microphone access denied");
        return;
      }

      if (callingTimeoutRef.current) {
        clearTimeout(callingTimeoutRef.current);
        callingTimeoutRef.current = null;
      }
      setRemoteUser({ id: toId, name: remoteUserName || "User" });
      setCallState("calling");
      setErrorMessage(null);
      isCallerRef.current = true;

      try {
        await requestCallApi(toId);
        console.log("[AUDIO_CALL] startCall: server accepted, waiting for answer");
      } catch (err) {
        console.error("[AUDIO_CALL] startCall: request failed", err);
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
    [currentUserId, endCall, requestCallApi]
  );

  const rejectCall = useCallback(() => {
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    console.log("[AUDIO_CALL] rejectCall: declining", { toUserId: remoteId });
    if (remoteId && socket?.connected) {
      socket.emit("audio-call-reject", { toUserId: remoteId });
    }
    setCallState("idle");
    setRemoteUser(null);
  }, [remoteUser?.id, socket]);

  const acceptCall = useCallback(async () => {
    const remoteId = remoteUser?.id?.toString?.() ?? remoteUser?.id;
    console.log("[AUDIO_CALL] acceptCall: callee accepting", { remoteUserId: remoteId, socketConnected: !!socket?.connected });
    if (!remoteId || !socket?.connected || !currentUserId) {
      console.log("[AUDIO_CALL] acceptCall: abort - missing remoteId/socket/currentUserId");
      return;
    }

    // Request microphone permission FIRST, before changing state
    let stream;
    try {
      console.log("[AUDIO_CALL] acceptCall: requesting microphone permission");
      stream = await requestMediaPermissions({ audio: true });
    } catch (err) {
      console.error("[AUDIO_CALL] acceptCall: microphone permission denied", err);
      setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Microphone access denied");
      // Stay on "incoming" so user can retry or decline
      setCallState("incoming");
      return;
    }

    setCallState("connecting");
    setErrorMessage(null);

    try {
      localStreamRef.current = stream;
      setLocalStream(stream);

      console.log("[AUDIO_CALL] acceptCall: creating RTCPeerConnection (callee), waiting for offer");
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        console.log("[AUDIO_CALL] callee ontrack - remote stream received");
        if (e.streams?.[0]) {
          setRemoteStream(e.streams[0]);
          setCallState("active");
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && socket?.connected) {
          console.log("[AUDIO_CALL] callee sending ICE candidate to", remoteId);
          socket.emit("webrtc-ice", {
            toUserId: remoteId,
            candidate: e.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[AUDIO_CALL] callee connectionState:", pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErrorMessage("Connection lost");
        }
        if (pc.connectionState === "closed") {
          cleanup();
        }
      };

      console.log("[AUDIO_CALL] acceptCall: emitting audio-call-accept to", remoteId);
      socket.emit("audio-call-accept", { toUserId: remoteId });
    } catch (err) {
      console.error("[AUDIO_CALL] acceptCall error:", err);
      setErrorMessage("Failed to set up audio connection");
      setCallState("incoming");
    }
  }, [remoteUser?.id, socket, currentUserId, endCall, cleanup]);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleIncomingCall = (data) => {
      const { fromUserId, fromUserName } = data;
      const fromId = fromUserId?.toString?.() ?? fromUserId;
      console.log("[AUDIO_CALL] received incoming-audio-call", { fromUserId: fromId, fromUserName, callState });
      if (callState !== "idle") {
        console.log("[AUDIO_CALL] incoming call ignored - not idle, callState=", callState);
        return;
      }
      setRemoteUser({ id: fromId, name: fromUserName || "Someone" });
      setCallState("incoming");
    };

    const handleCallAccepted = async (data) => {
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      console.log("[AUDIO_CALL] caller received call-accepted", { fromUserId: fromIdStr, remoteUserIds: remoteIdStr, isCaller: isCallerRef.current });
      if (fromIdStr !== remoteIdStr || !isCallerRef.current) {
        console.log("[AUDIO_CALL] call-accepted ignored - fromId !== remoteId or not caller");
        return;
      }
      if (callingTimeoutRef.current) {
        clearTimeout(callingTimeoutRef.current);
        callingTimeoutRef.current = null;
      }
      setCallState("connecting");

      try {
        console.log("[AUDIO_CALL] caller: requesting microphone permission");
        const stream = await requestMediaPermissions({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);

        console.log("[AUDIO_CALL] caller: creating RTCPeerConnection and creating offer");
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          console.log("[AUDIO_CALL] caller ontrack - remote stream received");
          if (e.streams?.[0]) {
            setRemoteStream(e.streams[0]);
            setCallState("active");
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && socket?.connected) {
            console.log("[AUDIO_CALL] caller sending ICE candidate to", fromIdStr);
            socket.emit("webrtc-ice", {
              toUserId: fromIdStr,
              candidate: e.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[AUDIO_CALL] caller connectionState:", pc.connectionState);
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setErrorMessage("Connection lost");
          }
          if (pc.connectionState === "closed") {
            cleanup();
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[AUDIO_CALL] caller: sending webrtc-offer to", fromIdStr);
        socket.emit("webrtc-offer", {
          toUserId: fromIdStr,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error("[AUDIO_CALL] caller handleCallAccepted error:", err);
        setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Failed to start audio");
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

    const handleWebrtcOffer = async (data) => {
      const pc = peerConnectionRef.current;
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      console.log("[AUDIO_CALL] callee received webrtc-offer", { fromUserId: fromIdStr, remoteUserId: remoteIdStr, hasPc: !!pc });
      if (!pc || fromIdStr !== remoteIdStr) {
        console.log("[AUDIO_CALL] webrtc-offer ignored - no pc or fromId !== remoteId");
        return;
      }
      try {
        console.log("[AUDIO_CALL] callee: setRemoteDescription(offer), createAnswer, sending answer");
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socket?.connected) {
          socket.emit("webrtc-answer", {
            toUserId: fromIdStr,
            sdp: pc.localDescription,
          });
          console.log("[AUDIO_CALL] callee: emitted webrtc-answer to", fromIdStr);
        }
      } catch (err) {
        console.error("[AUDIO_CALL] callee handleWebrtcOffer error:", err);
        setErrorMessage("Failed to connect");
        endCall();
      }
    };

    const handleWebrtcAnswer = async (data) => {
      const pc = peerConnectionRef.current;
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      console.log("[AUDIO_CALL] caller received webrtc-answer", { fromUserId: fromIdStr, remoteUserId: remoteIdStr, hasPc: !!pc });
      if (!pc || fromIdStr !== remoteIdStr) {
        console.log("[AUDIO_CALL] webrtc-answer ignored - no pc or fromId !== remoteId");
        return;
      }
      try {
        console.log("[AUDIO_CALL] caller: setRemoteDescription(answer)");
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error("[AUDIO_CALL] caller setRemoteDescription(answer) error:", err);
      }
    };

    const handleWebrtcIce = async (data) => {
      const pc = peerConnectionRef.current;
      console.log("[AUDIO_CALL] received webrtc-ice", { fromUserId: data.fromUserId, hasPc: !!pc, hasCandidate: !!data.candidate });
      if (!pc || !data.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("[AUDIO_CALL] addIceCandidate success");
      } catch (err) {
        console.error("[AUDIO_CALL] addIceCandidate error:", err);
      }
    };

    const handleCallEnded = (data) => {
      const fromIdStr = data.fromUserId?.toString?.() ?? data.fromUserId;
      const remoteIdStr = remoteUser?.id?.toString?.() ?? remoteUser?.id;
      if (fromIdStr === remoteIdStr) {
        console.log("[AUDIO_CALL] call-ended from remote, cleaning up");
        cleanup();
      }
    };

    socket.on("incoming-audio-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-rejected", handleCallRejected);
    socket.on("webrtc-offer", handleWebrtcOffer);
    socket.on("webrtc-answer", handleWebrtcAnswer);
    socket.on("webrtc-ice", handleWebrtcIce);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-audio-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-rejected", handleCallRejected);
      socket.off("webrtc-offer", handleWebrtcOffer);
      socket.off("webrtc-answer", handleWebrtcAnswer);
      socket.off("webrtc-ice", handleWebrtcIce);
      socket.off("call-ended", handleCallEnded);
    };
  }, [
    socket,
    currentUserId,
    remoteUser?.id,
    callState,
    cleanup,
    endCall,
  ]);

  return {
    callState,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    errorMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    cleanup,
  };
}
