import { Message } from "../../models/Message.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import User from "../../models/User.js";
import { Notification } from "../../models/Notification.js";
import { requireChannelMembership } from "../../middlewares/auth.js";
import { sendSuccess, sendError, sendCreated, sendForbidden, sendBadRequest, sendServerError } from "../../utils/responseFormatter.js";
import { validateMessageContent, validateChannelId } from "../../utils/validation.js";
import { getReceiverSocketId, io } from "../../socket/socketServer.js";

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { channel_id, content, message_type, parent_message_id } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!channel_id || !content) {
      return sendBadRequest(res, "channel_id and content are required");
    }

    // Validate content
    let validatedContent;
    try {
      validatedContent = validateMessageContent(content);
    } catch (validationError) {
      return sendBadRequest(res, validationError.message);
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Validate parent message if provided
    if (parent_message_id) {
      const parentMessage = await Message.findById(parent_message_id);
      if (
        !parentMessage ||
        parentMessage.channel_id.toString() !== channel_id
      ) {
        return sendBadRequest(res, "Invalid parent message");
      }
    }

    // Create message
    const message = new Message({
      channel_id,
      sender_id: userId,
      content: validatedContent,
      message_type: message_type || "text",
      parent_message_id: parent_message_id || null,
    });

    await message.save();

    // Phase 2: Process mentions in the message (async, no wait)
    processMentions(message._id, channel_id).catch((err) =>
      console.error("[MESSAGE] Mention processing error:", err)
    );

    // Phase 2.5: Create notifications for all channel members (regular message notifications)
    console.log(`[MESSAGE] 📬 NOTIFYING CHANNEL MEMBERS for message ${message._id} in channel ${channel_id}`);
    notifyChannelMembers(message._id, channel_id, userId, validatedContent).catch((err) => {
      console.error("[MESSAGE] ❌ Channel notification error:", err);
    });

    // Populate and return message
    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id");

    return sendCreated(res, populatedMessage, "Message sent successfully");
  } catch (error) {
    console.error("[MESSAGE] Send message error:", error.message);
    return sendServerError(res, error);
  }
};

// Get messages in a channel
export const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
    const { limit = 50, before, after, parent_message_id } = req.query;

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Build query
    const query = {
      channel_id: channelId,
      deleted_at: null,
    };

    // Filter by thread
    if (parent_message_id) {
      query.parent_message_id = parent_message_id;
    } else {
      query.parent_message_id = null; // Only root messages
    }

    // Pagination - use cursor-based approach (before/after timestamps)
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 500);
    if (before) {
      query.created_at = { $lt: new Date(before) };
    } else if (after) {
      query.created_at = { $gt: new Date(after) };
    }

    // Get messages
    const messages = await Message.find(query)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id")
      .sort({ created_at: -1 })
      .limit(parsedLimit)
      .lean();

    // ✅ FIX N+1 QUERY: Get all reply counts in single aggregation
    const messagIds = messages.map(m => m._id);
    const replyCounts = await Message.aggregate([
      {
        $match: {
          parent_message_id: { $in: messagIds },
          deleted_at: null,
        },
      },
      {
        $group: {
          _id: "$parent_message_id",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map for quick lookup
    const replyCountMap = {};
    replyCounts.forEach(({ _id, count }) => {
      replyCountMap[_id.toString()] = count;
    });

    // Add reply counts to messages
    const messagesWithReplies = messages.map((message) => ({
      ...message,
      reply_count: replyCountMap[message._id.toString()] || 0,
    }));

    return sendSuccess(res, {
      count: messagesWithReplies.length,
      messages: messagesWithReplies.reverse(), // Oldest first
    });
  } catch (error) {
    console.error("[MESSAGE] Get channel messages error:", error.message);
    return sendServerError(res, error);
  }
};

// Get message by ID
export const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const message = await Message.findById(id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id");

    if (!message) {
      return sendError(res, "Message not found", 404);
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Get replies with proper aggregation
    const replies = await Message.find({
      parent_message_id: message._id,
      deleted_at: null,
    })
      .populate("sender_id", "first_name last_name email user_type")
      .sort({ created_at: 1 });

    return sendSuccess(res, {
      message,
      replies,
      reply_count: replies.length,
    });
  } catch (error) {
    console.error("[MESSAGE] Get message by ID error:", error.message);
    return sendServerError(res, error);
  }
};

// Edit message
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content) {
      return sendBadRequest(res, "content is required");
    }

    let validatedContent;
    try {
      validatedContent = validateMessageContent(content);
    } catch (validationError) {
      return sendBadRequest(res, validationError.message);
    }

    const message = await Message.findById(id);

    if (!message) {
      return sendError(res, "Message not found", 404);
    }

    // Check if user is the sender
    if (message.sender_id.toString() !== userId) {
      return sendForbidden(res, "You can only edit your own messages");
    }

    // Check if message is deleted
    if (message.deleted_at) {
      return sendBadRequest(res, "Cannot edit deleted message");
    }

    // Update message
    message.content = validatedContent;
    message.edited_at = new Date();
    await message.save();

    const updatedMessage = await Message.findById(id).populate(
      "sender_id",
      "first_name last_name email user_type"
    );

    return sendSuccess(res, updatedMessage, "Message updated successfully");
  } catch (error) {
    console.error("[MESSAGE] Edit message error:", error.message);
    return sendServerError(res, error);
  }
};

