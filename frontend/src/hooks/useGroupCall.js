import { useState, useRef, useEffect, useCallback } from "react";
import { requestMediaPermissions, PermissionDeniedError } from "./useMediaPermissions";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Group audio call hook. Uses same socket as chat. Mesh WebRTC: each participant
 * has a peer connection to every other participant.
 * @param {object} socket - Socket.IO client
 * @param {string} currentUserId - Current user id
 * @param {string} currentUserName - Current user display name
 * @param { (channelId: string) => Promise<any> } startGroupCallApi - POST group/start
 * @param { (channelId: string) => Promise<any> } getGroupCallStatusApi - GET group/status/:channelId
 * @param { (channelId: string) => Promise<any> } joinGroupCallApi - POST group/join
 * @param { (channelId: string) => Promise<any> } leaveGroupCallApi - POST group/leave
 */
export function useGroupCall(
  socket,
  currentUserId,
  currentUserName,
  startGroupCallApi,
  getGroupCallStatusApi,
  joinGroupCallApi,
  leaveGroupCallApi
) {
  const [groupCallState, setGroupCallState] = useState("idle"); // idle | waiting | active | incoming | joined
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeChannelName, setActiveChannelName] = useState(null);
  const [initiatorId, setInitiatorId] = useState(null);
  const [initiatorName, setInitiatorName] = useState(null);
  const [participants, setParticipants] = useState([]); // [{ id, name }]
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [userId]: MediaStream }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // { [userId]: RTCPeerConnection }
  const isInitiatorRef = useRef(false);

  const currentUserIdStr = currentUserId != null ? String(currentUserId) : null;

  const cleanup = useCallback(() => {
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch (_) {}
    });
    peerConnectionsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStreams({});
    setGroupCallState("idle");
    setActiveChannelId(null);
    setActiveChannelName(null);
    setInitiatorId(null);
    setInitiatorName(null);
    setParticipants([]);
    setIsMuted(false);
    setIsVideoOff(false);
    setErrorMessage(null);
    isInitiatorRef.current = false;
  }, []);

  const leaveGroupCall = useCallback(async () => {
    const ch = activeChannelId;
    if (ch && leaveGroupCallApi) {
      try {
        await leaveGroupCallApi(ch);
      } catch (e) {
        console.error("[GROUP_CALL] leaveGroupCall API error:", e);
      }
    }
    if (socket?.connected && ch) {
      socket.emit("group-call-leave", { channelId: ch });
    }
    cleanup();
  }, [activeChannelId, leaveGroupCallApi, socket, cleanup]);

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

  const startGroupCall = useCallback(
    async (channelId, channelName) => {
      if (!currentUserIdStr || !startGroupCallApi) return;
      setErrorMessage(null);
      isInitiatorRef.current = true;

      // Request microphone and video permissions upfront
      let stream;
      try {
        stream = await requestMediaPermissions({ audio: true, video: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideoOff(false);
      } catch (err) {
        console.error("[GROUP_CALL] media permission denied:", err);
        setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Camera/microphone access denied");
        return;
      }

      try {
        await startGroupCallApi(channelId);
        setActiveChannelId(channelId);
        setActiveChannelName(channelName || "Group");
        setInitiatorId(currentUserIdStr);
        setInitiatorName(currentUserName || "You");
        setParticipants([{ id: currentUserIdStr, name: currentUserName || "You" }]);
        setGroupCallState("waiting");
      } catch (err) {
        console.error("[GROUP_CALL] startGroupCall API error:", err);
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        setLocalStream(null);
        setErrorMessage(err.response?.data?.error || "Failed to start call");
      }
    },
    [currentUserIdStr, currentUserName, startGroupCallApi]
  );

  const joinGroupCall = useCallback(
    async (channelId, channelName, initId, initName) => {
      if (!currentUserIdStr || !joinGroupCallApi) return;
      setErrorMessage(null);

      // Request microphone and video permissions upfront
      let stream;
      try {
        stream = await requestMediaPermissions({ audio: true, video: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideoOff(false);
      } catch (err) {
        console.error("[GROUP_CALL] media permission denied:", err);
        setErrorMessage(err instanceof PermissionDeniedError ? err.message : "Camera/microphone access denied");
        return;
      }

      try {
        const res = await joinGroupCallApi(channelId);
        setActiveChannelId(channelId);
        setActiveChannelName(channelName || "Group");
        setInitiatorId(initId);
        setInitiatorName(initName || "Someone");
        if (Array.isArray(res?.participants) && res.participants.length > 0) {
          setParticipants(
            res.participants.map((p) => {
              const idStr = typeof p === "object" && p != null ? String(p.id) : String(p);
              const name =
                typeof p === "object" && p != null && p.name
                  ? p.name
                  : idStr === currentUserIdStr
                    ? currentUserName || "You"
                    : "User";
              return { id: idStr, name };
            })
          );
        }
        setGroupCallState("joined");
      } catch (err) {
        console.error("[GROUP_CALL] joinGroupCall API error:", err);
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        setLocalStream(null);
        setErrorMessage(err.response?.data?.error || "Failed to join call");
      }
    },
    [currentUserIdStr, currentUserName, joinGroupCallApi]
  );

  const dismissIncoming = useCallback(() => {
    setGroupCallState("idle");
    setActiveChannelId(null);
    setActiveChannelName(null);
    setInitiatorId(null);
    setInitiatorName(null);
  }, []);

  useEffect(() => {
    if (!socket || !currentUserIdStr) return;

    const handleGroupCallStarted = (data) => {
      const { channelId, channelName, initiatorId: initId, initiatorName: initName } = data;
      if (groupCallState !== "idle" && activeChannelId !== channelId) return;
      if (String(initId) === currentUserIdStr) return;
      console.log("[GROUP_CALL] received group-call-started", data);
      setActiveChannelId(channelId);
      setActiveChannelName(channelName || "Group");
      setInitiatorId(String(initId));
      setInitiatorName(initName || "Someone");
      setGroupCallState("incoming");
    };

    const handleParticipantJoined = async (data) => {
      const { channelId, joinerId, joinerName, participantIds, participants: participantsFromServer } = data;
      if (channelId !== activeChannelId) return;

      const joinerIdStr = String(joinerId);
      if (joinerIdStr === currentUserIdStr) {
        if (Array.isArray(participantsFromServer) && participantsFromServer.length > 0) {
          setParticipants(
            participantsFromServer.map((p) => ({
              id: String(p.id),
              name: p.name || (String(p.id) === currentUserIdStr ? currentUserName || "You" : "User"),
            }))
          );
        } else {
          setParticipants(
            (participantIds || []).map((id) => ({
              id: String(id),
              name: String(id) === currentUserIdStr ? currentUserName || "You" : "User",
            }))
          );
        }
        setGroupCallState("joined");
        return;
      }

      if (Array.isArray(participantsFromServer) && participantsFromServer.length > 0) {
        setParticipants(
          participantsFromServer.map((p) => ({
            id: String(p.id),
            name: p.name || (String(p.id) === currentUserIdStr ? currentUserName || "You" : "User"),
          }))
        );
      } else {
        setParticipants(
          (participantIds || []).map((id) => ({
            id: String(id),
            name: String(id) === currentUserIdStr ? currentUserName || "You" : String(id) === joinerIdStr ? (joinerName || "User") : "User",
          }))
        );
      }

      if (groupCallState === "waiting" || groupCallState === "active") {
        setGroupCallState("active");
        if (!localStreamRef.current) return;
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current[joinerIdStr] = pc;

        localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

        pc.ontrack = (e) => {
          if (e.streams?.[0]) {
            setRemoteStreams((prev) => ({ ...prev, [joinerIdStr]: e.streams[0] }));
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate && socket?.connected) {
            socket.emit("group-call-webrtc-ice", {
              channelId,
              toUserId: joinerIdStr,
              candidate: e.candidate,
            });
          }
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("group-call-webrtc-offer", {
            channelId,
            toUserId: joinerIdStr,
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.error("[GROUP_CALL] createOffer error:", err);
        }
      }
    };

    const handleParticipantLeft = (data) => {
      const { channelId, userId: leftUserId, participantIds } = data;
      if (channelId !== activeChannelId) return;
      const leftIdStr = String(leftUserId);
      const pc = peerConnectionsRef.current[leftIdStr];
      if (pc) {
        try {
          pc.close();
        } catch (_) {}
        delete peerConnectionsRef.current[leftIdStr];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[leftIdStr];
        return next;
      });
      // Sync participants from server's participantIds so count is correct in every edge case
      setParticipants((prev) => {
        const ids = Array.isArray(participantIds) ? participantIds : [];
        if (ids.length === 0) return [];
        return ids.map((id) => {
          const idStr = String(id);
          const existing = prev.find((p) => p.id === idStr);
          return {
            id: idStr,
            name: existing?.name || (idStr === currentUserIdStr ? currentUserName || "You" : "User"),
          };
        });
      });
      if (participantIds.length === 0) {
        cleanup();
      }
    };

    const handleGroupCallLeft = (data) => {
      const { channelId } = data;
      if (channelId === activeChannelId) {
        cleanup();
      }
    };

    const handleGroupCallEnded = (data) => {
      const { channelId } = data;
      if (channelId !== activeChannelId) return;
      // Full cleanup when call ends (e.g. admin left): close peer connections, stop streams, reset state
      cleanup();
    };

    const handleWebrtcOffer = async (data) => {
      const { fromUserId, channelId, sdp } = data;
      if (channelId !== activeChannelId) return;
      const fromIdStr = String(fromUserId);
      if (fromIdStr === currentUserIdStr) return;

      let pc = peerConnectionsRef.current[fromIdStr];
      if (!pc) {
        pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current[fromIdStr] = pc;
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
        }
        pc.ontrack = (e) => {
          if (e.streams?.[0]) {
            setRemoteStreams((prev) => ({ ...prev, [fromIdStr]: e.streams[0] }));
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate && socket?.connected) {
            socket.emit("group-call-webrtc-ice", {
              channelId,
              toUserId: fromIdStr,
              candidate: e.candidate,
            });
          }
        };
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("group-call-webrtc-answer", {
          channelId,
          toUserId: fromIdStr,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error("[GROUP_CALL] handleWebrtcOffer error:", err);
      }
    };

    const handleWebrtcAnswer = async (data) => {
      const { fromUserId, channelId, sdp } = data;
      if (channelId !== activeChannelId) return;
      const fromIdStr = String(fromUserId);
      const pc = peerConnectionsRef.current[fromIdStr];
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("[GROUP_CALL] setRemoteDescription answer error:", err);
      }
    };

    const handleWebrtcIce = async (data) => {
      const { fromUserId, channelId, candidate } = data;
      if (channelId !== activeChannelId || !candidate) return;
      const fromIdStr = String(fromUserId);
      const pc = peerConnectionsRef.current[fromIdStr];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[GROUP_CALL] addIceCandidate error:", err);
      }
    };

    socket.on("group-call-started", handleGroupCallStarted);
    socket.on("group-call-participant-joined", handleParticipantJoined);
    socket.on("group-call-participant-left", handleParticipantLeft);
    socket.on("group-call-left", handleGroupCallLeft);
    socket.on("group-call-ended", handleGroupCallEnded);
    socket.on("group-call-webrtc-offer", handleWebrtcOffer);
    socket.on("group-call-webrtc-answer", handleWebrtcAnswer);
    socket.on("group-call-webrtc-ice", handleWebrtcIce);

    return () => {
      socket.off("group-call-started", handleGroupCallStarted);
      socket.off("group-call-participant-joined", handleParticipantJoined);
      socket.off("group-call-participant-left", handleParticipantLeft);
      socket.off("group-call-left", handleGroupCallLeft);
      socket.off("group-call-ended", handleGroupCallEnded);
      socket.off("group-call-webrtc-offer", handleWebrtcOffer);
      socket.off("group-call-webrtc-answer", handleWebrtcAnswer);
      socket.off("group-call-webrtc-ice", handleWebrtcIce);
    };
  }, [
    socket,
    currentUserIdStr,
    currentUserName,
    activeChannelId,
    activeChannelName,
    groupCallState,
    cleanup,
  ]);

  return {
    groupCallState,
    activeChannelId,
    activeChannelName,
    initiatorId,
    initiatorName,
    participants,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    errorMessage,
    startGroupCall,
    joinGroupCall,
    leaveGroupCall,
    dismissIncoming,
    toggleMute,
    toggleVideo,
  };
}
