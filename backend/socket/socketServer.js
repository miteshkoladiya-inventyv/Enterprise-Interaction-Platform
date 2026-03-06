// import { Server } from "socket.io";
// import express from "express";
// import { createServer } from "http";

// const app = express();
// const server = createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:3000"],
//     credentials: true,
//   },
// });

// const users = {};
// const onlineUsers = new Set(); // Track online users
// // Track users in calls: userId -> { inCall: boolean, callType: 'direct' | 'group', otherUserId?: string, channelId?: string }
// const userCallStatus = {};
// // Track active meeting rooms in memory: meetingId -> { [userId]: { name } }
// const activeMeetings = {};
// // Lobby for meetings with open_to_everyone=false: meetingId -> [{ userId, name, socketId }]
// const meetingLobby = {};
// // Track active whiteboard sessions: whiteboardId -> { [userId]: { name, socketId } }
// const activeWhiteboards = {};

// function forwardToUser(eventName, toUserId, payload) {
//   const normalizedTo = toUserId?.toString?.() ?? toUserId;
//   const socketId = users[normalizedTo];
//   console.log(
//     `[SIGNALLING] forward "${eventName}" to userId=${normalizedTo} -> socketId=${
//       socketId || "NOT FOUND"
//     } | users map:`,
//     Object.keys(users)
//   );
//   if (socketId) {
//     io.to(socketId).emit(eventName, payload);
//   }
// }

// // Broadcast online users to all connected clients
// function broadcastOnlineUsers() {
//   const onlineUsersList = Array.from(onlineUsers);
//   io.emit("online-users-updated", { onlineUsers: onlineUsersList });
//   console.log(`[ONLINE STATUS] Broadcasting online users:`, onlineUsersList);
// }

// io.on("connection", async (socket) => {
//   console.log(`Socket connected: ${socket.id}`);
//   socket.meetingIds = new Set();

//   socket.on("message", (msg) => {
//     console.log("Message received:", msg);
//   });

//   const userId = socket.handshake.auth.userId;
//   const normalizedUserId = userId?.toString?.() ?? userId;

//   if (normalizedUserId) {
//     users[normalizedUserId] = socket.id;
//     socket.userId = normalizedUserId;

//     // Add user to online set
//     onlineUsers.add(normalizedUserId);
//     console.log(
//       `[SIGNALLING] user registered: userId=${normalizedUserId} -> socketId=${socket.id}`
//     );
//     console.log(`[ONLINE STATUS] User came online: ${normalizedUserId}`);

//     // Broadcast updated online users list
//     broadcastOnlineUsers();
//   }

//   // Send current online users to this socket on request
//   socket.on("request-online-users", () => {
//     const onlineUsersList = Array.from(onlineUsers);
//     socket.emit("online-users-updated", { onlineUsers: onlineUsersList });
//   });

//   // ---------- WebRTC Audio Call Signalling ----------
//   socket.on("audio-call-request", (data) => {
//     const { toUserId, fromUserName } = data;
//     console.log("[SIGNALLING] received audio-call-request", {
//       from: socket.userId,
//       toUserId,
//       fromUserName,
//     });
//     if (!toUserId || !socket.userId) return;
//     forwardToUser("incoming-audio-call", toUserId, {
//       fromUserId: socket.userId,
//       fromUserName: fromUserName || "Someone",
//     });
//   });

//   socket.on("audio-call-accept", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received audio-call-accept", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Mark both users as in a direct call
//     const fromIdStr = String(socket.userId);
//     const toIdStr = String(toUserId);
//     userCallStatus[fromIdStr] = {
//       inCall: true,
//       callType: "direct",
//       otherUserId: toIdStr,
//     };
//     userCallStatus[toIdStr] = {
//       inCall: true,
//       callType: "direct",
//       otherUserId: fromIdStr,
//     };

//     forwardToUser("call-accepted", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   socket.on("audio-call-reject", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received audio-call-reject", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Clear call status for caller (call was rejected, so no call is active)
//     const fromIdStr = String(socket.userId);
//     delete userCallStatus[fromIdStr];