// Delete message (soft delete)
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const message = await Message.findById(id);

    if (!message) {
      return sendError(res, "Message not found", 404);
    }

    // Check if user is the sender or channel admin
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    const isSender = message.sender_id.toString() === userId;
    const isAdmin = membership && membership.role === "admin";

    if (!isSender && !isAdmin) {
      return sendForbidden(res, "You can only delete your own messages or if you are a channel admin");
    }

    // Soft delete
    message.deleted_at = new Date();
    message.content = "[Message deleted]";
    await message.save();

    return sendSuccess(res, { _id: message._id }, "Message deleted successfully");
  } catch (error) {
    console.error("[MESSAGE] Delete message error:", error.message);
    return sendServerError(res, error);
  }
};

// Get thread (message and its replies)
export const getThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const parentMessage = await Message.findById(id).populate(
      "sender_id",
      "first_name last_name email user_type"
    );

    if (!parentMessage) {
      return sendError(res, "Message not found", 404);
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: parentMessage.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Get all replies
    const replies = await Message.find({
      parent_message_id: id,
      deleted_at: null,
    })
      .populate("sender_id", "first_name last_name email user_type")
      .sort({ created_at: 1 });

    return sendSuccess(res, {
      parent_message: parentMessage,
      replies,
      reply_count: replies.length,
    });
  } catch (error) {
    console.error("[MESSAGE] Get thread error:", error.message);
    return sendServerError(res, error);
  }
};

// Search messages in a channel
export const searchMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { query, limit = 20 } = req.query;
    const userId = req.userId;

    if (!query) {
      return sendBadRequest(res, "search query is required");
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Use text search if available, otherwise fall back to regex with proper escaping
    let messages;
    try {
      // Try text search first (faster with text index)
      messages = await Message.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .match({ channel_id: channelId, deleted_at: null })
        .populate("sender_id", "first_name last_name email user_type")
        .sort({ score: { $meta: "textScore" } })
        .limit(Math.min(parseInt(limit, 10) || 20, 500))
        .lean();
    } catch {
      // Fallback: use escaped regex search if text search fails
      const { escapeRegex } = require("../../utils/validation.js");
      const escapedQuery = escapeRegex(query);
      messages = await Message.find({
        channel_id: channelId,
        deleted_at: null,
        content: { $regex: escapedQuery, $options: "i" },
      })
        .populate("sender_id", "first_name last_name email user_type")
        .sort({ created_at: -1 })
        .limit(Math.min(parseInt(limit, 10) || 20, 500))
        .lean();
    }

    return sendSuccess(res, {
      count: messages.length,
      query,
      messages,
    });
  } catch (error) {
    console.error("[MESSAGE] Search messages error:", error.message);
    return sendServerError(res, error);
  }
};

