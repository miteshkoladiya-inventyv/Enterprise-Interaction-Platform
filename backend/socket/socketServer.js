import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { ChatChannel } from "../models/ChatChannel.js";
import { ChannelMember } from "../models/ChannelMember.js";

const app = express();

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  },
});

const users = {};
const onlineUsers = new Set(); // Track online users
// Track users in calls: userId -> { inCall: boolean, callType: 'direct' | 'group', otherUserId?: string, channelId?: string }
const userCallStatus = {};
// Track active meeting rooms in memory: meetingId -> { [userId]: { name } }
const activeMeetings = {};
// Track active recording state per meeting for participant-facing status updates.
const activeMeetingRecordingState = {};
// Lobby for meetings with open_to_everyone=false: meetingId -> [{ userId, name, socketId }]
const meetingLobby = {};
const serializeMeetingParticipants = (room = {}) =>
  Object.entries(room).map(([userId, info]) => ({
    userId,
    name: info.name,
    isMuted: !!info.isMuted,
    isVideoOff: !!info.isVideoOff,
    handRaised: !!info.handRaised,
    screenSharing: !!info.screenSharing,
  }));
// NEW â"€ Track active document sessions: docId -> { [userId]: { name, color, socketId }, _latestContent?, _version? }
const activeDocuments = {};

// NEW â"€ Collaborator color palette (cycles)
const COLLAB_COLORS = [
  "#4f8ef7", "#a78bfa", "#34d399", "#f472b6",
  "#fb923c", "#facc15", "#38bdf8", "#f87171",
];
let _colorIdx = 0;
function nextCollabColor() {
  const c = COLLAB_COLORS[_colorIdx % COLLAB_COLORS.length];
  _colorIdx++;
  return c;
}

function forwardToUser(eventName, toUserId, payload) {
  const normalizedTo = toUserId?.toString?.() ?? toUserId;
  const socketId = users[normalizedTo];
  console.log(
    `[SIGNALLING] forward "${eventName}" to userId=${normalizedTo} -> socketId=${
      socketId || "NOT FOUND"
    } | users map:`,
    Object.keys(users)
  );
  if (socketId) {
    io.to(socketId).emit(eventName, payload);
  }
}

// Broadcast online users to all connected clients
function broadcastOnlineUsers() {
  const onlineUsersList = Array.from(onlineUsers);
  io.emit("online-users-updated", { onlineUsers: onlineUsersList });
  console.log(`[ONLINE STATUS] Broadcasting online users:`, onlineUsersList);
}