//     forwardToUser("call-rejected", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   socket.on("webrtc-offer", (data) => {
//     const { toUserId, sdp } = data;
//     console.log("[SIGNALLING] received webrtc-offer", {
//       from: socket.userId,
//       toUserId,
//       hasSdp: !!sdp,
//     });
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("webrtc-offer", toUserId, {
//       fromUserId: socket.userId,
//       sdp,
//     });
//   });

//   socket.on("webrtc-answer", (data) => {
//     const { toUserId, sdp } = data;
//     console.log("[SIGNALLING] received webrtc-answer", {
//       from: socket.userId,
//       toUserId,
//       hasSdp: !!sdp,
//     });
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("webrtc-answer", toUserId, {
//       fromUserId: socket.userId,
//       sdp,
//     });
//   });

//   socket.on("webrtc-ice", (data) => {
//     const { toUserId, candidate } = data;
//     console.log("[SIGNALLING] received webrtc-ice", {
//       from: socket.userId,
//       toUserId,
//       hasCandidate: !!candidate,
//     });
//     if (!toUserId || !socket.userId) return;
//     forwardToUser("webrtc-ice", toUserId, {
//       fromUserId: socket.userId,
//       candidate,
//     });
//   });

//   socket.on("audio-call-end", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received audio-call-end", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Clear call status for both users
//     const fromIdStr = String(socket.userId);
//     const toIdStr = String(toUserId);
//     delete userCallStatus[fromIdStr];
//     delete userCallStatus[toIdStr];

//     forwardToUser("call-ended", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   // ---------- WebRTC Video Call Signalling ----------
//   socket.on("video-call-accept", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received video-call-accept", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Mark both users as in a direct call
//     const fromIdStr = String(socket.userId);
//     const toIdStr = String(toUserId);
//     userCallStatus[fromIdStr] = {
//       inCall: true,
//       callType: "direct",
//       otherUserId: toIdStr,
//     };
//     userCallStatus[toIdStr] = {
//       inCall: true,
//       callType: "direct",
//       otherUserId: fromIdStr,
//     };

//     forwardToUser("video-call-accepted", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   socket.on("video-call-reject", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received video-call-reject", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Clear call status for caller (call was rejected, so no call is active)
//     const fromIdStr = String(socket.userId);
//     delete userCallStatus[fromIdStr];

//     forwardToUser("video-call-rejected", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   socket.on("video-webrtc-offer", (data) => {
//     const { toUserId, sdp } = data;
//     console.log("[SIGNALLING] received video-webrtc-offer", {
//       from: socket.userId,
//       toUserId,
//       hasSdp: !!sdp,
//     });
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("video-webrtc-offer", toUserId, {
//       fromUserId: socket.userId,
//       sdp,
//     });
//   });

//   socket.on("video-webrtc-answer", (data) => {
//     const { toUserId, sdp } = data;
//     console.log("[SIGNALLING] received video-webrtc-answer", {
//       from: socket.userId,
//       toUserId,
//       hasSdp: !!sdp,
//     });
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("video-webrtc-answer", toUserId, {
//       fromUserId: socket.userId,
//       sdp,
//     });
//   });

//   socket.on("video-webrtc-ice", (data) => {
//     const { toUserId, candidate } = data;
//     console.log("[SIGNALLING] received video-webrtc-ice", {
//       from: socket.userId,
//       toUserId,
//       hasCandidate: !!candidate,
//     });
//     if (!toUserId || !socket.userId) return;
//     forwardToUser("video-webrtc-ice", toUserId, {
//       fromUserId: socket.userId,
//       candidate,
//     });
//   });

//   socket.on("video-call-end", (data) => {
//     const { toUserId } = data;
//     console.log("[SIGNALLING] received video-call-end", {
//       from: socket.userId,
//       toUserId,
//     });
//     if (!toUserId || !socket.userId) return;

//     // Clear call status for both users
//     const fromIdStr = String(socket.userId);
//     const toIdStr = String(toUserId);
//     delete userCallStatus[fromIdStr];
//     delete userCallStatus[toIdStr];

//     forwardToUser("video-call-ended", toUserId, {
//       fromUserId: socket.userId,
//     });
//   });

//   // ---------- Group call WebRTC signalling ----------
//   socket.on("group-call-webrtc-offer", (data) => {
//     const { toUserId, channelId, sdp } = data;
//     if (!toUserId || !socket.userId || !sdp) return;
//     console.log("[SIGNALLING] group-call-webrtc-offer", {
//       from: socket.userId,
//       toUserId,
//       channelId,
//     });
//     forwardToUser("group-call-webrtc-offer", toUserId, {
//       fromUserId: socket.userId,
//       channelId,
//       sdp,
//     });
//   });

//   socket.on("group-call-webrtc-answer", (data) => {
//     const { toUserId, channelId, sdp } = data;
//     if (!toUserId || !socket.userId || !sdp) return;
//     console.log("[SIGNALLING] group-call-webrtc-answer", {
//       from: socket.userId,
//       toUserId,
//       channelId,
//     });
//     forwardToUser("group-call-webrtc-answer", toUserId, {
//       fromUserId: socket.userId,
//       channelId,
//       sdp,
//     });
//   });

//   socket.on("group-call-webrtc-ice", (data) => {
//     const { toUserId, channelId, candidate } = data;
//     if (!toUserId || !socket.userId) return;
//     console.log("[SIGNALLING] group-call-webrtc-ice", {
//       from: socket.userId,
//       toUserId,
//       channelId,
//     });
//     forwardToUser("group-call-webrtc-ice", toUserId, {
//       fromUserId: socket.userId,
//       channelId,
//       candidate,
//     });
//   });

//   // ---------- Ephemeral meeting rooms (participants + chat) ----------
//   socket.on("meeting-join", (data) => {
//     const { meetingId, name } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     if (!activeMeetings[key]) activeMeetings[key] = {};

//     activeMeetings[key][socket.userId] = {
//       name: name || `User ${socket.userId}`,
//     };

//     socket.join(`meeting:${key}`);
//     socket.meetingIds.add(key);

//     const participants = Object.entries(activeMeetings[key]).map(
//       ([userId, info]) => ({
//         userId,
//         name: info.name,
//       })
//     );

//     io.to(`meeting:${key}`).emit("meeting-participants", {
//       meetingId: key,
//       participants,
//     });
//   });

//   // Guest requests to join when meeting has lobby (open_to_everyone = false)
//   socket.on("meeting-join-request", (data) => {
//     const { meetingId, name } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     if (!meetingLobby[key]) meetingLobby[key] = [];
//     const entry = { userId: socket.userId, name: name || `User ${socket.userId}`, socketId: socket.id };
//     if (meetingLobby[key].some((e) => e.userId === socket.userId)) return;
//     meetingLobby[key].push(entry);
//     io.to(`meeting:${key}`).emit("meeting-lobby-request", {
//       meetingId: key,
//       userId: socket.userId,
//       name: entry.name,
//     });
//   });

//   // Host admits a user from the lobby
//   socket.on("meeting-admit", (data) => {
//     const { meetingId, userId: guestUserId } = data || {};
//     if (!meetingId || !socket.userId || !guestUserId) return;
//     const key = String(meetingId);
//     const lobby = meetingLobby[key];
//     if (!lobby) return;
//     const idx = lobby.findIndex((e) => String(e.userId) === String(guestUserId));
//     if (idx === -1) return;
//     lobby.splice(idx, 1);
//     if (lobby.length === 0) delete meetingLobby[key];
//     io.to(`meeting:${key}`).emit("meeting-lobby-left", { meetingId: key, userId: guestUserId });
//     forwardToUser("meeting-admitted", guestUserId, { meetingId: key });
//   });

//   socket.on("meeting-leave", (data) => {
//     const { meetingId } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room) return;

//     delete room[socket.userId];
//     socket.leave(`meeting:${key}`);
//     socket.meetingIds.delete(key);

//     const participants = Object.entries(room).map(([userId, info]) => ({
//       userId,
//       name: info.name,
//     }));

//     if (participants.length === 0) {
//       delete activeMeetings[key];
//     }

//     io.to(`meeting:${key}`).emit("meeting-participants", {
//       meetingId: key,
//       participants,
//     });
//   });

//   socket.on("meeting-message", (data) => {
//     const { meetingId, message } = data || {};
//     if (!meetingId || !socket.userId || !message || !message.content) return;
//     const key = String(meetingId);
//     if (!activeMeetings[key]) return;

//     const safeMessage = {
//       id:
//         message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
//       userId: socket.userId,
//       name: message.name || activeMeetings[key][socket.userId]?.name || "User",
//       content: String(message.content).slice(0, 1000),
//       createdAt: message.createdAt || new Date().toISOString(),
//     };

//     io.to(`meeting:${key}`).emit("meeting-message", {
//       meetingId: key,
//       message: safeMessage,
//     });
//   });

//   socket.on("meeting-end", (data) => {
//     const { meetingId } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room) return;

//     // Notify guests in lobby that meeting ended
//     const lobby = meetingLobby[key];
//     if (lobby) {
//       lobby.forEach((e) => {
//         io.to(e.socketId).emit("meeting-ended", { meetingId: key });
//       });
//       delete meetingLobby[key];
//     }

//     // Broadcast end, then clear room
//     io.to(`meeting:${key}`).emit("meeting-ended", { meetingId: key });

//     Object.keys(room).forEach((uid) => {
//       const socketId = users[uid];
//       if (socketId) {
//         const s = io.sockets.sockets.get(socketId);
//         if (s) {
//           s.leave(`meeting:${key}`);
//           if (s.meetingIds && s.meetingIds.has(key)) {
//             s.meetingIds.delete(key);
//           }
//         }
//       }
//     });

//     delete activeMeetings[key];
//   });

//   // ---------- Meeting media-state broadcast (mute / video / hand raise) ----------
//   socket.on("meeting-media-state", (data) => {
//     const { meetingId, isMuted, isVideoOff } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room || !room[socket.userId]) return;
//     // Store the state so late joiners can see it
//     room[socket.userId].isMuted = !!isMuted;
//     room[socket.userId].isVideoOff = !!isVideoOff;
//     // Broadcast to others in the room
//     socket.to(`meeting:${key}`).emit("meeting-media-state", {
//       meetingId: key,
//       userId: socket.userId,
//       isMuted: !!isMuted,
//       isVideoOff: !!isVideoOff,
//     });
//   });

//   socket.on("meeting-hand-raise", (data) => {
//     const { meetingId, raised } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room || !room[socket.userId]) return;
//     room[socket.userId].handRaised = !!raised;
//     io.to(`meeting:${key}`).emit("meeting-hand-raise", {
//       meetingId: key,
//       userId: socket.userId,
//       raised: !!raised,
//     });
//   });

//   // ---------- Meeting screen sharing ----------
//   socket.on("meeting-screen-share-start", (data) => {
//     const { meetingId } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room) return;
//     room[socket.userId].screenSharing = true;
//     io.to(`meeting:${key}`).emit("meeting-screen-share-start", {
//       meetingId: key,
//       userId: socket.userId,
//       name: room[socket.userId]?.name || "User",
//     });
//   });

//   socket.on("meeting-screen-share-stop", (data) => {
//     const { meetingId } = data || {};
//     if (!meetingId || !socket.userId) return;
//     const key = String(meetingId);
//     const room = activeMeetings[key];
//     if (!room) return;
//     if (room[socket.userId]) room[socket.userId].screenSharing = false;
//     io.to(`meeting:${key}`).emit("meeting-screen-share-stop", {
//       meetingId: key,
//       userId: socket.userId,
//     });
//   });

//   // ---------- Meeting WebRTC signalling (mesh, 1:1 between participants) ----------
//   socket.on("meeting-webrtc-offer", (data) => {
//     const { meetingId, toUserId, sdp } = data;
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("meeting-webrtc-offer", toUserId, {
//       fromUserId: socket.userId,
//       meetingId,
//       sdp,
//     });
//   });

//   socket.on("meeting-webrtc-answer", (data) => {
//     const { meetingId, toUserId, sdp } = data;
//     if (!toUserId || !socket.userId || !sdp) return;
//     forwardToUser("meeting-webrtc-answer", toUserId, {
//       fromUserId: socket.userId,
//       meetingId,
//       sdp,
//     });
//   });

//   socket.on("meeting-webrtc-ice", (data) => {
//     const { meetingId, toUserId, candidate } = data;
//     if (!toUserId || !socket.userId) return;
//     forwardToUser("meeting-webrtc-ice", toUserId, {
//       fromUserId: socket.userId,
//       meetingId,
//       candidate,
//     });
//   });

//   // ---------- Ticket chat ----------
//   socket.on("ticket-join", (data) => {
//     const { ticketId } = data || {};
//     if (!ticketId || !socket.userId) return;
//     const room = `ticket:${ticketId}`;
//     socket.join(room);
//     console.log(`[TICKET] user ${socket.userId} joined ${room}`);
//   });

//   socket.on("ticket-leave", (data) => {
//     const { ticketId } = data || {};
//     if (!ticketId || !socket.userId) return;
//     const room = `ticket:${ticketId}`;
//     socket.leave(room);
//     console.log(`[TICKET] user ${socket.userId} left ${room}`);
//   });

//   socket.on("ticket-message", (data) => {
//     const { ticketId, message } = data || {};
//     if (!ticketId || !socket.userId || !message) return;
//     const room = `ticket:${ticketId}`;
//     // Broadcast to all in the ticket room (including sender for confirmation)
//     io.to(room).emit("ticket-new-message", { ticketId, message });
//   });

//   socket.on("ticket-typing", (data) => {
//     const { ticketId, userName } = data || {};
//     if (!ticketId || !socket.userId) return;
//     const room = `ticket:${ticketId}`;
//     socket.to(room).emit("ticket-typing", { ticketId, userId: socket.userId, userName });
//   });

//   // ─── Whiteboard real-time collaboration ──────────────────────
//   socket.on("whiteboard-join", ({ whiteboardId, userName }) => {
//     if (!whiteboardId || !socket.userId) return;
//     const room = `whiteboard:${whiteboardId}`;
//     socket.join(room);
//     if (!socket.whiteboardIds) socket.whiteboardIds = new Set();
//     socket.whiteboardIds.add(whiteboardId);
//     if (!activeWhiteboards[whiteboardId]) activeWhiteboards[whiteboardId] = {};
//     activeWhiteboards[whiteboardId][socket.userId] = { name: userName || "Unknown", socketId: socket.id };
//     const collaborators = Object.entries(activeWhiteboards[whiteboardId]).map(([uid, info]) => ({ userId: uid, name: info.name }));
//     io.to(room).emit("whiteboard-collaborators", { whiteboardId, collaborators });
//     console.log(`[WHITEBOARD] ${socket.userId} joined ${room}`);
//   });

//   socket.on("whiteboard-leave", ({ whiteboardId }) => {
//     if (!whiteboardId || !socket.userId) return;
//     const room = `whiteboard:${whiteboardId}`;
//     socket.leave(room);
//     if (socket.whiteboardIds) socket.whiteboardIds.delete(whiteboardId);
//     if (activeWhiteboards[whiteboardId]) {
//       delete activeWhiteboards[whiteboardId][socket.userId];
//       const collaborators = Object.entries(activeWhiteboards[whiteboardId]).map(([uid, info]) => ({ userId: uid, name: info.name }));
//       if (collaborators.length === 0) delete activeWhiteboards[whiteboardId];
//       else io.to(room).emit("whiteboard-collaborators", { whiteboardId, collaborators });
//     }
//     console.log(`[WHITEBOARD] ${socket.userId} left ${room}`);
//   });

//   socket.on("whiteboard-update", ({ whiteboardId, elements }) => {
//     if (!whiteboardId || !socket.userId) return;
//     socket.to(`whiteboard:${whiteboardId}`).emit("whiteboard-update", { whiteboardId, elements, senderId: socket.userId });
//   });

//   socket.on("whiteboard-cursor", ({ whiteboardId, cursor, userName }) => {
//     if (!whiteboardId || !socket.userId) return;
//     socket.to(`whiteboard:${whiteboardId}`).emit("whiteboard-cursor", { whiteboardId, userId: socket.userId, userName, cursor });
//   });

//   socket.on("disconnect", () => {
//     console.log(
//       `Socket disconnected: ${socket.id} (userId=${normalizedUserId})`
//     );
//     if (normalizedUserId) {
//       // Only remove from users map if THIS socket is still the registered one.
//       // This prevents a reconnecting user's new socket from being deleted
//       // when the old socket's disconnect event fires after the new one registered.
//       if (users[normalizedUserId] === socket.id) {
//         delete users[normalizedUserId];

//         // Remove user from online set only if no active socket remains
//         onlineUsers.delete(normalizedUserId);
//         console.log(`[ONLINE STATUS] User went offline: ${normalizedUserId}`);

//         // Clear call status when user disconnects
//         delete userCallStatus[normalizedUserId];

//         // Remove user from any active meeting rooms
//         if (socket.meetingIds && socket.meetingIds.size > 0) {
//           socket.meetingIds.forEach((meetingId) => {
//             const room = activeMeetings[meetingId];
//             if (!room) return;
//             delete room[normalizedUserId];
//             const participants = Object.entries(room).map(([userId, info]) => ({
//               userId,
//               name: info.name,
//             }));
//             if (participants.length === 0) {
//               delete activeMeetings[meetingId];
//             } else {
//               io.to(`meeting:${meetingId}`).emit("meeting-participants", {
//                 meetingId,
//                 participants,
//               });
//             }
//           });
//         }

//         // Remove user from any meeting lobby
//         Object.keys(meetingLobby).forEach((key) => {
//           meetingLobby[key] = meetingLobby[key].filter(
//             (e) => String(e.userId) !== String(normalizedUserId)
//           );
//           if (meetingLobby[key].length === 0) delete meetingLobby[key];
//         });

//         // Remove user from any active whiteboard rooms
//         if (socket.whiteboardIds && socket.whiteboardIds.size > 0) {
//           socket.whiteboardIds.forEach((wbId) => {
//             const wb = activeWhiteboards[wbId];
//             if (!wb) return;
//             delete wb[normalizedUserId];
//             const collaborators = Object.entries(wb).map(([uid, info]) => ({ userId: uid, name: info.name }));
//             if (collaborators.length === 0) delete activeWhiteboards[wbId];
//             else io.to(`whiteboard:${wbId}`).emit("whiteboard-collaborators", { whiteboardId: wbId, collaborators });
//           });
//         }

//         // Broadcast updated online users list
//         broadcastOnlineUsers();
//       } else {
//         console.log(
//           `[ONLINE STATUS] Stale socket disconnect ignored for ${normalizedUserId} (old=${socket.id}, current=${users[normalizedUserId]})`
//         );
//       }
//     }
//   });
// });

// export const getReceiverSocketId = (receiverId) => {
//   const normalized = receiverId?.toString?.() ?? receiverId;
//   return users[normalized];
// };

// export const getOnlineUsers = () => {
//   return Array.from(onlineUsers);
// };

// export const getUserCallStatus = (userId) => {
//   const userIdStr = String(userId);
//   return userCallStatus[userIdStr] || { inCall: false };
// };

// export const setUserCallStatus = (userId, status) => {
//   const userIdStr = String(userId);
//   userCallStatus[userIdStr] = status;
// };

// export const clearUserCallStatus = (userId) => {
//   const userIdStr = String(userId);
//   delete userCallStatus[userIdStr];
// };

// // Broadcast meeting events to all connected clients (for real-time sync)
// export function broadcastMeetingEvent(event, meeting) {
//   io.emit("meeting-sync", { event, meeting });
// }

// export { app, server, io };

import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";

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
// Lobby for meetings with open_to_everyone=false: meetingId -> [{ userId, name, socketId }]
const meetingLobby = {};
// Track active whiteboard sessions: whiteboardId -> { [userId]: { name, socketId } }
const activeWhiteboards = {};
// NEW ─ Track active document sessions: docId -> { [userId]: { name, color, socketId }, _latestContent?, _version? }
const activeDocuments = {};

// NEW ─ Collaborator color palette (cycles)
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
  socket.documentIds = new Set(); // NEW ─ track doc rooms this socket has joined

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

    const participants = Object.entries(activeMeetings[key]).map(
      ([userId, info]) => ({
        userId,
        name: info.name,
      })
    );

    io.to(`meeting:${key}`).emit("meeting-participants", {
      meetingId: key,
      participants,
    });
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

    const participants = Object.entries(room).map(([userId, info]) => ({
      userId,
      name: info.name,
    }));

    if (participants.length === 0) {
      delete activeMeetings[key];
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
    const { meetingId, raised } = data || {};
    if (!meetingId || !socket.userId) return;
    const key = String(meetingId);
    const room = activeMeetings[key];
    if (!room || !room[socket.userId]) return;
    room[socket.userId].handRaised = !!raised;
    io.to(`meeting:${key}`).emit("meeting-hand-raise", {
      meetingId: key,
      userId: socket.userId,
      raised: !!raised,
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

  // ─── Whiteboard real-time collaboration ──────────────────────
  socket.on("whiteboard-join", ({ whiteboardId, userName }) => {
    if (!whiteboardId || !socket.userId) return;
    const room = `whiteboard:${whiteboardId}`;
    socket.join(room);
    if (!socket.whiteboardIds) socket.whiteboardIds = new Set();
    socket.whiteboardIds.add(whiteboardId);
    if (!activeWhiteboards[whiteboardId]) activeWhiteboards[whiteboardId] = {};
    activeWhiteboards[whiteboardId][socket.userId] = { name: userName || "Unknown", socketId: socket.id };
    const collaborators = Object.entries(activeWhiteboards[whiteboardId]).map(([uid, info]) => ({ userId: uid, name: info.name }));
    io.to(room).emit("whiteboard-collaborators", { whiteboardId, collaborators });
    console.log(`[WHITEBOARD] ${socket.userId} joined ${room}`);
  });

  socket.on("whiteboard-leave", ({ whiteboardId }) => {
    if (!whiteboardId || !socket.userId) return;
    const room = `whiteboard:${whiteboardId}`;
    socket.leave(room);
    if (socket.whiteboardIds) socket.whiteboardIds.delete(whiteboardId);
    if (activeWhiteboards[whiteboardId]) {
      delete activeWhiteboards[whiteboardId][socket.userId];
      const collaborators = Object.entries(activeWhiteboards[whiteboardId]).map(([uid, info]) => ({ userId: uid, name: info.name }));
      if (collaborators.length === 0) delete activeWhiteboards[whiteboardId];
      else io.to(room).emit("whiteboard-collaborators", { whiteboardId, collaborators });
    }
    console.log(`[WHITEBOARD] ${socket.userId} left ${room}`);
  });

  socket.on("whiteboard-update", ({ whiteboardId, elements }) => {
    if (!whiteboardId || !socket.userId) return;
    socket.to(`whiteboard:${whiteboardId}`).emit("whiteboard-update", { whiteboardId, elements, senderId: socket.userId });
  });

  socket.on("whiteboard-cursor", ({ whiteboardId, cursor, userName }) => {
    if (!whiteboardId || !socket.userId) return;
    socket.to(`whiteboard:${whiteboardId}`).emit("whiteboard-cursor", { whiteboardId, userId: socket.userId, userName, cursor });
  });

  // ─── NEW: Document real-time collaboration ────────────────────────────────

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
   * Typing indicator — broadcast to others in the same doc room.
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

  // ─────────────────────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(
      `Socket disconnected: ${socket.id} (userId=${normalizedUserId})`
    );
    if (normalizedUserId) {
      // Only remove from users map if THIS socket is still the registered one.
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
            const participants = Object.entries(room).map(([userId, info]) => ({
              userId,
              name: info.name,
            }));
            if (participants.length === 0) {
              delete activeMeetings[meetingId];
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

        // Remove user from any active whiteboard rooms
        if (socket.whiteboardIds && socket.whiteboardIds.size > 0) {
          socket.whiteboardIds.forEach((wbId) => {
            const wb = activeWhiteboards[wbId];
            if (!wb) return;
            delete wb[normalizedUserId];
            const collaborators = Object.entries(wb).map(([uid, info]) => ({ userId: uid, name: info.name }));
            if (collaborators.length === 0) delete activeWhiteboards[wbId];
            else io.to(`whiteboard:${wbId}`).emit("whiteboard-collaborators", { whiteboardId: wbId, collaborators });
          });
        }

        // NEW ─ Remove user from any active document rooms on disconnect
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

// ─── NEW: Document helper functions (module-level) ───────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

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

export { app, server, io };