// Get unread message count for user
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    // Get all user's channels
    const memberships = await ChannelMember.find({ user_id: userId }).select("channel_id joined_at").lean();

    if (memberships.length === 0) {
      return sendSuccess(res, {
        total_unread: 0,
        channels: [],
      });
    }

    const channelIds = memberships.map((m) => m.channel_id);

    // ✅ FIX: Use single aggregation instead of N queries
    const unreadData = await Message.aggregate([
      {
        $match: {
          channel_id: { $in: channelIds },
          sender_id: { $ne: userId },
          deleted_at: null,
        },
      },
      {
        $group: {
          _id: "$channel_id",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map for quick lookup
    const unreadMap = {};
    unreadData.forEach(({ _id, count }) => {
      unreadMap[_id.toString()] = count;
    });

    // Build response with all channels even if count is 0
    const unreadCounts = memberships.map((membership) => ({
      channel_id: membership.channel_id,
      unread_count: unreadMap[membership.channel_id.toString()] || 0,
    }));

    const totalUnread = unreadCounts.reduce(
      (sum, item) => sum + item.unread_count,
      0
    );

    return sendSuccess(res, {
      total_unread: totalUnread,
      channels: unreadCounts,
    });
  } catch (error) {
    console.error("[MESSAGE] Get unread count error:", error.message);
    return sendServerError(res, error);
  }
};

// Mark message as read
export const markMessageAsRead = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendError(res, "Message not found", 404);
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Check if user has already seen the message
    const alreadySeen = message.seen_by.some(
      (seen) => String(seen.user_id) === String(userId)
    );

    if (!alreadySeen) {
      message.seen_by.push({
        user_id: userId,
        seen_at: new Date(),
      });
      await message.save();
    }

    return sendSuccess(res, {
      message_id: messageId,
      seen_by_count: message.seen_by.length,
    }, "Message marked as read");
  } catch (error) {
    console.error("[MESSAGE] Mark as read error:", error.message);
    return sendServerError(res, error);
  }
};

// ===== PHASE 1: STARRED MESSAGES & MESSAGE PINNING =====

// Toggle star on a message
export const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendNotFound(res, "Message not found");
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Toggle star: if already starred, remove; otherwise add
    const isStarred = message.starred_by.some((id) => String(id) === String(userId));

    if (isStarred) {
      // Remove star
      message.starred_by = message.starred_by.filter(
        (id) => String(id) !== String(userId)
      );
    } else {
      // Add star
      message.starred_by.push(userId);
    }

    await message.save();

    // Emit socket event to notify other users
    const io = req.app.get("io");
    if (io) {
      io.to(`channel:${message.channel_id}`).emit("message:starred", {
        message_id: messageId,
        starred_by: userId,
        is_starred: !isStarred,
        starred_count: message.starred_by.length,
      });
    }

    return sendSuccess(res, {
      message_id: messageId,
      starred: !isStarred,
      starred_by: message.starred_by,
      starred_count: message.starred_by.length,
    }, "Message star toggled successfully");
  } catch (error) {
    console.error("[MESSAGE] Toggle star error:", error.message);
    return sendServerError(res, error);
  }
};

// Get all starred messages for current user
export const getStarredMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { channelId } = req.query;

    // Build query
    let query = {
      starred_by: userId,
      deleted_at: null,
    };

    if (channelId) {
      query.channel_id = channelId;
    }

    // Fetch starred messages
    const messages = await Message.find(query)
      .sort({ created_at: -1 })
      .select("-__v")
      .lean();

    return sendSuccess(res, {
      count: messages.length,
      messages,
    }, "Starred messages retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get starred messages error:", error.message);
    return sendServerError(res, error);
  }
};

