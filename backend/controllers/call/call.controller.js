import { getReceiverSocketId, getOnlineUsers, getUserCallStatus, setUserCallStatus, clearUserCallStatus, io } from "../../socket/socketServer.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import User from "../../models/User.js";
import { createLiveKitToken } from "../../services/livekit.service.js";
import { Notification } from "../../models/Notification.js";

// In-memory: channelId -> { initiatorId, initiatorName, channelName?, participantIds: string[] }
const activeGroupCalls = {};

function getCallerName(u) {
  if (!u) return "User";
  const first = u.first_name || "";
  const last = u.last_name || "";
  return [first, last].filter(Boolean).join(" ").trim() || u.email || "User";
}

function makeDirectRoomName(userA, userB) {
  const [a, b] = [String(userA), String(userB)].sort();
  return `direct-${a}-${b}`;
}

/**
 * Request a voice call to a user.
 * Same mechanism as chat: HTTP request -> server emits to target's socket (getReceiverSocketId + io.to().emit).
 */
export const requestCall = async (req, res) => {
  try {
    const { toUserId, callType = "audio" } = req.body; // callType: "audio" or "video"
    const callerUserId = req.userId;
    const callerUser = req.user;

    if (!toUserId) {
      return res.status(400).json({ error: "toUserId is required" });
    }

    const normalizedTo = String(toUserId);
    const callerIdStr = String(callerUserId);
    if (normalizedTo === callerIdStr) {
      return res.status(400).json({ error: "Cannot call yourself" });
    }

    // Caller cannot start a new call if they are already in a call (audio or video)
    const callerCallStatus = getUserCallStatus(callerIdStr);
    if (callerCallStatus?.inCall) {
      return res.status(409).json({
        error: "You are on a call",
        message: "You cannot call others while in an ongoing call.",
      });
    }

    // Check if the target user is already in a call
    const targetUserCallStatus = getUserCallStatus(normalizedTo);
    if (targetUserCallStatus?.inCall) {
      return res.status(409).json({
        error: "User is on a call",
        message: "The user is currently on a call.",
      });
    }

    const receiverSocketId = getReceiverSocketId(normalizedTo);

    if (!receiverSocketId) {
      return res.status(404).json({
        error: "User unavailable",
        message: "The user is not online or not connected.",
      });
    }

    const fromUserName =
      callerUser?.first_name && callerUser?.last_name
        ? `${callerUser.first_name} ${callerUser.last_name}`
        : "Someone";

    // Note: Call status will be set when call is accepted (in socket handler)

    // Create notification for incoming call
    const callerAvatar = callerUser?.profile_picture || null;
    try {
      const notification = new Notification({
        user_id: toUserId,
        type: callType === "video" ? "video_call" : "audio_call",
        title: `Incoming ${callType} call from ${fromUserName}`,
        body: `${fromUserName} is calling...`,
        source_id: callerUserId,
        source_type: "call",
        sender_id: callerUserId,
        sender_name: fromUserName,
        sender_avatar: callerAvatar,
        is_read: false,
        action_url: "/calls",
        metadata: {
          callType,
          callDuration: 0,
        },
      });

      await notification.save();
      console.log(`[CALL_NOTIFICATION] ✅ Created ${callType} call notification for user ${toUserId}`);

      // Emit notification event to trigger frontend notification system
      console.log(`[CALL_NOTIFICATION] 📨 Emitting notification:new event for call from ${fromUserName}`);
      io.to(receiverSocketId).emit("notification:new", {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          sender_name: notification.sender_name,
          sender_avatar: notification.sender_avatar,
          action_url: notification.action_url,
        },
      });
    } catch (notificationError) {
      console.warn("[CALL_NOTIFICATION] ⚠️ Failed to create notification:", notificationError.message);
      // Don't fail the call if notification fails
    }

    // Emit appropriate event based on call type
    const eventName = callType === "video" ? "incoming-video-call" : "incoming-audio-call";
    io.to(receiverSocketId).emit(eventName, {
      fromUserId: callerUserId,
      fromUserName,
    });

    return res.json({
      success: true,
      message: "Call request sent",
    });
  } catch (error) {
    console.error("[CALL] requestCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/livekit-token
 * Body: { toUserId, callType?: "audio" | "video" }
 */
export const getDirectCallLiveKitToken = async (req, res) => {
  try {
    const { toUserId, callType = "audio" } = req.body;
    const callerId = String(req.userId);
    const calleeId = String(toUserId || "").trim();

    if (!calleeId) {
      return res.status(400).json({ error: "toUserId is required" });
    }
    if (calleeId === callerId) {
      return res.status(400).json({ error: "Cannot start a call with yourself" });
    }

    const calleeUser = await User.findById(calleeId).select("_id").lean();
    if (!calleeUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const roomName = makeDirectRoomName(callerId, calleeId);
    const tokenResponse = await createLiveKitToken({
      identity: callerId,
      name: getCallerName(req.user),
      roomName,
      metadata: {
        type: "direct-call",
        callType,
        fromUserId: callerId,
        toUserId: calleeId,
      },
    });

    return res.json({
      roomName,
      ...tokenResponse,
    });
  } catch (error) {
    console.error("[CALL] getDirectCallLiveKitToken error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate LiveKit token" });
  }
};

/**
 * GET /api/call/online/:userId - Check if a user is online (socket connected).
 */
export const checkUserOnline = async (req, res) => {
  try {
    const { userId } = req.params;
    const online = getOnlineUsers();
    const onlineStr = online.map((id) => String(id));
    const isOnline = userId ? onlineStr.includes(String(userId)) : false;
    return res.json({ online: isOnline, userId });
  } catch (error) {
    console.error("[CALL] checkUserOnline error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/call/status/:userId - Check if a user is currently in a call.
 */
export const checkUserCallStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdStr = String(userId);
    const callStatus = getUserCallStatus(userIdStr);
    
    if (callStatus?.inCall) {
      return res.json({
        inCall: true,
        callType: callStatus.callType,
        otherUserId: callStatus.otherUserId,
        channelId: callStatus.channelId,
      });
    }
    
    return res.json({ inCall: false });
  } catch (error) {
    console.error("[CALL] checkUserCallStatus error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/group/start - Start a group call (admin only).
 */
export const startGroupCall = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this channel" });
    }

    if (membership.role !== "admin") {
      return res.status(403).json({ error: "Only channel admins can start group calls" });
    }

    if (activeGroupCalls[channelId]) {
      return res.status(400).json({ error: "A group call is already active in this channel" });
    }

    const userIdStr = String(userId);
    const initiatorName = getCallerName(user);
    activeGroupCalls[channelId] = {
      initiatorId: userIdStr,
      initiatorName,
      participantIds: [userIdStr],
    };

    // Mark initiator as in a group call
    setUserCallStatus(userIdStr, {
      inCall: true,
      callType: "group",
      channelId: channelId,
    });

    const channel = await ChatChannel.findById(channelId);
    const channelName = channel?.name || "Group";

    const members = await ChannelMember.find({ channel_id: channelId }).select("user_id");
    const initiatorAvatar = user?.profile_picture || null;

    for (const m of members) {
      const memberId = m.user_id._id || m.user_id;
      const socketId = getReceiverSocketId(String(memberId));

      if (socketId) {
        io.to(socketId).emit("group-call-started", {
          channelId,
          channelName,
          initiatorId: userIdStr,
          initiatorName,
        });
      }

      // Create notification for all members except initiator
      if (String(memberId) !== userIdStr) {
        try {
          const notification = new Notification({
            user_id: memberId,
            type: "group_call",
            title: `Group call started in ${channelName}`,
            body: `${initiatorName} started a call in ${channelName}`,
            source_id: channelId,
            source_type: "group_call",
            channel_id: channelId,
            sender_id: userId,
            sender_name: initiatorName,
            sender_avatar: initiatorAvatar,
            is_read: false,
            action_url: `/chat/${channelId}`,
            metadata: {
              channelName,
              initiatorName,
            },
          });

          await notification.save();
        } catch (notificationError) {
          console.warn(
            `[CALL_NOTIFICATION] ⚠️ Failed to create group call notification for user ${memberId}:`,
            notificationError.message
          );
        }
      }
    }

    return res.json({
      success: true,
      channelId,
      initiatorId: userIdStr,
      participantIds: [userIdStr],
    });
  } catch (error) {
    console.error("[CALL] startGroupCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/group/livekit-token
 * Body: { channelId }
 */
export const getGroupCallLiveKitToken = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = String(req.userId);

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    }).lean();

    if (!membership) {
      return res.status(403).json({ error: "Not a member of this channel" });
    }

    const roomName = `group-${String(channelId)}`;
    const tokenResponse = await createLiveKitToken({
      identity: userId,
      name: getCallerName(req.user),
      roomName,
      metadata: {
        type: "group-call",
        channelId: String(channelId),
        role: membership.role || "member",
      },
    });

    return res.json({
      roomName,
      ...tokenResponse,
    });
  } catch (error) {
    console.error("[CALL] getGroupCallLiveKitToken error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate LiveKit token" });
  }
};

/**
 * GET /api/call/group/status/:channelId - Get whether a group call is active and who is in it.
 */
export const getGroupCallStatus = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this channel" });
    }

    const call = activeGroupCalls[channelId];
    if (!call) {
      return res.json({ active: false, channelId });
    }

    const participants = await Promise.all(
      call.participantIds.map(async (id) => {
        const u = await User.findById(id).select("first_name last_name email");
        return {
          id,
          name: u ? getCallerName(u) : "User",
        };
      })
    );

    return res.json({
      active: true,
      channelId,
      channelName: call.channelName || (await ChatChannel.findById(channelId).then((c) => c?.name)) || "Group",
      initiatorId: call.initiatorId,
      initiatorName: call.initiatorName,
      participantIds: call.participantIds,
      participants,
    });
  } catch (error) {
    console.error("[CALL] getGroupCallStatus error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/group/join - Join an existing group call.
 */
export const joinGroupCall = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const call = activeGroupCalls[channelId];
    if (!call) {
      return res.status(404).json({ error: "No active call in this channel" });
    }

    const userIdStr = String(userId);
    if (call.participantIds.includes(userIdStr)) {
      return res.json({ success: true, message: "Already in call", participants: call.participantIds });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this channel" });
    }

    const joinerName = getCallerName(user);
    call.participantIds.push(userIdStr);
    if (!call.channelName) {
      const ch = await ChatChannel.findById(channelId);
      call.channelName = ch?.name || "Group";
    }

    // Mark user as in a group call
    setUserCallStatus(userIdStr, {
      inCall: true,
      callType: "group",
      channelId: channelId,
    });

    const participantsWithNames = await Promise.all(
      call.participantIds.map(async (id) => {
        const u = await User.findById(id).select("first_name last_name email");
        return { id, name: u ? getCallerName(u) : "User" };
      })
    );

    const payload = {
      channelId,
      channelName: call.channelName,
      joinerId: userIdStr,
      joinerName,
      participantIds: [...call.participantIds],
      participants: participantsWithNames,
    };

    for (const pid of call.participantIds) {
      const socketId = getReceiverSocketId(pid);
      if (socketId) {
        io.to(socketId).emit("group-call-participant-joined", payload);
      }
    }

    return res.json({
      success: true,
      channelId,
      participantIds: call.participantIds,
      participants: participantsWithNames,
    });
  } catch (error) {
    console.error("[CALL] joinGroupCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/group/leave - Leave a group call.
 */
export const leaveGroupCall = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.userId;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const call = activeGroupCalls[channelId];
    if (!call) {
      return res.json({ success: true, message: "No active call" });
    }

    const userIdStr = String(userId);
    const isInitiatorLeaving = call.initiatorId === userIdStr;

    // If group admin (initiator) leaves, end the call for everyone immediately.
    if (isInitiatorLeaving) {
      delete activeGroupCalls[channelId];
      const members = await ChannelMember.find({ channel_id: channelId }).select("user_id");
      for (const m of members) {
        const memberIdStr = String(m.user_id);
        clearUserCallStatus(memberIdStr);
        const socketId = getReceiverSocketId(memberIdStr);
        if (socketId) {
          io.to(socketId).emit("group-call-ended", { channelId });
        }
      }
      return res.json({ success: true, channelId });
    }

    call.participantIds = call.participantIds.filter((id) => id !== userIdStr);
    // Clear call status for the user who left
    clearUserCallStatus(userIdStr);
    // Clear call status for the user who left
    clearUserCallStatus(userIdStr);

    const payload = {
      channelId,
      userId: userIdStr,
      participantIds: [...call.participantIds],
    };

    for (const pid of call.participantIds) {
      const socketId = getReceiverSocketId(pid);
      if (socketId) {
        io.to(socketId).emit("group-call-participant-left", payload);
      }
    }

    const leftSocketId = getReceiverSocketId(userIdStr);
    if (leftSocketId) {
      io.to(leftSocketId).emit("group-call-left", payload);
    }

    // Only end the call when the last participant leaves (admin can stay alone; others can rejoin).
    if (call.participantIds.length === 0) {
      delete activeGroupCalls[channelId];
      const members = await ChannelMember.find({ channel_id: channelId }).select("user_id");
      for (const m of members) {
        const memberIdStr = String(m.user_id);
        clearUserCallStatus(memberIdStr);
        const socketId = getReceiverSocketId(memberIdStr);
        if (socketId) {
          io.to(socketId).emit("group-call-ended", { channelId });
        }
      }
    }

    return res.json({ success: true, channelId });
  } catch (error) {
    console.error("[CALL] leaveGroupCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/call/invite - Invite a user to an ongoing 1-on-1 call
 * Converts 1-on-1 call to group call by inviting additional participants
 */
export const inviteToCall = async (req, res) => {
  try {
    const { inviteeUserId } = req.body;
    const callerId = req.userId;
    const caller = req.user;

    if (!inviteeUserId) {
      return res.status(400).json({ error: "inviteeUserId is required" });
    }

    const inviteeIdStr = String(inviteeUserId);
    const callerIdStr = String(callerId);

    if (inviteeIdStr === callerIdStr) {
      return res.status(400).json({ error: "Cannot invite yourself" });
    }

    // Check if invitee exists
    const inviteeUser = await User.findById(inviteeIdStr);
    if (!inviteeUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if invitee is online
    const inviteeSocketId = getReceiverSocketId(inviteeIdStr);
    if (!inviteeSocketId) {
      return res.status(409).json({
        error: "User unavailable",
        message: "The user is not online or not connected.",
      });
    }

    // Check if invitee is already on a call
    const inviteeCallStatus = getUserCallStatus(inviteeIdStr);
    if (inviteeCallStatus?.inCall) {
      return res.status(409).json({
        error: "User is on a call",
        message: "The user is currently on a call.",
      });
    }

    const callerName = getCallerName(caller);
    const inviteeName = getCallerName(inviteeUser);

    // Send invitation via socket
    io.to(inviteeSocketId).emit("video-call-invite", {
      fromUserId: callerIdStr,
      fromUserName: callerName,
      inviteeUserId: inviteeIdStr,
      inviteeName: inviteeName,
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      message: `Invitation sent to ${inviteeName}`,
      invitee: {
        id: inviteeIdStr,
        name: inviteeName,
        email: inviteeUser.email,
      },
    });
  } catch (error) {
    console.error("[CALL] inviteToCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};
