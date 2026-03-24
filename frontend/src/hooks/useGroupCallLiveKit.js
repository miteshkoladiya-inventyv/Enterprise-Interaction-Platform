import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { requestMediaPermissions, PermissionDeniedError } from "./useMediaPermissions";

export function useGroupCallLiveKit(
  socket,
  currentUserId,
  currentUserName,
  startGroupCallApi,
  getGroupCallStatusApi,
  joinGroupCallApi,
  leaveGroupCallApi,
  getGroupLiveKitTokenApi
) {
  const [groupCallState, setGroupCallState] = useState("idle");
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeChannelName, setActiveChannelName] = useState(null);
  const [initiatorId, setInitiatorId] = useState(null);
  const [initiatorName, setInitiatorName] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const localStreamRef = useRef(null);
  const roomRef = useRef(null);
  const participantNamesRef = useRef({});
  const remoteStreamsRef = useRef({});

  const currentUserIdStr = currentUserId != null ? String(currentUserId) : null;

  const setRemoteStreamForIdentity = useCallback((identity, track, add) => {
    const idStr = String(identity);
    const existing = remoteStreamsRef.current[idStr] || new MediaStream();

    if (add) {
      existing.addTrack(track.mediaStreamTrack);
    } else {
      existing.getTracks().forEach((t) => {
        if (t.id === track.mediaStreamTrack.id) {
          existing.removeTrack(t);
        }
      });
    }

    if (existing.getTracks().length === 0) {
      delete remoteStreamsRef.current[idStr];
    } else {
      remoteStreamsRef.current[idStr] = existing;
    }

    const next = {};
    Object.entries(remoteStreamsRef.current).forEach(([key, stream]) => {
      next[key] = new MediaStream(stream.getTracks());
    });
    setRemoteStreams(next);
  }, []);

  const syncParticipantsFromRoom = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const selfParticipant = {
      id: currentUserIdStr,
      name: currentUserName || "You",
    };

    const remote = [];
    room.remoteParticipants.forEach((participant) => {
      const id = String(participant.identity);
      const knownName = participantNamesRef.current[id] || participant.name || "User";
      participantNamesRef.current[id] = knownName;
      remote.push({ id, name: knownName });
    });

    setParticipants([selfParticipant, ...remote]);

    if (remote.length > 0 && (groupCallState === "waiting" || groupCallState === "joined")) {
      setGroupCallState("active");
    }
    if (remote.length === 0 && groupCallState === "active") {
      setGroupCallState("waiting");
    }
  }, [currentUserIdStr, currentUserName, groupCallState]);

  const cleanup = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    participantNamesRef.current = {};
    remoteStreamsRef.current = {};

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
  }, []);

  const connectRoom = useCallback(async (channelId) => {
    if (!getGroupLiveKitTokenApi) {
      throw new Error("Group LiveKit token API not configured");
    }

    const tokenPayload = await getGroupLiveKitTokenApi(channelId);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      const id = String(participant.identity);
      participantNamesRef.current[id] = participant.name || participantNamesRef.current[id] || "User";
      syncParticipantsFromRoom();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const id = String(participant.identity);
      delete participantNamesRef.current[id];
      delete remoteStreamsRef.current[id];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      syncParticipantsFromRoom();
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      setRemoteStreamForIdentity(participant.identity, track, true);
      const id = String(participant.identity);
      participantNamesRef.current[id] = participant.name || participantNamesRef.current[id] || "User";
      syncParticipantsFromRoom();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      setRemoteStreamForIdentity(participant.identity, track, false);
    });

    room.on(RoomEvent.Disconnected, () => {
      cleanup();
    });

    await room.connect(tokenPayload.url, tokenPayload.token);

    if (!localStreamRef.current) {
      throw new Error("Local media stream is not available");
    }

    for (const mediaTrack of localStreamRef.current.getTracks()) {
      await room.localParticipant.publishTrack(mediaTrack);
    }

    syncParticipantsFromRoom();
  }, [cleanup, getGroupLiveKitTokenApi, setRemoteStreamForIdentity, syncParticipantsFromRoom]);

  const leaveGroupCall = useCallback(async () => {
    const channelId = activeChannelId;

    if (channelId && leaveGroupCallApi) {
      try {
        await leaveGroupCallApi(channelId);
      } catch (err) {
        console.error("[GROUP_CALL] leaveGroupCall API error:", err);
      }
    }

    if (socket?.connected && channelId) {
      socket.emit("group-call-leave", { channelId });
    }

    cleanup();
  }, [activeChannelId, cleanup, leaveGroupCallApi, socket]);

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

  const prepareLocalMedia = useCallback(async () => {
    const stream = await requestMediaPermissions({ audio: true, video: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsVideoOff(false);
  }, []);

  const startGroupCall = useCallback(async (channelId, channelName) => {
    if (!currentUserIdStr || !startGroupCallApi) return;

    setErrorMessage(null);

    try {
      await prepareLocalMedia();
      await startGroupCallApi(channelId);
      setActiveChannelId(channelId);
      setActiveChannelName(channelName || "Group");
      setInitiatorId(currentUserIdStr);
      setInitiatorName(currentUserName || "You");
      setParticipants([{ id: currentUserIdStr, name: currentUserName || "You" }]);
      setGroupCallState("waiting");
      await connectRoom(channelId);
    } catch (err) {
      cleanup();
      setErrorMessage(err instanceof PermissionDeniedError ? err.message : err.response?.data?.error || "Failed to start call");
    }
  }, [cleanup, connectRoom, currentUserIdStr, currentUserName, prepareLocalMedia, startGroupCallApi]);

  const joinGroupCall = useCallback(async (channelId, channelName, initId, initName) => {
    if (!currentUserIdStr || !joinGroupCallApi) return;

    setErrorMessage(null);

    try {
      await prepareLocalMedia();
      await joinGroupCallApi(channelId);
      setActiveChannelId(channelId);
      setActiveChannelName(channelName || "Group");
      setInitiatorId(initId);
      setInitiatorName(initName || "Someone");
      setParticipants([{ id: currentUserIdStr, name: currentUserName || "You" }]);
      setGroupCallState("joined");
      await connectRoom(channelId);
    } catch (err) {
      cleanup();
      setErrorMessage(err instanceof PermissionDeniedError ? err.message : err.response?.data?.error || "Failed to join call");
    }
  }, [cleanup, connectRoom, currentUserIdStr, currentUserName, joinGroupCallApi, prepareLocalMedia]);

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

      setActiveChannelId(channelId);
      setActiveChannelName(channelName || "Group");
      setInitiatorId(String(initId));
      setInitiatorName(initName || "Someone");
      setGroupCallState("incoming");
    };

    const handleParticipantJoined = (data) => {
      const { channelId, participants: serverParticipants = [] } = data;
      if (channelId !== activeChannelId || !Array.isArray(serverParticipants)) return;
      serverParticipants.forEach((p) => {
        participantNamesRef.current[String(p.id)] = p.name || participantNamesRef.current[String(p.id)] || "User";
      });
      syncParticipantsFromRoom();
    };

    const handleParticipantLeft = (data) => {
      const { channelId, userId } = data;
      if (channelId !== activeChannelId) return;
      const leftId = String(userId);
      delete participantNamesRef.current[leftId];
      delete remoteStreamsRef.current[leftId];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[leftId];
        return next;
      });
      syncParticipantsFromRoom();
    };

    const handleGroupCallLeft = (data) => {
      const { channelId } = data;
      if (channelId === activeChannelId) {
        cleanup();
      }
    };

    const handleGroupCallEnded = (data) => {
      const { channelId } = data;
      if (channelId === activeChannelId) {
        cleanup();
      }
    };

    socket.on("group-call-started", handleGroupCallStarted);
    socket.on("group-call-participant-joined", handleParticipantJoined);
    socket.on("group-call-participant-left", handleParticipantLeft);
    socket.on("group-call-left", handleGroupCallLeft);
    socket.on("group-call-ended", handleGroupCallEnded);

    return () => {
      socket.off("group-call-started", handleGroupCallStarted);
      socket.off("group-call-participant-joined", handleParticipantJoined);
      socket.off("group-call-participant-left", handleParticipantLeft);
      socket.off("group-call-left", handleGroupCallLeft);
      socket.off("group-call-ended", handleGroupCallEnded);
    };
  }, [
    socket,
    currentUserIdStr,
    activeChannelId,
    groupCallState,
    cleanup,
    syncParticipantsFromRoom,
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