// Pin a message in a channel
export const pinMessage = async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const userId = req.userId;
    const { pin_reason } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendNotFound(res, "Message not found");
    }

    // Verify message is in the specified channel
    if (String(message.channel_id) !== String(channelId)) {
      return sendBadRequest(res, "Message does not belong to this channel");
    }

    // Check channel membership and admin/moderator role
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Only admin or moderator can pin messages
    if (membership.role !== "admin" && membership.role !== "moderator") {
      return sendForbidden(res, "Only admins/moderators can pin messages");
    }

    // Check if already pinned
    if (message.is_pinned) {
      return sendBadRequest(res, "Message is already pinned");
    }

    // Pin the message
    message.is_pinned = true;
    message.pinned_at = new Date();
    message.pinned_by = userId;
    message.pin_reason = pin_reason || null;

    await message.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("message:pinned", {
        message_id: messageId,
        pinned_by: userId,
        pinned_at: message.pinned_at,
        channel_id: channelId,
      });
    }

    return sendSuccess(res, {
      message_id: messageId,
      is_pinned: true,
      pinned_by: userId,
      pinned_at: message.pinned_at,
      pin_reason: message.pin_reason,
    }, "Message pinned successfully");
  } catch (error) {
    console.error("[MESSAGE] Pin message error:", error.message);
    return sendServerError(res, error);
  }
};

// Unpin a message
export const unpinMessage = async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendNotFound(res, "Message not found");
    }

    // Verify message is in the specified channel
    if (String(message.channel_id) !== String(channelId)) {
      return sendBadRequest(res, "Message does not belong to this channel");
    }

    // Check channel membership and admin/moderator role
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Only admin or moderator can unpin messages
    if (membership.role !== "admin" && membership.role !== "moderator") {
      return sendForbidden(res, "Only admins/moderators can unpin messages");
    }

    // Check if already unpinned
    if (!message.is_pinned) {
      return sendBadRequest(res, "Message is not pinned");
    }

    // Unpin the message
    message.is_pinned = false;
    message.pinned_at = null;
    message.pinned_by = null;
    message.pin_reason = null;

    await message.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`channel:${channelId}`).emit("message:unpinned", {
        message_id: messageId,
        channel_id: channelId,
      });
    }

    return sendSuccess(res, {
      message_id: messageId,
      is_pinned: false,
    }, "Message unpinned successfully");
  } catch (error) {
    console.error("[MESSAGE] Unpin message error:", error.message);
    return sendServerError(res, error);
  }
};

// Get all pinned messages in a channel
export const getPinnedMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Verify user is channel member
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Fetch pinned messages (limit 50)
    const pinnedMessages = await Message.find({
      channel_id: channelId,
      is_pinned: true,
      deleted_at: null,
    })
      .sort({ pinned_at: -1 })
      .limit(50)
      .populate("sender_id", "first_name last_name full_name email user_type")
      .populate("pinned_by", "first_name last_name full_name")
      .select("-__v")
      .lean();

    return sendSuccess(res, {
      channel_id: channelId,
      pinned_count: pinnedMessages.length,
      pinned_messages: pinnedMessages,
    }, "Pinned messages retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get pinned messages error:", error.message);
    return sendServerError(res, error);
  }
};

// ===== PHASE 2: @MENTIONS & RICH TEXT =====

// Helper: Parse @mentions from content
const parseMentions = (content) => {
  const mentionRegex = /@(\w+)/g;
  const matches = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    matches.push(match[1]); // Extract username without @
  }
  return [...new Set(matches)]; // Remove duplicates
};

// Helper: Get user by username
const getUserByUsername = async (username) => {
  const { User } = await import("../../models/User.js");
  return await User.findOne({
    $or: [
      { username },
      { email: username },
      { first_name: username },
    ],
  }).select("_id first_name last_name full_name email");
};

// Get all mentions for current user
export const getMyMentions = async (req, res) => {
  try {
    const userId = req.userId;
    const { unread_only } = req.query;

    let query = {
      "mentioned_users.user_id": userId,
      deleted_at: null,
    };

    if (unread_only === "true") {
      query = {
        ...query,
        "mention_notifications.user_id": { $nin: [userId] },
      };
    }

    const mentions = await Message.find(query)
      .sort({ created_at: -1 })
      .limit(50)
      .populate("sender_id", "first_name last_name email")
      .populate("channel_id", "name")
      .select("content created_at sender_id channel_id mentioned_users")
      .lean();

    return sendSuccess(res, {
      total_mentions: mentions.length,
      mentions,
    }, "Mentions retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get mentions error:", error.message);
    return sendServerError(res, error);
  }
};