io.on("connection", async (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.meetingIds = new Set();
  socket.documentIds = new Set(); // NEW â"€ track doc rooms this socket has joined

  socket.on("message", (msg) => {
    console.log("Message received:", msg);
  });

  const userId = socket.handshake.auth.userId;
  const normalizedUserId = userId?.toString?.() ?? userId;

  if (normalizedUserId) {
    users[normalizedUserId] = socket.id;
    socket.userId = normalizedUserId;

    // Add user to online set
    onlineUsers.add(normalizedUserId);
    console.log(
      `[SIGNALLING] user registered: userId=${normalizedUserId} -> socketId=${socket.id}`
    );
    console.log(`[ONLINE STATUS] User came online: ${normalizedUserId}`);

    // Broadcast updated online users list
    broadcastOnlineUsers();
  }

  // Send current online users to this socket on request
  socket.on("request-online-users", () => {
    const onlineUsersList = Array.from(onlineUsers);
    socket.emit("online-users-updated", { onlineUsers: onlineUsersList });
  });

  // ---------- WebRTC Audio Call Signalling ----------
  socket.on("audio-call-request", (data) => {
    const { toUserId, fromUserName } = data;
    console.log("[SIGNALLING] received audio-call-request", {
      from: socket.userId,
      toUserId,
      fromUserName,
    });
    if (!toUserId || !socket.userId) return;
    forwardToUser("incoming-audio-call", toUserId, {
      fromUserId: socket.userId,
      fromUserName: fromUserName || "Someone",
    });
  });

  socket.on("audio-call-accept", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received audio-call-accept", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Mark both users as in a direct call
    const fromIdStr = String(socket.userId);
    const toIdStr = String(toUserId);
    userCallStatus[fromIdStr] = {
      inCall: true,
      callType: "direct",
      otherUserId: toIdStr,
    };
    userCallStatus[toIdStr] = {
      inCall: true,
      callType: "direct",
      otherUserId: fromIdStr,
    };

    forwardToUser("call-accepted", toUserId, {
      fromUserId: socket.userId,
    });
  });

  socket.on("audio-call-reject", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received audio-call-reject", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Clear call status for caller (call was rejected, so no call is active)
    const fromIdStr = String(socket.userId);
    delete userCallStatus[fromIdStr];

    forwardToUser("call-rejected", toUserId, {
      fromUserId: socket.userId,
    });
  });

  socket.on("message:reply-from-notification", (data) => {
    const { sourceId, senderName, replyText, notificationId } = data;
    console.log("[SIGNALLING] received message:reply-from-notification", {
      from: socket.userId,
      to: sourceId,
      replyLength: replyText?.length || 0,
    });

    if (!socket.userId || !sourceId || !replyText) return;

    // Send reply as a new message to the original sender
    const senderSocketId = getReceiverSocketId(sourceId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("notification-quick-reply", {
        repliedBy: socket.userId,
        repliedByName: senderName || "User",
        replyText,
        timestamp: new Date(),
      });
      console.log(
        `[SIGNALLING] Delivered quick reply from notification to user ${sourceId}`
      );
    }
  });

  socket.on("webrtc-offer", (data) => {
    const { toUserId, sdp } = data;
    console.log("[SIGNALLING] received webrtc-offer", {
      from: socket.userId,
      toUserId,
      hasSdp: !!sdp,
    });
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("webrtc-offer", toUserId, {
      fromUserId: socket.userId,
      sdp,
    });
  });

  socket.on("webrtc-answer", (data) => {
    const { toUserId, sdp } = data;
    console.log("[SIGNALLING] received webrtc-answer", {
      from: socket.userId,
      toUserId,
      hasSdp: !!sdp,
    });
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("webrtc-answer", toUserId, {
      fromUserId: socket.userId,
      sdp,
    });
  });

  socket.on("webrtc-ice", (data) => {
    const { toUserId, candidate } = data;
    console.log("[SIGNALLING] received webrtc-ice", {
      from: socket.userId,
      toUserId,
      hasCandidate: !!candidate,
    });
    if (!toUserId || !socket.userId) return;
    forwardToUser("webrtc-ice", toUserId, {
      fromUserId: socket.userId,
      candidate,
    });
  });

  socket.on("audio-call-end", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received audio-call-end", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Clear call status for both users
    const fromIdStr = String(socket.userId);
    const toIdStr = String(toUserId);
    delete userCallStatus[fromIdStr];
    delete userCallStatus[toIdStr];

    forwardToUser("call-ended", toUserId, {
      fromUserId: socket.userId,
    });
  });

  // ---------- WebRTC Video Call Signalling ----------
  socket.on("video-call-accept", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received video-call-accept", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Mark both users as in a direct call
    const fromIdStr = String(socket.userId);
    const toIdStr = String(toUserId);
    userCallStatus[fromIdStr] = {
      inCall: true,
      callType: "direct",
      otherUserId: toIdStr,
    };
    userCallStatus[toIdStr] = {
      inCall: true,
      callType: "direct",
      otherUserId: fromIdStr,
    };

    forwardToUser("video-call-accepted", toUserId, {
      fromUserId: socket.userId,
    });
  });

  socket.on("video-call-reject", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received video-call-reject", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Clear call status for caller (call was rejected, so no call is active)
    const fromIdStr = String(socket.userId);
    delete userCallStatus[fromIdStr];

    forwardToUser("video-call-rejected", toUserId, {
      fromUserId: socket.userId,
    });
  });

  socket.on("video-webrtc-offer", (data) => {
    const { toUserId, sdp } = data;
    console.log("[SIGNALLING] received video-webrtc-offer", {
      from: socket.userId,
      toUserId,
      hasSdp: !!sdp,
    });
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("video-webrtc-offer", toUserId, {
      fromUserId: socket.userId,
      sdp,
    });
  });

  socket.on("video-webrtc-answer", (data) => {
    const { toUserId, sdp } = data;
    console.log("[SIGNALLING] received video-webrtc-answer", {
      from: socket.userId,
      toUserId,
      hasSdp: !!sdp,
    });
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("video-webrtc-answer", toUserId, {
      fromUserId: socket.userId,
      sdp,
    });
  });

  socket.on("video-webrtc-ice", (data) => {
    const { toUserId, candidate } = data;
    console.log("[SIGNALLING] received video-webrtc-ice", {
      from: socket.userId,
      toUserId,
      hasCandidate: !!candidate,
    });
    if (!toUserId || !socket.userId) return;
    forwardToUser("video-webrtc-ice", toUserId, {
      fromUserId: socket.userId,
      candidate,
    });
  });

  socket.on("video-call-end", (data) => {
    const { toUserId } = data;
    console.log("[SIGNALLING] received video-call-end", {
      from: socket.userId,
      toUserId,
    });
    if (!toUserId || !socket.userId) return;

    // Clear call status for both users
    const fromIdStr = String(socket.userId);
    const toIdStr = String(toUserId);
    delete userCallStatus[fromIdStr];
    delete userCallStatus[toIdStr];

    forwardToUser("video-call-ended", toUserId, {
      fromUserId: socket.userId,
    });
  });

  // ---------- Group call WebRTC signalling ----------
  socket.on("group-call-webrtc-offer", (data) => {
    const { toUserId, channelId, sdp } = data;
    if (!toUserId || !socket.userId || !sdp) return;
    console.log("[SIGNALLING] group-call-webrtc-offer", {
      from: socket.userId,
      toUserId,
      channelId,
    });
    forwardToUser("group-call-webrtc-offer", toUserId, {
      fromUserId: socket.userId,
      channelId,
      sdp,
    });
  });

  socket.on("group-call-webrtc-answer", (data) => {
    const { toUserId, channelId, sdp } = data;
    if (!toUserId || !socket.userId || !sdp) return;
    console.log("[SIGNALLING] group-call-webrtc-answer", {
      from: socket.userId,
      toUserId,
      channelId,
    });
    forwardToUser("group-call-webrtc-answer", toUserId, {
      fromUserId: socket.userId,
      channelId,
      sdp,
    });
  });

  socket.on("group-call-webrtc-ice", (data) => {
    const { toUserId, channelId, candidate } = data;
    if (!toUserId || !socket.userId) return;
    console.log("[SIGNALLING] group-call-webrtc-ice", {
      from: socket.userId,
      toUserId,
      channelId,
    });
    forwardToUser("group-call-webrtc-ice", toUserId, {
      fromUserId: socket.userId,
      channelId,
      candidate,
    });
  });

  // ---------- Ephemeral meeting rooms (participants + chat) ----------
  socket.on("meeting-join", (data) => {
    const { meetingId, name } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    if (!activeMeetings[key]) activeMeetings[key] = {};

    activeMeetings[key][socket.userId] = {
      name: name || `User ${socket.userId}`,
    };

    socket.join(`meeting:${key}`);
    socket.meetingIds.add(key);

    const participants = serializeMeetingParticipants(activeMeetings[key]);

    io.to(`meeting:${key}`).emit("meeting-participants", {
      meetingId: key,
      participants,
    });

    const recordingState = activeMeetingRecordingState[key];
    if (recordingState?.isRecording) {
      socket.emit("meeting-recording-state", {
        meetingId: key,
        ...recordingState,
      });
    }
  });

  // Guest requests to join when meeting has lobby (open_to_everyone = false)
  socket.on("meeting-join-request", (data) => {
    const { meetingId, name } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    if (!meetingLobby[key]) meetingLobby[key] = [];
    const entry = { userId: socket.userId, name: name || `User ${socket.userId}`, socketId: socket.id };
    if (meetingLobby[key].some((e) => e.userId === socket.userId)) return;
    meetingLobby[key].push(entry);
    io.to(`meeting:${key}`).emit("meeting-lobby-request", {
      meetingId: key,
      userId: socket.userId,
      name: entry.name,
    });
  });

  // Host admits a user from the lobby
  socket.on("meeting-admit", (data) => {
    const { meetingId, userId: guestUserId } = data || {};
    if (!meetingId || !socket.userId || !guestUserId) return;
    const key = String(meetingId);
    const lobby = meetingLobby[key];
    if (!lobby) return;
    const idx = lobby.findIndex((e) => String(e.userId) === String(guestUserId));
    if (idx === -1) return;
    lobby.splice(idx, 1);
    if (lobby.length === 0) delete meetingLobby[key];
    io.to(`meeting:${key}`).emit("meeting-lobby-left", { meetingId: key, userId: guestUserId });
    forwardToUser("meeting-admitted", guestUserId, { meetingId: key });
  });

  socket.on("meeting-leave", (data) => {
    const { meetingId } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room) return;

    delete room[socket.userId];
    socket.leave(`meeting:${key}`);
    socket.meetingIds.delete(key);

    const participants = serializeMeetingParticipants(room);

    if (participants.length === 0) {
      delete activeMeetings[key];
      delete activeMeetingRecordingState[key];
    }

    io.to(`meeting:${key}`).emit("meeting-participants", {
      meetingId: key,
      participants,
    });
  });

  socket.on("meeting-message", (data) => {
    const { meetingId, message } = data || {};
    if (!meetingId || !socket.userId || !message || !message.content) return;
    const key = String(meetingId);
    if (!activeMeetings[key]) return;

    const safeMessage = {
      id:
        message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: socket.userId,
      name: message.name || activeMeetings[key][socket.userId]?.name || "User",
      content: String(message.content).slice(0, 1000),
      createdAt: message.createdAt || new Date().toISOString(),
    };

    io.to(`meeting:${key}`).emit("meeting-message", {
      meetingId: key,
      message: safeMessage,
    });
  });

  socket.on("meeting-end", (data) => {
    const { meetingId } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room) return;

    // Notify guests in lobby that meeting ended
    const lobby = meetingLobby[key];
    if (lobby) {
      lobby.forEach((e) => {
        io.to(e.socketId).emit("meeting-ended", { meetingId: key });
      });
      delete meetingLobby[key];
    }

    // Broadcast end, then clear room
    io.to(`meeting:${key}`).emit("meeting-ended", { meetingId: key });

    Object.keys(room).forEach((uid) => {
      const socketId = users[uid];
      if (socketId) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.leave(`meeting:${key}`);
          if (s.meetingIds && s.meetingIds.has(key)) {
            s.meetingIds.delete(key);
          }
        }
      }
    });

    delete activeMeetings[key];
    delete activeMeetingRecordingState[key];
  });

  // ---------- Meeting media-state broadcast (mute / video / hand raise) ----------
  socket.on("meeting-media-state", (data) => {
    const { meetingId, isMuted, isVideoOff } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room || !room[socket.userId]) return;
    // Store the state so late joiners can see it
    room[socket.userId].isMuted = !!isMuted;
    room[socket.userId].isVideoOff = !!isVideoOff;
    // Broadcast to others in the room
    socket.to(`meeting:${key}`).emit("meeting-media-state", {
      meetingId: key,
      userId: socket.userId,
      isMuted: !!isMuted,
      isVideoOff: !!isVideoOff,
    });
  });

  socket.on("meeting-hand-raise", (data) => {
    const { meetingId, raised, handRaised } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room || !room[socket.userId]) return;
    const nextHandRaised = !!(typeof handRaised === "boolean" ? handRaised : raised);
    room[socket.userId].handRaised = nextHandRaised;
    io.to(`meeting:${key}`).emit("meeting-hand-raise", {
      meetingId: key,
      userId: socket.userId,
      raised: nextHandRaised,
      handRaised: nextHandRaised,
    });
  });

  socket.on("meeting-recording-state", (data) => {
    const {
      meetingId,
      isRecording,
      startedAt,
      startedByName,
      startedByUserId,
    } = data || {};

    if (!meetingId || !socket.userId) return;

    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room || !room[socket.userId]) return;

    const nextState = {
      isRecording: !!isRecording,
      startedAt: startedAt || null,
      startedByName:
        startedByName || room[socket.userId]?.name || `User ${socket.userId}`,
      startedByUserId: String(startedByUserId || socket.userId),
      updatedAt: new Date().toISOString(),
    };

    if (nextState.isRecording) {
      activeMeetingRecordingState[key] = nextState;
    } else {
      delete activeMeetingRecordingState[key];
    }

    io.to(`meeting:${key}`).emit("meeting-recording-state", {
      meetingId: key,
      ...nextState,
    });
  });

  // ---------- Meeting screen sharing ----------
  socket.on("meeting-screen-share-start", (data) => {
    const { meetingId } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room) return;
    room[socket.userId].screenSharing = true;
    io.to(`meeting:${key}`).emit("meeting-screen-share-start", {
      meetingId: key,
      userId: socket.userId,
      name: room[socket.userId]?.name || "User",
    });
  });

  socket.on("meeting-screen-share-stop", (data) => {
    const { meetingId } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room) return;
    if (room[socket.userId]) room[socket.userId].screenSharing = false;
    io.to(`meeting:${key}`).emit("meeting-screen-share-stop", {
      meetingId: key,
      userId: socket.userId,
    });
  });

  // ---------- Meeting WebRTC signalling (mesh, 1:1 between participants) ----------
  socket.on("meeting-webrtc-offer", (data) => {
    const { meetingId, toUserId, sdp } = data;
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("meeting-webrtc-offer", toUserId, {
      fromUserId: socket.userId,
      meetingId,
      sdp,
    });
  });

  socket.on("meeting-webrtc-answer", (data) => {
    const { meetingId, toUserId, sdp } = data;
    if (!toUserId || !socket.userId || !sdp) return;
    forwardToUser("meeting-webrtc-answer", toUserId, {
      fromUserId: socket.userId,
      meetingId,
      sdp,
    });
  });

  socket.on("meeting-webrtc-ice", (data) => {
    const { meetingId, toUserId, candidate } = data;
    if (!toUserId || !socket.userId) return;
    forwardToUser("meeting-webrtc-ice", toUserId, {
      fromUserId: socket.userId,
      meetingId,
      candidate,
    });
  });

  // ---------- Ticket chat ----------
  socket.on("ticket-join", (data) => {
    const { ticketId } = data || {};
    if (!ticketId || !socket.userId) return;
    const room = `ticket:${ticketId}`;
    socket.join(room);
    console.log(`[TICKET] user ${socket.userId} joined ${room}`);
  });

  socket.on("ticket-leave", (data) => {
    const { ticketId } = data || {};
    if (!ticketId || !socket.userId) return;
    const room = `ticket:${ticketId}`;
    socket.leave(room);
    console.log(`[TICKET] user ${socket.userId} left ${room}`);
  });

  socket.on("ticket-message", (data) => {
    const { ticketId, message } = data || {};
    if (!ticketId || !socket.userId || !message) return;
    const room = `ticket:${ticketId}`;
    // Broadcast to all in the ticket room (including sender for confirmation)
    io.to(room).emit("ticket-new-message", { ticketId, message });
  });

  socket.on("ticket-typing", (data) => {
    const { ticketId, userName } = data || {};
    if (!ticketId || !socket.userId) return;
    const room = `ticket:${ticketId}`;
    socket.to(room).emit("ticket-typing", { ticketId, userId: socket.userId, userName });
  });



  // â"€â"€â"€ NEW: Document real-time collaboration â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  /**
   * Join a document editing session.
   * Payload: { docId, userName }
   * Broadcasts "doc-collaborators" to everyone in the room with name + color.
   */
  socket.on("doc-join", ({ docId, userName } = {}) => {
    if (!docId || !socket.userId) return;
    const room = `doc:${docId}`;
    socket.join(room);
    socket.documentIds.add(docId);

    if (!activeDocuments[docId]) activeDocuments[docId] = {};

    // Keep existing color if user is rejoining, assign new one otherwise
    const existing = activeDocuments[docId][socket.userId];
    const color = existing?.color || nextCollabColor();

    activeDocuments[docId][socket.userId] = {
      name: userName || `User ${socket.userId}`,
      color,
      socketId: socket.id,
    };

    const collaborators = _getDocCollaborators(docId);
    io.to(room).emit("doc-collaborators", { docId, collaborators });
    console.log(`[DOC] ${socket.userId} joined doc:${docId}`);
  });

  /**
   * Explicit leave from a document room.
   * Payload: { docId }
   */
  socket.on("doc-leave", ({ docId } = {}) => {
    if (!docId || !socket.userId) return;
    _leaveDocRoom(socket, docId);
  });

  /**
   * Broadcast content changes to all OTHER users in the room.
   * Payload: { docId, content (HTML string), version }
   * NOT echoed back to sender to avoid cursor-jump issues.
   */
  socket.on("doc-update", ({ docId, content, version } = {}) => {
    if (!docId || !socket.userId || content === undefined) return;
    // Cache the latest content so late joiners can get it via doc-request-state
    if (activeDocuments[docId]) {
      activeDocuments[docId]._latestContent = content;
      activeDocuments[docId]._version = version || Date.now();
    }
    socket.to(`doc:${docId}`).emit("doc-update", {
      docId,
      content,
      version: version || Date.now(),
      senderId: socket.userId,
    });
  });

  /**
   * Broadcast cursor / selection position to other users in the room.
   * Payload: { docId, cursor: { x, y } }
   */
  socket.on("doc-cursor", ({ docId, cursor } = {}) => {
    if (!docId || !socket.userId) return;
    const info = activeDocuments[docId]?.[socket.userId];
    socket.to(`doc:${docId}`).emit("doc-cursor", {
      docId,
      userId: socket.userId,
      name: info?.name || "User",
      color: info?.color || "#4f8ef7",
      cursor,
    });
  });

  /**
   * Typing indicator â€" broadcast to others in the same doc room.
   * Payload: { docId, userName, isTyping }
   */
  socket.on("doc-typing", ({ docId, userName, isTyping } = {}) => {
    if (!docId || !socket.userId) return;
    const info = activeDocuments[docId]?.[socket.userId];
    socket.to(`doc:${docId}`).emit("doc-typing", {
      docId,
      userId: socket.userId,
      userName: userName || info?.name || "User",
      color: info?.color || "#4f8ef7",
      isTyping: !!isTyping,
    });
  });

  /**
   * Late joiner requests the latest content snapshot from server memory.
   * Payload: { docId }
   * Emits "doc-full-state" back only to the requesting socket.
   */
  socket.on("doc-request-state", ({ docId } = {}) => {
    if (!docId || !socket.userId) return;
    const latest = activeDocuments[docId]?._latestContent;
    const version = activeDocuments[docId]?._version;
    if (latest !== undefined) {
      socket.emit("doc-full-state", { docId, content: latest, version });
    }
  });


  // Channel Chat: Typing Indicators
  socket.on("channel-typing-start", ({ channelId, userName } = {}) => {
    if (!channelId || !socket.userId) return;
    const room = `channel:${channelId}`;
    socket.to(room).emit("channel-user-typing", {
      channelId,
      userId: socket.userId,
      userName: userName || `User ${socket.userId}`,
      timestamp: Date.now(),
    });
    console.log(`[TYPING] User ${socket.userId} is typing in channel ${channelId}`);
  });

  socket.on("channel-typing-stop", ({ channelId } = {}) => {
    if (!channelId || !socket.userId) return;
    const room = `channel:${channelId}`;
    socket.to(room).emit("channel-user-stopped-typing", {
      channelId,
      userId: socket.userId,
      timestamp: Date.now(),
    });
  });

  // Channel Chat: Read Receipts
  socket.on("message-read", ({ channelId, messageId } = {}) => {
    if (!channelId || !messageId || !socket.userId) return;
    const room = `channel:${channelId}`;
    io.to(room).emit("message-read-receipt", {
      channelId,
      messageId,
      userId: socket.userId,
      timestamp: Date.now(),
    });
    console.log(`[READ RECEIPT] User ${socket.userId} read message ${messageId} in channel ${channelId}`);
  });

  // ============================================================
  // Phase 3: Message Status Indicators & Reaction Analytics
  // ============================================================

  // Message Delivery Status
  socket.on("message:delivered-client", ({ channelId, messageId } = {}) => {
    if (!channelId || !messageId || !socket.userId) return;
    const room = `channel:${channelId}`;
    io.to(room).emit("message:delivered", {
      message_id: messageId,
      delivered_to: socket.userId,
      delivered_at: new Date(),
      channel_id: channelId,
    });
    console.log(`[DELIVERY] User ${socket.userId} received message ${messageId} in channel ${channelId}`);
  });

  // Message Reaction Update (Reaction added)
  socket.on("message:reaction-add", ({ channelId, messageId, emoji } = {}) => {
    if (!channelId || !messageId || !emoji || !socket.userId) return;
    const room = `channel:${channelId}`;
    io.to(room).emit("message:reaction-added", {
      message_id: messageId,
      channel_id: channelId,
      user_id: socket.userId,
      emoji,
      reacted_at: new Date(),
    });
    console.log(`[REACTION] User ${socket.userId} reacted with ${emoji} to message ${messageId}`);
  });

  // Message Reaction Remove
  socket.on("message:reaction-remove", ({ channelId, messageId, emoji } = {}) => {
    if (!channelId || !messageId || !emoji || !socket.userId) return;
    const room = `channel:${channelId}`;
    io.to(room).emit("message:reaction-removed", {
      message_id: messageId,
      channel_id: channelId,
      user_id: socket.userId,
      emoji,
    });
    console.log(`[REACTION] User ${socket.userId} removed ${emoji} reaction from message ${messageId}`);
  });

  // ============================================================
  // Remote Support Session Events
  // ============================================================

  /**
   * Customer requests remote support
   * Payload: { session_id, customer_name }
   * Broadcast to all agents: 'support:new-request'
   */
  socket.on("remote:session-request", ({ session_id, customer_name } = {}) => {
    if (!session_id || !socket.userId) return;
    console.log(`[REMOTE SUPPORT] Customer ${socket.userId} requested support - Session: ${session_id}`);

    // Broadcast to all agents (in production, filter by role)
    io.emit("support:new-request", {
      session_id,
      customer_id: socket.userId,
      customer_name: customer_name || `User ${socket.userId}`,
      timestamp: new Date(),
    });
  });

  /**
   * Agent accepts/joins remote support session
   * Payload: { session_id, agent_name }
   * Broadcast to customer: 'support:agent-joined'
   */
  socket.on("remote:session-accept", ({ session_id, agent_name } = {}) => {
    if (!session_id || !socket.userId) return;
    console.log(`[REMOTE SUPPORT] Agent ${socket.userId} accepted session - Session: ${session_id}`);

    const room = `remote-session:${session_id}`;
    socket.join(room);

    io.to(room).emit("support:agent-joined", {
      session_id,
      agent_id: socket.userId,
      agent_name: agent_name || `Agent ${socket.userId}`,
      timestamp: new Date(),
    });
  });

  /**
   * WebRTC Offer - Initial peer connection setup
   * Payload: { session_id, sdp }
   */
  socket.on("remote:webrtc-offer", ({ session_id, sdp } = {}) => {
    if (!session_id || !sdp || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] User ${socket.userId} sending WebRTC offer for session ${session_id}`);

    socket.to(room).emit("remote:webrtc-offer", {
      session_id,
      from_user_id: socket.userId,
      sdp,
    });
  });

  /**
   * WebRTC Answer - Peer connection setup response
   * Payload: { session_id, sdp }
   */
  socket.on("remote:webrtc-answer", ({ session_id, sdp } = {}) => {
    if (!session_id || !sdp || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] User ${socket.userId} sending WebRTC answer for session ${session_id}`);

    socket.to(room).emit("remote:webrtc-answer", {
      session_id,
      from_user_id: socket.userId,
      sdp,
    });
  });

  /**
   * ICE Candidate - Network connectivity info
   * Payload: { session_id, candidate }
   */
  socket.on("remote:ice-candidate", ({ session_id, candidate } = {}) => {
    if (!session_id || !candidate || !socket.userId) return;
    const room = `remote-session:${session_id}`;

    socket.to(room).emit("remote:ice-candidate", {
      session_id,
      from_user_id: socket.userId,
      candidate,
    });
  });

  /**
   * Agent requests remote control permission
   * Payload: { session_id }
   * Broadcast to customer: 'support:control-request'
   */
  socket.on("remote:control-request", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] Agent ${socket.userId} requested remote control - Session: ${session_id}`);

    io.to(room).emit("support:control-request", {
      session_id,
      agent_id: socket.userId,
      timestamp: new Date(),
    });
  });

  /**
   * Customer approves remote control
   * Payload: { session_id }
   * Broadcast to agent: 'support:control-approved'
   */
  socket.on("remote:control-approve", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] Customer approved remote control - Session: ${session_id}`);

    io.to(room).emit("support:control-approved", {
      session_id,
      timestamp: new Date(),
    });
  });

  /**
   * Customer denies remote control
   * Payload: { session_id }
   * Broadcast to agent: 'support:control-denied'
   */
  socket.on("remote:control-deny", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] Customer denied remote control - Session: ${session_id}`);

    io.to(room).emit("support:control-denied", {
      session_id,
      timestamp: new Date(),
    });
  });

  /**
   * Agent sends mouse/keyboard input (when remote control is approved)
   * Payload: { session_id, x, y, type, key, ... }
   */
  socket.on("remote:input", ({ session_id, type, x, y, key, ctrlKey, shiftKey, altKey } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;

    // Rate limit: log every 100th event to avoid spam
    if (Math.random() < 0.01) {
      console.log(`[REMOTE SUPPORT] Remote input from agent - Type: ${type}, Session: ${session_id}`);
    }

    socket.to(room).emit("remote:input", {
      session_id,
      type,
      x,
      y,
      key,
      ctrlKey,
      shiftKey,
      altKey,
      timestamp: Date.now(),
    });
  });

  /**
   * Revoke remote control
   * Payload: { session_id }
   * Broadcast to both parties: 'support:control-revoked'
   */
  socket.on("remote:control-revoke", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] Remote control revoked - Session: ${session_id}`);

    io.to(room).emit("support:control-revoked", {
      session_id,
      revoked_by: socket.userId,
      timestamp: new Date(),
    });
  });

  /**
   * Session chat message (within remote support session)
   * Payload: { session_id, message }
   */
  socket.on("remote:message", ({ session_id, message } = {}) => {
    if (!session_id || !message || !socket.userId) return;
    const room = `remote-session:${session_id}`;

    io.to(room).emit("remote:message", {
      session_id,
      user_id: socket.userId,
      message,
      timestamp: new Date(),
    });
  });

  /**
   * Leave/end remote support session
   * Payload: { session_id }
   * Broadcast: 'support:session-ended'
   */
  socket.on("remote:session-end", ({ session_id, reason } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] Session ending - Session: ${session_id}, Reason: ${reason}`);

    socket.leave(room);
    io.to(room).emit("support:session-ended", {
      session_id,
      ended_by: socket.userId,
      reason: reason || "Session ended",
      timestamp: new Date(),
    });
  });

  // ========== NOTIFICATION SOCKET EVENTS ==========

  /**
   * Client marks notification as read
   * Payload: { notification_id }
   */
  socket.on("notification:mark-read", async (data) => {
    try {
      const { notification_id } = data;
      if (!notification_id || !socket.userId) return;

      console.log(`[NOTIFICATION] User ${socket.userId} marking ${notification_id} as read`);

      // Handler will be in notification controller
      // This is just forwarding to client-side handler
      socket.emit("notification:read-confirmed", { notification_id });
    } catch (error) {
      console.error("[NOTIFICATION] mark-read error:", error.message);
    }
  });

  /**
   * Client marks all notifications as read
   * Server will update DB, client updates UI optimistically
   */
  socket.on("notification:mark-all-read", async (data) => {
    try {
      if (!socket.userId) return;

      console.log(`[NOTIFICATION] User ${socket.userId} marking all notifications as read`);

      socket.emit("notification:all-read-confirmed", {});
    } catch (error) {
      console.error("[NOTIFICATION] mark-all-read error:", error.message);
    }
  });

  /**
   * Client archives a notification
   * Payload: { notification_id }
   */
  socket.on("notification:archive", async (data) => {
    try {
      const { notification_id } = data;
      if (!notification_id || !socket.userId) return;

      console.log(`[NOTIFICATION] User ${socket.userId} archiving ${notification_id}`);

      socket.emit("notification:archived-confirmed", { notification_id });
    } catch (error) {
      console.error("[NOTIFICATION] archive error:", error.message);
    }
  });

  /**
   * Client preference updated
   * Server broadcasts updated preferences via separate HTTP endpoint
   */
  socket.on("notification-preferences:updated", async (data) => {
    try {
      if (!socket.userId) return;

      console.log(`[NOTIFICATION] User ${socket.userId} updated preferences`, data);

      // Confirmation sent back
      socket.emit("notification-preferences:update-confirmed", data);
    } catch (error) {
      console.error("[NOTIFICATION] preferences update error:", error.message);
    }
  });

  // Disconnect Handler
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  /**
   * ===== ADDITIONAL REMOTE SUPPORT EVENTS FOR ELECTRON/WINDOWS =====
   */

  /**
   * Host joins session room (when accepting request)
   * Triggered after backend POST /sessions/:id/accept
   * Payload: { session_id, access_token }
   */
  socket.on("remote:join-session", ({ session_id, access_token } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[REMOTE SUPPORT] User ${socket.userId} joining session room: ${session_id}`);
    
    socket.join(room);
    
    // Notify both parties that session is now active
    io.to(room).emit("session:ready", {
      session_id,
      user_id: socket.userId,
      timestamp: new Date(),
    });
  });

  /**
   * Binary frame streaming (Host -> Requester)
   * Payload: { session_id, frame_number, data (Buffer/ArrayBuffer), width, height, fps }
   * Rate limited - emits one frame at a time
   */
  socket.on("stream:send-frame", ({ session_id, frame_number, data, width, height, fps } = {}) => {
    if (!session_id || !data || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    
    // Only log every 300th frame to avoid spam (10s at 30fps)
    if (frame_number % 300 === 0) {
      console.log(`[STREAM] Frame ${frame_number} sent for session ${session_id}`);
    }
    
    socket.to(room).emit("stream:frame", {
      session_id,
      frame_number,
      data, // Binary data (H.264 encoded frame)
      width,
      height,
      fps,
      timestamp: Date.now(),
    });
  });

  /**
   * Stream started notification
   * Payload: { session_id, resolution, fps, codec }
   */
  socket.on("stream:started", ({ session_id, resolution, fps, codec } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[STREAM] Stream started for session ${session_id} - ${resolution} @ ${fps}fps ${codec}`);
    
    io.to(room).emit("stream:started", {
      session_id,
      resolution,
      fps,
      codec,
      timestamp: new Date(),
    });
  });

  /**
   * Stream stopped notification
   * Payload: { session_id, reason }
   */
  socket.on("stream:ended", ({ session_id, reason } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[STREAM] Stream ended for session ${session_id} - Reason: ${reason}`);
    
    io.to(room).emit("stream:ended", {
      session_id,
      reason: reason || "Stream ended",
      timestamp: new Date(),
    });
  });

  /**
   * Stream error notification
   * Payload: { session_id, error }
   */
  socket.on("stream:error", ({ session_id, error } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.error(`[STREAM] Stream error for session ${session_id}: ${error}`);
    
    io.to(room).emit("stream:error", {
      session_id,
      error,
      timestamp: new Date(),
    });
  });

  /**
   * Session notification: Approved by host
   * Payload: { session_id, access_token }
   * Sent to: Requester
   */
  socket.on("session:approved", ({ session_id, access_token } = {}) => {
    if (!session_id || !socket.userId) return;
    // This is typically sent server-side via broadcastRemoteSupportEvent
    // But keeping for completeness if client needs to notify
    console.log(`[SESSION] Session ${session_id} approved notification`);
  });

  /**
   * Session notification: Rejected by host
   * Payload: { session_id, reason }
   * Sent to: Requester
   */
  socket.on("session:rejected", ({ session_id, reason } = {}) => {
    if (!session_id || !socket.userId) return;
    console.log(`[SESSION] Session ${session_id} rejected - Reason: ${reason}`);
  });

  /**
   * Recording started notification
   * Payload: { session_id }
   * Broadcast to both parties
   */
  socket.on("recording:started", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[RECORDING] Recording started for session ${session_id}`);
    
    io.to(room).emit("recording:started", {
      session_id,
      timestamp: new Date(),
    });
  });

  /**
   * Recording stopped notification
   * Payload: { session_id }
   * Broadcast to both parties
   */
  socket.on("recording:stopped", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[RECORDING] Recording stopped for session ${session_id}`);
    
    io.to(room).emit("recording:stopped", {
      session_id,
      ended_at: new Date(),
      timestamp: new Date(),
    });
  });

  /**
   * Remote session metrics update
   * Payload: { session_id, frame_latency_ms, frames_dropped, bandwidth_kbps }
   * Logged for analytics
   */
  socket.on("session:metrics", ({ session_id, frame_latency_ms, frames_dropped, bandwidth_kbps } = {}) => {
    if (!session_id || !socket.userId) return;

    // Only log occasionally to avoid spam
    if (Math.random() < 0.05) {
      console.log(`[METRICS] Session ${session_id} - Latency: ${frame_latency_ms}ms, Dropped: ${frames_dropped}, BW: ${bandwidth_kbps}kbps`);
    }
  });

  /**
   * Remote control request notification
   * Payload: { session_id }
   * Sent to: Host
   */
  socket.on("control:request-sent", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[CONTROL] Remote control requested for session ${session_id}`);

    socket.to(room).emit("control:request", {
      session_id,
      requester_id: socket.userId,
      timestamp: new Date(),
    });
  });

  /**
   * Remote control approved notification
   * Payload: { session_id }
   * Sent to: Requester
   */
  socket.on("control:approved-sent", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[CONTROL] Remote control approved for session ${session_id}`);

    socket.to(room).emit("control:approved", {
      session_id,
      approved_at: new Date(),
      timestamp: new Date(),
    });
  });

  /**
   * Remote control denied notification
   * Payload: { session_id }
   * Sent to: Requester
   */
  socket.on("control:denied-sent", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[CONTROL] Remote control denied for session ${session_id}`);

    socket.to(room).emit("control:denied", {
      session_id,
      timestamp: new Date(),
    });
  });

  /**
   * Remote control revoked notification
   * Payload: { session_id }
   * Sent to: Requester
   */
  socket.on("control:revoked-sent", ({ session_id } = {}) => {
    if (!session_id || !socket.userId) return;
    const room = `remote-session:${session_id}`;
    console.log(`[CONTROL] Remote control revoked for session ${session_id}`);

    socket.to(room).emit("control:revoked", {
      session_id,
      timestamp: new Date(),
    });
  });

  /**
   * Remote input injection (Requester -> Host)
   * Payload: { session_id, type: "mouse_move"|"mouse_click"|"key_down"|"key_up", x, y, key, keyCode }
   * Sent only when control is approved
   */
  socket.on("remote:input", ({ session_id, type, x, y, key, keyCode } = {}) => {
    if (!session_id || !type || !socket.userId) return;
    const room = `remote-session:${session_id}`;

    // Only log mouse clicks and key presses, not movement
    if (type !== "mouse_move") {
      console.log(`[INPUT] ${type} for session ${session_id}`);
    }

    socket.to(room).emit("remote:input", {
      session_id,
      type,
      x,
      y,
      key,
      keyCode,
      timestamp: Date.now(),
    });
  });

  /**
   * Handle chat reply from notification
   * User replies directly from system notification
   */
  socket.on("chat:send-reply-from-notification", async ({ replyText, senderUserId, notificationId, metadata } = {}) => {
    if (!replyText || !socket.userId || !notificationId) {
      console.log("[CHAT_REPLY] Missing required fields");
      socket.emit("chat:reply-error", { error: "Missing required fields" });
      return;
    }

    try {
      console.log("[CHAT_REPLY] 💬 Processing reply from notification:", {
        replyText: replyText.substring(0, 50),
        notificationId,
        senderUserId,
      });

      // Find the original notification to get channel_id
      const notification = await Notification.findById(notificationId);
      if (!notification || !notification.channel_id) {
        console.warn("[CHAT_REPLY] ⚠️ Notification or channel not found");
        socket.emit("chat:reply-error", { error: "Channel not found" });
        return;
      }

      // Get the channel to check if it's direct or group
      const channel = await ChatChannel.findById(notification.channel_id);
      if (!channel) {
        console.warn("[CHAT_REPLY] ⚠️ Channel not found");
        socket.emit("chat:reply-error", { error: "Channel not found" });
        return;
      }

      // Create the reply message
      const replyMessage = new Message({
        channel_id: notification.channel_id,
        sender_id: socket.userId,
        content: replyText,
        message_type: "text",
        parent_message_id: null,
      });

      await replyMessage.save();

      // Populate sender info
      const populatedMessage = await Message.findById(replyMessage._id)
        .populate("sender_id", "first_name last_name email user_type profile_picture")
        .lean();

      console.log("[CHAT_REPLY] ✅ Reply message created:", replyMessage._id);

      // Send message back to sender immediately (so they see it in their UI)
      socket.emit("new_message", {
        ...populatedMessage,
        channel_id: notification.channel_id,
      });
      console.log("[CHAT_REPLY] ✅ Sent message back to sender");

      // For direct chats: send to both users directly
      if (channel.channel_type === "direct") {
        console.log("[CHAT_REPLY] Direct chat detected - sending to both users");

        // Get all members of this channel
        const channelMembers = await ChannelMember.find({
          channel_id: notification.channel_id,
        });

        // Find the other user in the direct chat
        const otherMember = channelMembers.find(
          (m) => String(m.user_id) !== String(socket.userId)
        );

        if (otherMember) {
          const otherUserSocketId = getReceiverSocketId(otherMember.user_id);
          console.log("[CHAT_REPLY] Sending to other user:", {
            userId: otherMember.user_id,
            socketId: otherUserSocketId,
          });

          if (otherUserSocketId) {
            // Send to the other user
            io.to(otherUserSocketId).emit("new_message", {
              ...populatedMessage,
              channel_id: notification.channel_id,
            });
            console.log("[CHAT_REPLY] ✅ Sent to receiver via socket ID");
          }
        }
      }

      // ALSO broadcast to the channel room (for users in the room)
      io.to(`channel:${notification.channel_id}`).emit("message:new", {
        message: populatedMessage,
      });
      console.log("[CHAT_REPLY] ✅ Broadcasted to channel room");

      // Notify sender of success
      socket.emit("chat:reply-sent", {
        notificationId,
        messageId: replyMessage._id,
        success: true,
      });

      console.log("[CHAT_REPLY] ✅ Reply sent and broadcasted");
    } catch (error) {
      console.error("[CHAT_REPLY] ❌ Error processing reply:", error.message);
      socket.emit("chat:reply-error", {
        notificationId,
        error: error.message,
      });
    }
  });

  socket.on("call:accept", ({ callId, callType } = {}) => {
    console.log(`[CALL_ACCEPT] ☎️ Call accepted event received`);
    console.log(`[CALL_ACCEPT] Details:`, { callId, callType, acceptedBy: socket.userId });

    if (!callId || !socket.userId) {
      console.warn("[CALL_ACCEPT] ❌ Missing callId or userId", { callId, userId: socket.userId });
      return;
    }

    try {
      // callId should be the caller's user ID
      const callerSocketId = getReceiverSocketId(callId);
      console.log(`[CALL_ACCEPT] Caller socket lookup:`, { callId, callerSocketId });

      if (callerSocketId) {
        // Emit the correct event name that the LiveKit hooks listen for
        const acceptEventName = callType === "video" ? "video-call-accepted" : "call-accepted";
        console.log(`[CALL_ACCEPT] 📤 Sending ${acceptEventName} to caller ${callId}`);
        io.to(callerSocketId).emit(acceptEventName, {
          fromUserId: socket.userId,
          acceptedBy: socket.userId,
          callType,
          timestamp: new Date(),
        });
        console.log(`[CALL_ACCEPT] ✅ ${acceptEventName} emitted successfully`);
      } else {
        console.warn(`[CALL_ACCEPT] ⚠️ Caller not online: ${callId}`);
      }
    } catch (error) {
      console.error(`[CALL_ACCEPT] ❌ Error:`, error.message);
    }
  });

  socket.on("call:reject-and-dismiss", ({ callId, callType, notificationId } = {}) => {
    console.log(`[CALL_REJECT] 🚫 Call reject event received`);
    console.log(`[CALL_REJECT] Details:`, { callId, callType, rejectedBy: socket.userId, notificationId });

    if (!callId || !socket.userId) {
      console.warn("[CALL_REJECT] ❌ Missing callId or userId", { callId, userId: socket.userId });
      return;
    }

    try {
      // callId should be the caller's user ID
      const callerSocketId = getReceiverSocketId(callId);
      console.log(`[CALL_REJECT] Caller socket lookup:`, { callId, callerSocketId });

      if (callerSocketId) {
        // Emit the correct event name that the LiveKit hooks listen for
        const rejectEventName = callType === "video" ? "video-call-rejected" : "call-rejected";
        console.log(`[CALL_REJECT] 📤 Sending ${rejectEventName} to caller ${callId}`);
        io.to(callerSocketId).emit(rejectEventName, {
          fromUserId: socket.userId, // The receiver's ID (for hook to match with remoteUser.id)
          rejectedBy: socket.userId,
          callType,
          timestamp: new Date(),
        });
        console.log(`[CALL_REJECT] ✅ ${rejectEventName} emitted successfully`);
      } else {
        console.warn(`[CALL_REJECT] ⚠️ Caller not online: ${callId}`);
      }

      // Delete the notification from DB if it exists
      if (notificationId) {
        console.log(`[CALL_REJECT] Attempting to delete notification: ${notificationId}`);
        // This is async but we don't wait for it
        Notification.deleteOne({ _id: notificationId }).catch((err) =>
          console.warn("[CALL_REJECT] Failed to delete notification:", err.message)
        );
      }
    } catch (error) {
      console.error(`[CALL_REJECT] ❌ Error:`, error.message);
    }
  });

  socket.on("join-channel", ({ channel_id } = {}) => {
    if (!channel_id) {
      console.warn("[CHANNEL] Missing channel_id for join event");
      return;
    }

    const room = `channel:${channel_id}`;
    socket.join(room);
    console.log(`[CHANNEL] ${socket.userId} joined room: ${room}`);
  });

  socket.on("leave-channel", ({ channel_id } = {}) => {
    if (!channel_id) {
      console.warn("[CHANNEL] Missing channel_id for leave event");
      return;
    }

    const room = `channel:${channel_id}`;
    socket.leave(room);
    console.log(`[CHANNEL] ${socket.userId} left room: ${room}`);
  });

  socket.on("disconnect", () => {
    const normalizedUserId = socket.userId;
    if (normalizedUserId) {
      // This prevents a reconnecting user's new socket from being deleted
      // when the old socket's disconnect event fires after the new one registered.
      if (users[normalizedUserId] === socket.id) {
        delete users[normalizedUserId];

        // Remove user from online set only if no active socket remains
        onlineUsers.delete(normalizedUserId);
        console.log(`[ONLINE STATUS] User went offline: ${normalizedUserId}`);

        // Clear call status when user disconnects
        delete userCallStatus[normalizedUserId];

        // Remove user from any active meeting rooms
        if (socket.meetingIds && socket.meetingIds.size > 0) {
          socket.meetingIds.forEach((meetingId) => {
            const room = activeMeetings[meetingId];
            if (!room) return;
            delete room[normalizedUserId];
            const participants = serializeMeetingParticipants(room);
            if (participants.length === 0) {
              delete activeMeetings[meetingId];
              delete activeMeetingRecordingState[meetingId];
            } else {
              io.to(`meeting:${meetingId}`).emit("meeting-participants", {
                meetingId,
                participants,
              });
            }
          });
        }

        // Remove user from any meeting lobby
        Object.keys(meetingLobby).forEach((key) => {
          meetingLobby[key] = meetingLobby[key].filter(
            (e) => String(e.userId) !== String(normalizedUserId)
          );
          if (meetingLobby[key].length === 0) delete meetingLobby[key];
        });

        // NEW â"€ Remove user from any active document rooms on disconnect
        if (socket.documentIds && socket.documentIds.size > 0) {
          socket.documentIds.forEach((docId) => {
            _leaveDocRoom(socket, docId);
          });
        }

        // Broadcast updated online users list
        broadcastOnlineUsers();
      } else {
        console.log(
          `[ONLINE STATUS] Stale socket disconnect ignored for ${normalizedUserId} (old=${socket.id}, current=${users[normalizedUserId]})`
        );
      }
    }
  });
});


function _getDocCollaborators(docId) {
  if (!activeDocuments[docId]) return [];
  return Object.entries(activeDocuments[docId])
    .filter(([key]) => !key.startsWith("_")) // exclude _latestContent, _version
    .map(([userId, info]) => ({
      userId,
      name: info.name,
      color: info.color,
    }));
}

function _leaveDocRoom(socket, docId) {
  const room = `doc:${docId}`;
  socket.leave(room);
  socket.documentIds?.delete(docId);
  if (activeDocuments[docId]) {
    delete activeDocuments[docId][socket.userId];
    const collaborators = _getDocCollaborators(docId);
    // Intentionally keep _latestContent & _version cached even if room is empty
    // so the very next person to open this doc gets the latest in-memory version
    io.to(room).emit("doc-collaborators", { docId, collaborators });
  }
  console.log(`[DOC] ${socket.userId} left doc:${docId}`);
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const getReceiverSocketId = (receiverId) => {
  const normalized = receiverId?.toString?.() ?? receiverId;
  return users[normalized];
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers);
};

export const getUserCallStatus = (userId) => {
  const userIdStr = String(userId);
  return userCallStatus[userIdStr] || { inCall: false };
};

export const setUserCallStatus = (userId, status) => {
  const userIdStr = String(userId);
  userCallStatus[userIdStr] = status;
};

export const clearUserCallStatus = (userId) => {
  const userIdStr = String(userId);
  delete userCallStatus[userIdStr];
};

// Broadcast meeting events to all connected clients (for real-time sync)
export function broadcastMeetingEvent(event, meeting) {
  io.emit("meeting-sync", { event, meeting });
}

// Broadcast remote support session events
export function broadcastRemoteSupportEvent(event, sessionId, data) {
  const room = `remote-session:${sessionId}`;
  io.to(room).emit(`support:${event}`, {
    session_id: sessionId,
    ...data,
    timestamp: new Date(),
  });
}

export { app, server, io };
