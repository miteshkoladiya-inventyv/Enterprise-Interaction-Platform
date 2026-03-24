import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { BACKEND_URL } from "../config";
import { requestMediaPermissions, PermissionDeniedError } from "./useMediaPermissions";

function getAuthHeaders() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function chooseRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "video/webm";
}

/**
 * LiveKit SFU-based meeting media hook.
 * Keeps the same public API used by MeetingModule.
 */
export function useMeetingCall(socket, currentUserId, currentUserName, meetingId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareUserId, setScreenShareUserId] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [remoteRecordingState, setRemoteRecordingState] = useState({
    isRecording: false,
    startedAt: null,
    startedByName: null,
    startedByUserId: null,
    updatedAt: null,
  });
  const [remoteMediaStates, setRemoteMediaStates] = useState({});
  const [handRaised, setHandRaised] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const currentUserIdStr = currentUserId != null ? String(currentUserId) : null;

  const roomRef = useRef(null);
  const connectedMeetingIdRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const remoteScreenStreamsRef = useRef({});

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const stopRecordingResolveRef = useRef(null);
  const recordingRenderRef = useRef({
    rafId: null,
    canvas: null,
    canvasCtx: null,
    videoEls: new Map(),
    audioContext: null,
    audioDestination: null,
    audioSources: new Map(),
  });
  const reconnectAttemptRef = useRef(0);

  const syncStreamState = useCallback(() => {
    const nextCam = {};
    const nextScreen = {};

    Object.entries(remoteStreamsRef.current).forEach(([key, stream]) => {
      if (stream.getTracks().length > 0) {
        nextCam[key] = new MediaStream(stream.getTracks());
      }
    });

    Object.entries(remoteScreenStreamsRef.current).forEach(([key, stream]) => {
      if (stream.getTracks().length > 0) {
        nextScreen[key] = new MediaStream(stream.getTracks());
      }
    });

    setRemoteStreams(nextCam);
    setRemoteScreenStreams(nextScreen);
  }, []);

  const removeParticipantStreams = useCallback((identity) => {
    const id = String(identity);
    delete remoteStreamsRef.current[id];
    delete remoteScreenStreamsRef.current[id];

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setRemoteScreenStreams((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setRemoteMediaStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (screenShareUserId === id) {
      setScreenShareUserId(null);
    }
  }, [screenShareUserId]);

  const attachTrack = useCallback((participantIdentity, track, source) => {
    const id = String(participantIdentity);
    const isScreen = source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;
    const targetRef = isScreen ? remoteScreenStreamsRef : remoteStreamsRef;

    if (!targetRef.current[id]) {
      targetRef.current[id] = new MediaStream();
    }

    const stream = targetRef.current[id];
    const existing = stream.getTracks().find((t) => t.id === track.mediaStreamTrack.id);
    if (!existing) {
      stream.addTrack(track.mediaStreamTrack);
    }

    if (isScreen && source === Track.Source.ScreenShare) {
      setScreenShareUserId(id);
    }

    syncStreamState();
  }, [syncStreamState]);

  const detachTrack = useCallback((participantIdentity, track, source) => {
    const id = String(participantIdentity);
    const isScreen = source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;
    const targetRef = isScreen ? remoteScreenStreamsRef : remoteStreamsRef;
    const stream = targetRef.current[id];

    if (!stream) return;

    stream.getTracks().forEach((t) => {
      if (t.id === track.mediaStreamTrack.id) {
        stream.removeTrack(t);
      }
    });

    if (stream.getTracks().length === 0) {
      delete targetRef.current[id];
      if (isScreen && source === Track.Source.ScreenShare && screenShareUserId === id) {
        setScreenShareUserId(null);
      }
    }

    syncStreamState();
  }, [screenShareUserId, syncStreamState]);

  const disconnectRoom = useCallback(() => {
    if (!roomRef.current) return;

    roomRef.current.removeAllListeners();
    roomRef.current.disconnect();
    roomRef.current = null;
    connectedMeetingIdRef.current = null;

    remoteStreamsRef.current = {};
    remoteScreenStreamsRef.current = {};
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setScreenShareUserId(null);
    setIsReconnecting(false);
  }, []);

  const rebuildRemoteStateFromRoom = useCallback((room) => {
    if (!room) return;

    remoteStreamsRef.current = {};
    remoteScreenStreamsRef.current = {};

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (!pub.isSubscribed || !pub.track) return;

        const isScreen = pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio;
        const targetRef = isScreen ? remoteScreenStreamsRef : remoteStreamsRef;
        const id = String(participant.identity);

        if (!targetRef.current[id]) {
          targetRef.current[id] = new MediaStream();
        }

        const stream = targetRef.current[id];
        const exists = stream.getTracks().find((t) => t.id === pub.track.mediaStreamTrack.id);
        if (!exists) {
          stream.addTrack(pub.track.mediaStreamTrack);
        }
      });
    });

    const activeScreenOwner = Object.keys(remoteScreenStreamsRef.current)[0] || null;
    if (activeScreenOwner) {
      setScreenShareUserId(activeScreenOwner);
    }

    syncStreamState();
  }, [syncStreamState]);

  const connectRoom = useCallback(async () => {
    console.log("[LIVEKIT] connectRoom called with meetingId:", meetingId, "currentUserIdStr:", currentUserIdStr, "hasLocalStream:", !!localStreamRef.current);

    if (!meetingId || !currentUserIdStr || !localStreamRef.current) {
      console.log("[LIVEKIT] Early return - missing prerequisites");
      return;
    }

    if (roomRef.current && connectedMeetingIdRef.current === String(meetingId)) {
      console.log("[LIVEKIT] Already connected to this meeting, skipping");
      return;
    }

    if (roomRef.current && connectedMeetingIdRef.current !== String(meetingId)) {
      console.log("[LIVEKIT] Disconnecting from previous meeting");
      disconnectRoom();
    }

    try {
      console.log("[LIVEKIT] Requesting LiveKit token for meeting:", meetingId);
      const response = await fetch(`${BACKEND_URL}/meetings/${meetingId}/livekit-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get LiveKit meeting token");
      }

      const payload = await response.json();
      console.log("[LIVEKIT] Got token response:", payload);

      // Extract token data from response wrapper
      const tokenData = payload.data || payload;
      console.log("[LIVEKIT] Token data:", tokenData);

      if (!tokenData.url || !tokenData.token) {
        throw new Error(`Invalid token response: missing url (${!!tokenData.url}) or token (${!!tokenData.token})`);
      }

      console.log("[LIVEKIT] Got token, creating room");
      const room = new Room({ adaptiveStream: true, dynacast: true });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log("[LIVEKIT] Participant disconnected:", participant.identity);
        removeParticipantStreams(participant.identity);
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        console.log("[LIVEKIT] Participant connected");
        rebuildRemoteStateFromRoom(room);
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log("[LIVEKIT] Track subscribed:", track.kind, "from:", participant.identity);
        attachTrack(participant.identity, track, publication?.source || track.source);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log("[LIVEKIT] Track unsubscribed:", track.kind, "from:", participant.identity);
        detachTrack(participant.identity, track, publication?.source || track.source);
      });

      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log("[LIVEKIT] Local track published:", publication.source);
        if (publication.source === Track.Source.ScreenShare) {
          console.log("[LIVEKIT] Screen share track published!");
          setIsScreenSharing(true);
          setScreenShareUserId(currentUserIdStr);
        }
      });

      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        console.log("[LIVEKIT] Local track unpublished:", publication.source);
        if (publication.source === Track.Source.ScreenShare) {
          console.log("[LIVEKIT] Screen share track unpublished");
          setIsScreenSharing(false);
          if (screenShareUserId === currentUserIdStr) {
            setScreenShareUserId(null);
          }
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log("[LIVEKIT] Room disconnected");
        connectedMeetingIdRef.current = null;
        setIsReconnecting(false);
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log("[LIVEKIT] Room reconnecting");
        setIsReconnecting(true);
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log("[LIVEKIT] Room reconnected");
        reconnectAttemptRef.current += 1;
        setIsReconnecting(false);
        rebuildRemoteStateFromRoom(room);

        if (socket?.connected && meetingId) {
          socket.emit("meeting-media-state", {
            meetingId,
            isMuted,
            isVideoOff,
          });
          socket.emit("meeting-hand-raise", {
            meetingId,
            userId: currentUserIdStr,
            handRaised,
          });
        }
      });

      console.log("[LIVEKIT] Connecting to room with URL:", tokenData.url);
      await room.connect(tokenData.url, tokenData.token);
      console.log("[LIVEKIT] Connected to room successfully!");

      const publishPromises = [];
      for (const mediaTrack of localStreamRef.current.getTracks()) {
        console.log("[LIVEKIT] Publishing track:", mediaTrack.kind);
        publishPromises.push(room.localParticipant.publishTrack(mediaTrack));
      }
      await Promise.all(publishPromises);
      console.log("[LIVEKIT] All tracks published");

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.isSubscribed && pub.track) {
            attachTrack(participant.identity, pub.track, pub.source || pub.track.source);
          }
        });
      });

      roomRef.current = room;
      connectedMeetingIdRef.current = String(meetingId);
      reconnectAttemptRef.current = 0;
      console.log("[LIVEKIT] Room connection complete!");
    } catch (error) {
      console.error("[LIVEKIT] Connection error:", error);
      throw error;
    }
  }, [
    attachTrack,
    currentUserIdStr,
    detachTrack,
    disconnectRoom,
    handRaised,
    isMuted,
    isVideoOff,
    meetingId,
    removeParticipantStreams,
    rebuildRemoteStateFromRoom,
    screenShareUserId,
    socket,
  ]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // no-op
      }
    }

    disconnectRoom();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setMediaError(null);
    setRemoteMediaStates({});
    setRemoteRecordingState({
      isRecording: false,
      startedAt: null,
      startedByName: null,
      startedByUserId: null,
      updatedAt: null,
    });
    setHandRaised(false);
    setIsRecording(false);
    setRecordingElapsedSeconds(0);
  }, [disconnectRoom]);

  const releaseRecordingRenderResources = useCallback(() => {
    const resources = recordingRenderRef.current;

    if (resources.rafId) {
      cancelAnimationFrame(resources.rafId);
      resources.rafId = null;
    }

    resources.videoEls.forEach((videoEl) => {
      try {
        videoEl.pause();
        videoEl.srcObject = null;
      } catch {
        // no-op
      }
    });
    resources.videoEls.clear();

    resources.audioSources.forEach((sourceNode) => {
      try {
        sourceNode.disconnect();
      } catch {
        // no-op
      }
    });
    resources.audioSources.clear();

    if (resources.audioDestination) {
      resources.audioDestination = null;
    }

    if (resources.audioContext) {
      resources.audioContext.close().catch(() => {
        // no-op
      });
      resources.audioContext = null;
    }

    resources.canvas = null;
    resources.canvasCtx = null;
  }, []);

  const startMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      setMediaError(null);
      const stream = await requestMediaPermissions({ audio: true, video: true });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(false);

      await connectRoom();

      return stream;
    } catch (error) {
      const message = error instanceof PermissionDeniedError
        ? error.message
        : error?.message || "Failed to access camera/microphone";
      setMediaError(message);
      throw error;
    }
  }, [connectRoom]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    const newMuted = !isMuted;
    audioTrack.enabled = !newMuted;
    setIsMuted(newMuted);

    if (socket?.connected && meetingId) {
      socket.emit("meeting-media-state", {
        meetingId,
        isMuted: newMuted,
        isVideoOff,
      });
    }
  }, [isMuted, isVideoOff, meetingId, socket]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const newVideoOff = !isVideoOff;
    videoTrack.enabled = !newVideoOff;
    setIsVideoOff(newVideoOff);

    if (socket?.connected && meetingId) {
      socket.emit("meeting-media-state", {
        meetingId,
        isMuted,
        isVideoOff: newVideoOff,
      });
    }
  }, [isMuted, isVideoOff, meetingId, socket]);

  const toggleScreenShare = useCallback(async () => {
    console.log("[SCREEN SHARE] toggleScreenShare called");
    console.log("[SCREEN SHARE] roomRef.current:", !!roomRef.current);
    console.log("[SCREEN SHARE] isScreenSharing:", isScreenSharing);

    if (!roomRef.current) {
      console.error("[SCREEN SHARE] Room not connected! Cannot toggle screen share.");
      setMediaError("Room not connected. Please wait for the meeting to load fully.");
      return;
    }

    try {
      const next = !isScreenSharing;
      console.log("[SCREEN SHARE] Setting screen share to:", next);

      await roomRef.current.localParticipant.setScreenShareEnabled(next);
      console.log("[SCREEN SHARE] LiveKit screen share set successfully");

      setIsScreenSharing(next);
      setScreenShareUserId(next ? currentUserIdStr : null);

      if (socket?.connected && meetingId) {
        console.log("[SCREEN SHARE] Emitting socket event:", next ? "meeting-screen-share-start" : "meeting-screen-share-stop");
        socket.emit(next ? "meeting-screen-share-start" : "meeting-screen-share-stop", {
          meetingId,
          userId: currentUserIdStr,
        });
      } else {
        console.warn("[SCREEN SHARE] Socket not connected or meetingId missing", { socketConnected: socket?.connected, meetingId });
      }
    } catch (error) {
      console.error("[SCREEN SHARE] Error:", error);
      const errorMsg = error?.message || "Failed to toggle screen sharing";
      setMediaError(errorMsg);
    }
  }, [currentUserIdStr, isScreenSharing, meetingId, socket]);

  const toggleHandRaise = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);

    if (socket?.connected && meetingId) {
      socket.emit("meeting-hand-raise", {
        meetingId,
        userId: currentUserIdStr,
        handRaised: next,
      });
    }
  }, [currentUserIdStr, handRaised, meetingId, socket]);

  const buildRecordingStream = useCallback(() => {
    releaseRecordingRenderResources();

    const resources = recordingRenderRef.current;
    const canvas = document.createElement("canvas");
    const width = 1280;
    const height = 720;
    const gap = 8;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    resources.canvas = canvas;
    resources.canvasCtx = ctx;

    if (!ctx) {
      throw new Error("Failed to initialize meeting recording canvas");
    }

    const readSources = () => {
      const sources = [];

      if (localStreamRef.current) {
        sources.push({
          key: `local:${currentUserIdStr || "me"}`,
          label: "You",
          stream: localStreamRef.current,
        });
      }

      Object.entries(remoteStreamsRef.current).forEach(([uid, stream], index) => {
        sources.push({
          key: `remote:${uid}`,
          label:
            remoteMediaStates[uid]?.name ||
            `Participant ${index + 1}`,
          stream,
        });
      });

      Object.entries(remoteScreenStreamsRef.current).forEach(([uid, stream], index) => {
        sources.push({
          key: `screen:${uid}`,
          label:
            remoteMediaStates[uid]?.name ||
            `Screen Share ${index + 1}`,
          stream,
        });
      });

      return sources;
    };

    const ensureVideoEl = (source) => {
      const existing = resources.videoEls.get(source.key);
      if (existing && existing.srcObject === source.stream) {
        return existing;
      }

      const videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = source.stream;
      videoEl.play().catch(() => {
        // no-op
      });

      resources.videoEls.set(source.key, videoEl);
      return videoEl;
    };

    const syncAudioMix = (sources) => {
      if (!resources.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        resources.audioContext = new AudioCtx();
        resources.audioDestination = resources.audioContext.createMediaStreamDestination();
      }

      const activeTrackKeys = new Set();

      sources.forEach((source) => {
        source.stream.getAudioTracks().forEach((audioTrack) => {
          if (audioTrack.readyState !== "live") return;

          const trackKey = `${source.key}:${audioTrack.id}`;
          activeTrackKeys.add(trackKey);

          if (!resources.audioSources.has(trackKey)) {
            try {
              const audioStream = new MediaStream([audioTrack]);
              const sourceNode = resources.audioContext.createMediaStreamSource(audioStream);
              sourceNode.connect(resources.audioDestination);
              resources.audioSources.set(trackKey, sourceNode);
            } catch {
              // no-op
            }
          }
        });
      });

      Array.from(resources.audioSources.keys()).forEach((trackKey) => {
        if (activeTrackKeys.has(trackKey)) return;

        const sourceNode = resources.audioSources.get(trackKey);
        try {
          sourceNode?.disconnect();
        } catch {
          // no-op
        }
        resources.audioSources.delete(trackKey);
      });
    };

    const drawFrame = () => {
      const sources = readSources();
      syncAudioMix(sources);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      if (sources.length === 0) {
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for participants...", width / 2, height / 2);
      } else {
        const cols = Math.ceil(Math.sqrt(sources.length));
        const rows = Math.ceil(sources.length / cols);
        const tileWidth = Math.floor((width - gap * (cols + 1)) / cols);
        const tileHeight = Math.floor((height - gap * (rows + 1)) / rows);

        sources.forEach((source, idx) => {
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          const x = gap + col * (tileWidth + gap);
          const y = gap + row * (tileHeight + gap);
          const videoEl = ensureVideoEl(source);

          ctx.fillStyle = "#18181b";
          ctx.fillRect(x, y, tileWidth, tileHeight);

          const hasVideoTrack = source.stream.getVideoTracks().some((track) => track.readyState === "live");
          if (hasVideoTrack && videoEl.readyState >= 2) {
            ctx.drawImage(videoEl, x, y, tileWidth, tileHeight);
          }

          const badgeHeight = 28;
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(x, y + tileHeight - badgeHeight, tileWidth, badgeHeight);
          ctx.fillStyle = "#ffffff";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(source.label, x + 10, y + tileHeight - 10);
        });
      }

      resources.rafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    const canvasStream = canvas.captureStream(30);
    const recordingStream = new MediaStream();

    canvasStream.getVideoTracks().forEach((track) => recordingStream.addTrack(track));
    resources.audioDestination?.stream?.getAudioTracks().forEach((track) => recordingStream.addTrack(track));

    return recordingStream;
  }, [currentUserIdStr, releaseRecordingRenderResources, remoteMediaStates]);

  const startRecording = useCallback(() => {
    if (isRecording) return;

    try {
      const stream = buildRecordingStream();
      if (stream.getTracks().length === 0) {
        throw new Error("No media available to record");
      }

      const mimeType = chooseRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recordingChunksRef.current = [];
      recordingStartedAtRef.current = new Date();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        const resolve = stopRecordingResolveRef.current;
        stopRecordingResolveRef.current = null;

        if (!resolve) return;

        if (!chunks.length) {
          resolve([]);
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        resolve([
          {
            blob,
            participantId: currentUserIdStr || "meeting",
            participantName: currentUserName || "Meeting Recording",
            type: "video",
            startedAt: recordingStartedAtRef.current || new Date(),
            endedAt: new Date(),
          },
        ]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setRecordingElapsedSeconds(0);
      return true;
    } catch (error) {
      setMediaError(error?.message || "Failed to start recording");
      return false;
    }
  }, [buildRecordingStream, currentUserIdStr, currentUserName, isRecording]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve([]);
        return;
      }

      stopRecordingResolveRef.current = resolve;
      setIsRecording(false);
      recorder.stop();
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      releaseRecordingRenderResources();
    });
  }, [releaseRecordingRenderResources]);

  useEffect(() => {
    if (!isRecording || !recordingStartedAtRef.current) {
      setRecordingElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      setRecordingElapsedSeconds(elapsed);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!socket) return;

    const onRemoteMediaState = (data) => {
      if (String(data?.meetingId) !== String(meetingId)) return;
      const uid = String(data.userId);
      if (uid === currentUserIdStr) return;

      setRemoteMediaStates((prev) => ({
        ...prev,
        [uid]: {
          ...(prev[uid] || {}),
          isMuted: !!data.isMuted,
          isVideoOff: !!data.isVideoOff,
        },
      }));
    };

    const onHandRaise = (data) => {
      if (String(data?.meetingId) !== String(meetingId)) return;
      const uid = String(data.userId);
      if (uid === currentUserIdStr) return;
      const nextHandRaised =
        typeof data.handRaised === "boolean"
          ? data.handRaised
          : !!data.raised;

      setRemoteMediaStates((prev) => ({
        ...prev,
        [uid]: {
          ...(prev[uid] || {}),
          handRaised: nextHandRaised,
        },
      }));
    };

    const onScreenShareStart = (data) => {
      if (String(data?.meetingId) !== String(meetingId)) return;
      setScreenShareUserId(String(data.userId));
    };

    const onScreenShareStop = (data) => {
      if (String(data?.meetingId) !== String(meetingId)) return;
      setScreenShareUserId((prev) => (String(prev) === String(data.userId) ? null : prev));
    };

    const onRecordingState = (data) => {
      if (String(data?.meetingId) !== String(meetingId)) return;

      setRemoteRecordingState({
        isRecording: !!data?.isRecording,
        startedAt: data?.startedAt || null,
        startedByName: data?.startedByName || null,
        startedByUserId: data?.startedByUserId || null,
        updatedAt: data?.updatedAt || null,
      });
    };

    socket.on("meeting-media-state", onRemoteMediaState);
    socket.on("meeting-hand-raise", onHandRaise);
    socket.on("meeting-screen-share-start", onScreenShareStart);
    socket.on("meeting-screen-share-stop", onScreenShareStop);
    socket.on("meeting-recording-state", onRecordingState);

    return () => {
      socket.off("meeting-media-state", onRemoteMediaState);
      socket.off("meeting-hand-raise", onHandRaise);
      socket.off("meeting-screen-share-start", onScreenShareStart);
      socket.off("meeting-screen-share-stop", onScreenShareStop);
      socket.off("meeting-recording-state", onRecordingState);
    };
  }, [currentUserIdStr, meetingId, socket]);

  useEffect(() => {
    if (!meetingId) {
      disconnectRoom();
      return;
    }

    if (localStreamRef.current) {
      connectRoom().catch((error) => {
        setMediaError(error?.message || "Failed to connect to meeting room");
      });
    }
  }, [connectRoom, disconnectRoom, meetingId]);

  useEffect(() => {
    return () => {
      releaseRecordingRenderResources();
      cleanup();
    };
  }, [cleanup, releaseRecordingRenderResources]);

  return {
    localStream,
    remoteStreams,
    remoteScreenStreams,
    isMuted,
    isVideoOff,
    isScreenSharing,
    screenShareUserId,
    handRaised,
    remoteMediaStates,
    mediaError,
    isReconnecting,
    isRecording,
    recordingElapsedSeconds,
    remoteRecordingState,
    startRecording,
    stopRecording,
    startMedia,
    cleanup,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleHandRaise,
  };
}