// Mark mention as read
export const markMentionAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendNotFound(res, "Message not found");
    }

    // Check if user was mentioned
    const wasMentioned = message.mentioned_users.some(
      (m) => String(m.user_id) === String(userId)
    );

    if (!wasMentioned) {
      return sendBadRequest(res, "User was not mentioned in this message");
    }

    // Add to mention_notifications if not already there
    const alreadyRead = message.mention_notifications.some(
      (n) => String(n.user_id) === String(userId)
    );

    if (!alreadyRead) {
      message.mention_notifications.push({
        user_id: userId,
        read_at: new Date(),
      });
      await message.save();
    }

    return sendSuccess(res, {
      message_id: messageId,
      read_at: new Date(),
    }, "Mention marked as read");
  } catch (error) {
    console.error("[MESSAGE] Mark mention as read error:", error.message);
    return sendServerError(res, error);
  }
};

// Process mentions in a message (called after sending message)
export const processMentions = async (messageId, channelId) => {
  try {
    const message = await Message.findById(messageId).populate("sender_id");
    if (!message) return;

    // Parse mentions from message content
    const mentionedUsernames = parseMentions(message.content);

    if (mentionedUsernames.length === 0) return;

    // Find username objects in channel members
    const { User } = await import("../../models/User.js");
    const mentionedUsers = await User.find({
      $or: [
        { username: { $in: mentionedUsernames } },
        { email: { $in: mentionedUsernames } },
      ],
    }).select("_id first_name last_name email username");

    if (mentionedUsers.length === 0) return;

    // Update message with mentioned users
    message.mentioned_users = mentionedUsers.map((user) => ({
      user_id: user._id,
      username: user.username || user.email,
      mentioned_at: new Date(),
      notification_sent: false,
    }));

    await message.save();

    // ==== NEW: Create notifications for each mentioned user ====
    const { createNotification, shouldDeliverNotification } = await import("../../services/notificationService.js");
    const { ChatChannel } = await import("../../models/ChatChannel.js");

    const channel = await ChatChannel.findById(channelId).select("name");

    for (const mentionedUser of mentionedUsers) {
      const senderName = `${message.sender_id.first_name} ${message.sender_id.last_name}`;

      // Check if notification should be delivered based on preferences
      const shouldDeliver = await shouldDeliverNotification(mentionedUser._id.toString(), "mention", {
        actorId: message.sender_id._id,
        channelId,
      });

      if (shouldDeliver) {
        await createNotification(
          mentionedUser._id.toString(),
          "mention",
          `${senderName} mentioned you in #${channel?.name || "channel"}`,
          message.content.substring(0, 150),
          {
            actorId: message.sender_id._id,
            actorName: senderName,
            relatedEntityType: "message",
            relatedEntityId: messageId,
            relatedEntityName: channel?.name,
            data: {
              channel_id: channelId,
              channel_name: channel?.name,
              message_preview: message.content.substring(0, 100),
            },
            priority: "high",
          }
        );
      }
    }

    // Emit socket event for mentions
    const io = require("./../../index.js").io;
    if (io) {
      mentionedUsers.forEach((user) => {
        io.to(`channel:${channelId}`).emit("message:mentioned", {
          message_id: messageId,
          mentioned_user_id: user._id,
          mentioned_by: message.sender_id._id,
          sender_name: `${message.sender_id.first_name} ${message.sender_id.last_name}`,
          content: message.content.substring(0, 100),
        });
      });
    }
  } catch (error) {
    console.error("[MESSAGE] Process mentions error:", error.message);
  }
};

// Convert message content to HTML with mention links
const enrichMentionsWithLinks = (content) => {
  return content.replace(/@(\w+)/g, '<span class="mention" data-user="$1">@$1</span>');
};

