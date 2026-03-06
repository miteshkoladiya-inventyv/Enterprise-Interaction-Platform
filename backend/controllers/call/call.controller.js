import { getReceiverSocketId, getOnlineUsers, getUserCallStatus, setUserCallStatus, clearUserCallStatus, io } from "../../socket/socketServer.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import User from "../../models/User.js";

// In-memory: channelId -> { initiatorId, initiatorName, channelName?, participantIds: string[] }
const activeGroupCalls = {};

function getCallerName(u) {
  if (!u) return "User";
  const first = u.first_name || "";
  const last = u.last_name || "";
  return [first, last].filter(Boolean).join(" ").trim() || u.email || "User";
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
    for (const m of members) {
      const socketId = getReceiverSocketId(String(m.user_id));
      if (socketId) {
        io.to(socketId).emit("group-call-started", {
          channelId,
          channelName,
          initiatorId: userIdStr,
          initiatorName,
        });
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