// Get user mentions in a channel
export const getChannelMentions = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Verify user is channel member
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Get all messages with mentions in this channel
    const mentions = await Message.find({
      channel_id: channelId,
      mentioned_users: { $exists: true, $ne: [] },
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .limit(100)
      .populate("sender_id", "first_name last_name email")
      .populate("mentioned_users.user_id", "first_name last_name email")
      .select("content created_at sender_id mentioned_users")
      .lean();

    return sendSuccess(res, {
      channel_id: channelId,
      total_mentions: mentions.length,
      mentions,
    }, "Channel mentions retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get channel mentions error:", error.message);
    return sendServerError(res, error);
  }
};

// ===== PHASE 3: MESSAGE STATUS INDICATORS & REACTION ANALYTICS =====

// Mark a message as delivered to a user
export const markMessageDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return sendBadRequest(res, "Message not found");
    }

    // Check if already delivered to this user
    const alreadyDelivered = message.delivered_to?.some(
      (d) => d.user_id.toString() === userId
    );

    if (!alreadyDelivered) {
      message.delivered_to = message.delivered_to || [];
      message.delivered_to.push({
        user_id: userId,
        delivered_at: new Date(),
      });
      await message.save();
    }

    // Emit socket event for delivery status update
    const io = require("./../../index.js").io;
    if (io) {
      io.to(`channel:${message.channel_id}`).emit("message:delivered", {
        message_id: messageId,
        delivered_to: userId,
        delivered_at: new Date(),
        delivered_count: message.delivered_to.length,
      });
    }

    return sendSuccess(res, {
      message_id: messageId,
      delivered_count: message.delivered_to.length,
    }, "Message marked as delivered");
  } catch (error) {
    console.error("[MESSAGE] Mark delivered error:", error.message);
    return sendServerError(res, error);
  }
};

// Get message delivery and read status
export const getMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId)
      .populate("delivered_to.user_id", "first_name last_name email")
      .populate("seen_by.user_id", "first_name last_name email");

    if (!message) {
      return sendBadRequest(res, "Message not found");
    }

    // Check if user has permission to view status (sender or channel member)
    const isChannelMember = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!isChannelMember && message.sender_id.toString() !== userId) {
      return sendForbidden(res, "You don't have permission to view this message status");
    }

    // Prepare status data
    const deliveredUsers = message.delivered_to?.map((d) => ({
      user_id: d.user_id._id,
      name: `${d.user_id.first_name} ${d.user_id.last_name}`,
      email: d.user_id.email,
      delivered_at: d.delivered_at,
    })) || [];

    const readUsers = message.seen_by?.map((s) => ({
      user_id: s.user_id._id,
      name: `${s.user_id.first_name} ${s.user_id.last_name}`,
      email: s.user_id.email,
      read_at: s.seen_at,
    })) || [];

    return sendSuccess(res, {
      message_id: messageId,
      sender_id: message.sender_id,
      delivered_count: deliveredUsers.length,
      read_count: readUsers.length,
      delivered_to: deliveredUsers,
      read_by: readUsers,
    }, "Message status retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get message status error:", error.message);
    return sendServerError(res, error);
  }
};

// Get reaction analytics for a specific message
export const getReactionAnalytics = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId)
      .populate("reactions.user_id", "first_name last_name email");

    if (!message) {
      return sendBadRequest(res, "Message not found");
    }

    // Check if user is channel member
    const isChannelMember = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!isChannelMember) {
      return sendForbidden(res, "You don't have permission to view this message");
    }

    // Build reaction analytics from reactions array
    const reactionsMap = {};
    const emojiList = [];

    message.reactions?.forEach((reaction) => {
      const emoji = reaction.emoji;
      if (!reactionsMap[emoji]) {
        reactionsMap[emoji] = {
          count: 0,
          users: [],
          recent: [],
        };
        emojiList.push(emoji);
      }

      reactionsMap[emoji].count += 1;
      reactionsMap[emoji].users.push({
        user_id: reaction.user_id._id,
        name: `${reaction.user_id.first_name} ${reaction.user_id.last_name}`,
        email: reaction.user_id.email,
      });
      reactionsMap[emoji].recent.push({
        user_id: reaction.user_id._id,
        reacted_at: reaction.reacted_at,
      });
    });

    // Sort recent reactions by date (newest first)
    Object.keys(reactionsMap).forEach((emoji) => {
      reactionsMap[emoji].recent = reactionsMap[emoji].recent.sort(
        (a, b) => new Date(b.reacted_at) - new Date(a.reacted_at)
      );
    });

    // Find top emoji
    const topEmoji = emojiList.reduce((max, emoji) => {
      return reactionsMap[emoji].count > (reactionsMap[max]?.count || 0)
        ? emoji
        : max;
    }, null);

    return sendSuccess(res, {
      message_id: messageId,
      total_reactions: message.reactions?.length || 0,
      reaction_count: Object.keys(reactionsMap).length,
      reactions: reactionsMap,
      top_emoji: topEmoji,
      reaction_speed_ms: message.reactions?.length > 0
        ? new Date(message.reactions[0].reacted_at) - new Date(message.created_at)
        : null,
    }, "Reaction analytics retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get reaction analytics error:", error.message);
    return sendServerError(res, error);
  }
};

// Get channel-wide reaction analytics
export const getChannelReactionAnalytics = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
    const { period = "7d" } = req.query; // 24h, 7d, 30d

    // Check if user is channel member
    const isChannelMember = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!isChannelMember) {
      return sendForbidden(res, "You are not a member of this channel");
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get messages with reactions in time period
    const messages = await Message.find({
      channel_id: channelId,
      created_at: { $gte: startDate, $lte: now },
      reactions: { $exists: true, $ne: [] },
      deleted_at: null,
    })
      .populate("reactions.user_id", "first_name last_name email")
      .select("reactions created_at");

    // Aggregate reaction data
    const emojiStats = {};
    const reactorStats = {};
    let totalReactions = 0;

    messages.forEach((message) => {
      message.reactions?.forEach((reaction) => {
        const emoji = reaction.emoji;
        const userId = reaction.user_id._id.toString();

        // Track emoji stats
        if (!emojiStats[emoji]) {
          emojiStats[emoji] = {
            count: 0,
            users: [],
          };
        }
        emojiStats[emoji].count += 1;

        // Track unique users per emoji
        if (!emojiStats[emoji].users.includes(userId)) {
          emojiStats[emoji].users.push(userId);
        }

        // Track reactor stats
        if (!reactorStats[userId]) {
          reactorStats[userId] = {
            user_id: reaction.user_id._id,
            name: `${reaction.user_id.first_name} ${reaction.user_id.last_name}`,
            email: reaction.user_id.email,
            reaction_count: 0,
          };
        }
        reactorStats[userId].reaction_count += 1;

        totalReactions += 1;
      });
    });

    // Convert emoji stats users count
    Object.keys(emojiStats).forEach((emoji) => {
      emojiStats[emoji].users = emojiStats[emoji].users.length;
    });

    // Sort emojis by count descending
    const sortedEmojis = Object.entries(emojiStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([emoji, data]) => ({ emoji, ...data }));

    // Sort reactors by count
    const topReactors = Object.values(reactorStats)
      .sort((a, b) => b.reaction_count - a.reaction_count)
      .slice(0, 10);

    const channelMembers = await ChannelMember.find({ channel_id: channelId });

    return sendSuccess(res, {
      channel_id: channelId,
      period,
      total_reactions: totalReactions,
      message_count: messages.length,
      reactions_per_message: messages.length > 0 ? (totalReactions / messages.length).toFixed(2) : 0,
      engagement_rate: messages.length > 0 ? ((totalReactions / (messages.length * channelMembers.length)) * 100).toFixed(2) : 0,
      most_used_emojis: sortedEmojis.slice(0, 5).map((e) => e.emoji),
      emoji_stats: sortedEmojis,
      top_reactors: topReactors,
    }, "Channel reaction analytics retrieved successfully");
  } catch (error) {
    console.error("[MESSAGE] Get channel reaction analytics error:", error.message);
    return sendServerError(res, error);
  }
};

/**
 * Notify all channel members about new message
 * Creates notifications for all members (except sender)
 * @param {ObjectId} messageId - Message ID
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} senderId - Sender's user ID
 * @param {string} messageContent - Message content preview
 */
export const notifyChannelMembers = async (
  messageId,
  channelId,
  senderId,
  messageContent
) => {
  try {
    console.log(`[MESSAGE NOTIFICATION] ⏳ Starting notification for message ${messageId}`);

    // Import Notification model and controller
    const { Notification } = await import("../../models/Notification.js");
    const { shouldDeliverNotification } = await import(
      "../../controllers/notification/notification.controller.js"
    );

    // Get sender info
    const sender = await User.findById(senderId).select("first_name last_name profile_picture");

    if (!sender) {
      console.warn("[MESSAGE NOTIFICATION] ❌ Sender not found:", senderId);
      return;
    }

    // Get channel info
    const channel = await ChatChannel.findById(channelId).select("name");

    if (!channel) {
      console.warn("[MESSAGE NOTIFICATION] ❌ Channel not found:", channelId);
      return;
    }

    // Get all channel members
    const channelMembers = await ChannelMember.find({
      channel_id: channelId,
    }).select("user_id");

    if (!channelMembers || channelMembers.length === 0) {
      console.log("[MESSAGE NOTIFICATION] ⚠️ No channel members found");
      return;
    }

    console.log(`[MESSAGE NOTIFICATION] 👥 Found ${channelMembers.length} channel members`);

    const senderName = `${sender.first_name} ${sender.last_name}`;
    const messagePreview = messageContent.substring(0, 150); // First 150 chars
    const senderAvatar = sender.profile_picture || null;

    let notificationsSent = 0;
    let notificationsSkipped = 0;

    // Create notifications for all members except sender
    for (const member of channelMembers) {
      const memberId = member.user_id._id || member.user_id;

      // Skip sender
      if (memberId.toString() === senderId.toString()) {
        console.log(`[MESSAGE NOTIFICATION] ⏭️ Skipping sender (${memberId})`);
        continue;
      }

      // Check if notification should be delivered based on user preferences
      const shouldDeliver = await shouldDeliverNotification(
        memberId,
        senderId,
        channelId,
        "message"
      );

      if (shouldDeliver) {
        console.log(`[MESSAGE NOTIFICATION] ✅ Delivering to user ${memberId}`);

        try {
          // Create notification in database
          const notification = new Notification({
            user_id: memberId,
            type: "message",
            title: `New message from ${senderName}`,
            body: messagePreview,
            source_id: messageId,
            source_type: "message",
            channel_id: channelId,
            sender_id: senderId,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            is_read: false,
            action_url: `/chat/${channelId}`,
            metadata: {
              messagePreview,
              senderRole: "member",
            },
          });

          await notification.save();

          // Emit real-time socket event to user
          const receiverSocketId = await getReceiverSocketId(memberId);
          if (receiverSocketId && io) {
            io.to(receiverSocketId).emit("notification:new", {
              notification: notification.toObject(),
              type: "message",
              channelId,
              senderName,
              messagePreview,
            });
          }

          notificationsSent++;
        } catch (error) {
          console.error(
            `[MESSAGE NOTIFICATION] ❌ Failed to create notification for user ${memberId}:`,
            error.message
          );
        }
      } else {
        console.log(
          `[MESSAGE NOTIFICATION] ⏭️ Notification blocked for user ${memberId} (preferences/DND)`
        );
        notificationsSkipped++;
      }
    }

    console.log(
      `[MESSAGE NOTIFICATION] ✅ COMPLETED - Sent: ${notificationsSent}, Skipped: ${notificationsSkipped}`
    );
  } catch (error) {
    console.error("[MESSAGE NOTIFICATION] ❌ Error:", error.message);
    console.error("[MESSAGE NOTIFICATION] Stack:", error.stack);
    // Don't throw - this is async and shouldn't break message sending
  }
};
