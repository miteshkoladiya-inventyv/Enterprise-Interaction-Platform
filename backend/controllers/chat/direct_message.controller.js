// controllers/directChat.controller.js
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { Message } from "../../models/Message.js";
import { getReceiverSocketId, io } from "../../socket/socketServer.js";
import { cloudinary } from "../../config/cloudinary.js";

// Search users for direct chat
export const searchUsers = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    const currentUserId = req.userId;
    console.log(query);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Search users by name or email
    const users = await User.find({
      _id: { $ne: currentUserId }, // Exclude current user
      status: "active", // Only active users
      $or: [
        { first_name: { $regex: query, $options: "i" } },
        { last_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .select("first_name last_name email user_type country profile_picture")
      .limit(parseInt(limit));

    // Get employee details if user is employee
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        let employeeInfo = null;

        if (user.user_type === "employee") {
          const employee = await Employee.findOne({ user_id: user._id }).select(
            "department position employee_type"
          );
          employeeInfo = employee;
        }

        // Check if direct chat already exists
        const existingChat = await findExistingDirectChat(
          currentUserId,
          user._id
        );

        return {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          user_type: user.user_type,
          country: user.country,
          profile_picture: user.profile_picture,
          employee_info: employeeInfo,
          has_existing_chat: !!existingChat,
          existing_chat_id: existingChat?._id || null,
        };
      })
    );

    res.json({
      count: usersWithDetails.length,
      query,
      users: usersWithDetails,
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get user details by ID
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const user = await User.findById(userId).select(
      "first_name last_name email user_type country status profile_picture"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "User is not active" });
    }

    let employeeInfo = null;
    if (user.user_type === "employee") {
      const employee = await Employee.findOne({ user_id: user._id })
        .select("department position employee_type")
        .populate("team_lead_id", "user_id")
        .populate({
          path: "team_lead_id",
          populate: {
            path: "user_id",
            select: "first_name last_name email",
          },
        });
      employeeInfo = employee;
    }

    // Check if direct chat already exists
    const existingChat = await findExistingDirectChat(currentUserId, userId);

    res.json({
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        user_type: user.user_type,
        country: user.country,
        profile_picture: user.profile_picture,
        employee_info: employeeInfo,
      },
      has_existing_chat: !!existingChat,
      existing_chat_id: existingChat?._id || null,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Start or get existing direct chat
export const startDirectChat = async (req, res) => {
  try {
    const { user_id } = req.body;
    const currentUserId = req.userId;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    if (user_id === currentUserId) {
      return res
        .status(400)
        .json({ error: "Cannot create chat with yourself" });
    }

    // Check if target user exists and is active
    const targetUser = await User.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.status !== "active") {
      return res.status(403).json({ error: "User is not active" });
    }

    // Check if direct chat already exists
    const existingChat = await findExistingDirectChat(currentUserId, user_id);

    if (existingChat) {
      // Return existing chat with details
      const populatedChat = await ChatChannel.findById(
        existingChat._id
      ).populate("created_by", "first_name last_name email");

      const members = await ChannelMember.find({
        channel_id: existingChat._id,
      }).populate("user_id", "first_name last_name email user_type profile_picture");

    return res.json({
        message: "Direct chat already exists",
        is_new: false,
        channel: populatedChat,
        members,
      });
    }

    // Create new direct chat channel
    const currentUser = await User.findById(currentUserId);
    const channelName = `${currentUser.first_name} & ${targetUser.first_name}`;

    const channel = new ChatChannel({
      channel_type: "direct",
      name: channelName,
      created_by: currentUserId,
      country_restriction: null,
    });

    await channel.save();

    // Add both users as members
    const member1 = new ChannelMember({
      channel_id: channel._id,
      user_id: currentUserId,
      role: "member",
    });

    const member2 = new ChannelMember({
      channel_id: channel._id,
      user_id: user_id,
      role: "member",
    });

    await Promise.all([member1.save(), member2.save()]);

    // Populate and return channel
    const populatedChat = await ChatChannel.findById(channel._id).populate(
      "created_by",
      "first_name last_name email"
    );

    const members = await ChannelMember.find({
      channel_id: channel._id,
    }).populate("user_id", "first_name last_name email user_type");

    const receiverSocketId = getReceiverSocketId(user_id.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("direct_chat_created", {
        _id: channel._id,
        channel_type: "direct",
        other_user: {
          _id: currentUser._id,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          full_name: `${currentUser.first_name} ${currentUser.last_name}`,
          email: currentUser.email,
          user_type: currentUser.user_type,
          profile_picture: currentUser.profile_picture,
        },
        unread_count: 0,
      });
    }

    res.status(201).json({
      message: "Direct chat created successfully",
      is_new: true,
      channel: populatedChat,
      members,
    });
  } catch (error) {
    console.error("Start direct chat error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all direct chats for current user
export const getDirectChats = async (req, res) => {
  try {
    const currentUserId = req.userId;

    const memberships = await ChannelMember.find({ user_id: currentUserId });
    const channelIds = memberships.map((m) => m.channel_id);

    const directChannels = await ChatChannel.find({
      _id: { $in: channelIds },
      channel_type: "direct",
    })
      .populate("created_by", "first_name last_name email")
      .sort({ created_at: -1 });

    const chatsWithDetails = await Promise.all(
      directChannels.map(async (channel) => {
        const members = await ChannelMember.find({
          channel_id: channel._id,
        }).populate("user_id", "first_name last_name email user_type status profile_picture");

        const otherMember = members.find(
          (m) => m.user_id._id.toString() !== currentUserId
        );

        const lastMessage = await Message.findOne({
          channel_id: channel._id,
          deleted_at: null,
        })
          .sort({ created_at: -1 })
          .populate("sender_id", "first_name last_name");

        // Calculate unread count based on seen_by
        const unreadCount = await Message.countDocuments({
          channel_id: channel._id,
          sender_id: { $ne: currentUserId },
          "seen_by.user_id": { $ne: currentUserId },
          deleted_at: null,
        });

        return {
          _id: channel._id,
          channel_type: channel.channel_type,
          name: channel.name,
          created_at: channel.created_at,
          other_user: otherMember
            ? {
                _id: otherMember.user_id._id,
                first_name: otherMember.user_id.first_name,
                last_name: otherMember.user_id.last_name,
                full_name: `${otherMember.user_id.first_name} ${otherMember.user_id.last_name}`,
                email: otherMember.user_id.email,
                user_type: otherMember.user_id.user_type,
                status: otherMember.user_id.status,
                profile_picture: otherMember.user_id.profile_picture,
              }
            : null,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    res.json({
      count: chatsWithDetails.length,
      chats: chatsWithDetails,
    });
  } catch (error) {
    console.error("Get direct chats error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to find existing direct chat between two users
async function findExistingDirectChat(userId1, userId2) {
  // Find channels where both users are members
  const user1Channels = await ChannelMember.find({ user_id: userId1 }).select(
    "channel_id"
  );
  const user1ChannelIds = user1Channels.map((m) => m.channel_id.toString());

  const user2Channels = await ChannelMember.find({ user_id: userId2 }).select(
    "channel_id"
  );
  const user2ChannelIds = user2Channels.map((m) => m.channel_id.toString());

  // Find common channels
  const commonChannelIds = user1ChannelIds.filter((id) =>
    user2ChannelIds.includes(id)
  );

  if (commonChannelIds.length === 0) {
    return null;
  }

  // Find direct channel among common channels
  for (const channelId of commonChannelIds) {
    const channel = await ChatChannel.findById(channelId);

    if (channel && channel.channel_type === "direct") {
      // Verify it's a 1-on-1 chat (exactly 2 members)
      const memberCount = await ChannelMember.countDocuments({
        channel_id: channelId,
      });

      if (memberCount === 2) {
        return channel;
      }
    }
  }

  return null;
}

// Get recent contacts (users you've chatted with)
export const getRecentContacts = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { limit = 10 } = req.query;

    // Get all direct chats
    const memberships = await ChannelMember.find({ user_id: currentUserId });
    const channelIds = memberships.map((m) => m.channel_id);

    const directChannels = await ChatChannel.find({
      _id: { $in: channelIds },
      channel_type: "direct",
    }).select("_id");

    const directChannelIds = directChannels.map((c) => c._id);

    // Get all members from these channels (excluding current user)
    const allMembers = await ChannelMember.find({
      channel_id: { $in: directChannelIds },
      user_id: { $ne: currentUserId },
    })
      .populate("user_id", "first_name last_name email user_type profile_picture")
      .limit(parseInt(limit));

    // Remove duplicates and format
    const uniqueUsers = [];
    const seenUserIds = new Set();

    for (const member of allMembers) {
      const userId = member.user_id._id.toString();
      if (!seenUserIds.has(userId)) {
        seenUserIds.add(userId);
        uniqueUsers.push({
          _id: member.user_id._id,
          first_name: member.user_id.first_name,
          last_name: member.user_id.last_name,
          full_name: `${member.user_id.first_name} ${member.user_id.last_name}`,
          email: member.user_id.email,
          user_type: member.user_id.user_type,
          profile_picture: member.user_id.profile_picture,
        });
      }
    }

    res.json({
      count: uniqueUsers.length,
      contacts: uniqueUsers,
    });
  } catch (error) {
    console.error("Get recent contacts error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get messages for a channel (UPDATED with parent_message_id population)
export const getMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const currentUserId = req.userId;
    const { limit = 50, before } = req.query;

    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: currentUserId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    const query = {
      channel_id: channelId,
      deleted_at: null,
    };

    if (before) {
      query.created_at = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("seen_by.user_id", "first_name last_name email user_type")
      .populate({
        path: "parent_message_id",
        select: "content sender_id created_at",
        populate: {
          path: "sender_id",
          select: "first_name last_name email user_type",
        },
      })
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    const sortedMessages = messages.reverse();

    res.json({
      count: sortedMessages.length,
      channel_id: channelId,
      messages: sortedMessages.map((msg) => ({
        _id: msg._id,
        content: msg.content,
        sender_id: msg.sender_id._id,
        sender: {
          _id: msg.sender_id._id,
          first_name: msg.sender_id.first_name,
          last_name: msg.sender_id.last_name,
          full_name: `${msg.sender_id.first_name} ${msg.sender_id.last_name}`,
          email: msg.sender_id.email,
          user_type: msg.sender_id.user_type,
        },
        // ✅ CRITICAL FIX: Include message_type and all file fields
        message_type: msg.message_type || "text",
        file_url: msg.file_url || null,
        file_name: msg.file_name || null,
        file_type: msg.file_type || null,
        file_size: msg.file_size || null,
        cloudinary_public_id: msg.cloudinary_public_id || null,
        // End of file fields
        parent_message_id: msg.parent_message_id?._id || null,
        parent_message: msg.parent_message_id
          ? {
              _id: msg.parent_message_id._id,
              content: msg.parent_message_id.content,
              sender_id: msg.parent_message_id.sender_id._id,
              sender: {
                _id: msg.parent_message_id.sender_id._id,
                first_name: msg.parent_message_id.sender_id.first_name,
                last_name: msg.parent_message_id.sender_id.last_name,
                full_name: `${msg.parent_message_id.sender_id.first_name} ${msg.parent_message_id.sender_id.last_name}`,
              },
              created_at: msg.parent_message_id.created_at,
            }
          : null,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        is_edited: msg.updated_at > msg.created_at,
        is_own: msg.sender_id._id.toString() === currentUserId,
        seen_by: msg.seen_by.map((s) => ({
          user_id: {
            _id: s.user_id._id,
            first_name: s.user_id.first_name,
            last_name: s.user_id.last_name,
            full_name: `${s.user_id.first_name} ${s.user_id.last_name}`,
            email: s.user_id.email,
          },
          seen_at: s.seen_at,
        })),
        seen_count: msg.seen_by.length,
        is_seen: msg.seen_by.some(
          (s) => s.user_id._id.toString() === currentUserId
        ),
        // Reactions grouped by emoji
        reactions: (() => {
          const grouped = {};
          for (const r of msg.reactions || []) {
            if (!grouped[r.emoji]) grouped[r.emoji] = [];
            grouped[r.emoji].push(r.user_id.toString());
          }
          return grouped;
        })(),
        // Call log data
        call_log: msg.call_log || null,
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ FIXED: Send a message with proper sender information in socket event
export const sendMessage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, parent_message_id } = req.body;
    const currentUserId = req.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: currentUserId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Verify parent message exists if provided
    if (parent_message_id) {
      const parentMessage = await Message.findById(parent_message_id);
      if (
        !parentMessage ||
        parentMessage.channel_id.toString() !== channelId ||
        parentMessage.deleted_at
      ) {
        return res.status(400).json({ error: "Invalid parent message" });
      }
    }

    const message = new Message({
      channel_id: channelId,
      sender_id: currentUserId,
      content: content.trim(),
      message_type: "text", // ✅ Explicitly set for text messages
      parent_message_id: parent_message_id || null,
      seen_by: [],
    });

    await message.save();

    await ChatChannel.findByIdAndUpdate(channelId, {
      last_message_at: message.created_at,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("seen_by.user_id", "first_name last_name email user_type")
      .populate({
        path: "parent_message_id",
        select: "content sender_id created_at",
        populate: {
          path: "sender_id",
          select: "first_name last_name email user_type",
        },
      });

    const channelMembers = await ChannelMember.find({
      channel_id: channelId,
    });

    // ✅ FIX: Create complete message data with sender information
    const messageData = {
      _id: populatedMessage._id,
      channel_id: channelId,
      content: populatedMessage.content,
      sender_id: populatedMessage.sender_id._id,
      sender: {
        _id: populatedMessage.sender_id._id,
        first_name: populatedMessage.sender_id.first_name,
        last_name: populatedMessage.sender_id.last_name,
        full_name: `${populatedMessage.sender_id.first_name} ${populatedMessage.sender_id.last_name}`,
        email: populatedMessage.sender_id.email,
        user_type: populatedMessage.sender_id.user_type,
      },
      message_type: populatedMessage.message_type || "text", // ✅ Include message_type
      parent_message_id: populatedMessage.parent_message_id?._id || null,
      parent_message: populatedMessage.parent_message_id
        ? {
            _id: populatedMessage.parent_message_id._id,
            content: populatedMessage.parent_message_id.content,
            sender_id: populatedMessage.parent_message_id.sender_id._id,
            sender: {
              _id: populatedMessage.parent_message_id.sender_id._id,
              first_name:
                populatedMessage.parent_message_id.sender_id.first_name,
              last_name: populatedMessage.parent_message_id.sender_id.last_name,
              full_name: `${populatedMessage.parent_message_id.sender_id.first_name} ${populatedMessage.parent_message_id.sender_id.last_name}`,
            },
            created_at: populatedMessage.parent_message_id.created_at,
          }
        : null,
      created_at: populatedMessage.created_at,
      updated_at: populatedMessage.updated_at,
      is_edited: false,
      seen_by: [],
      seen_count: 0,
    };

    // Emit to ALL members. If a member's socket isn't registered yet (e.g. just logged in),
    // retry delivery for a short period so they get the message when they connect.
    const MESSAGE_DELIVERY_RETRY_MS = 500;
    const MESSAGE_DELIVERY_RETRY_ATTEMPTS = 20; // 10 seconds

    const emitToMember = (memberUserId, isOwn) => {
      const receiverSocketId = getReceiverSocketId(memberUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("new_message", {
          ...messageData,
          is_own: isOwn,
        });
        return true;
      }
      return false;
    };

    channelMembers.forEach((member) => {
      const memberUserId = member.user_id.toString();
      const isOwn = memberUserId === currentUserId;

      if (emitToMember(memberUserId, isOwn)) {
        console.log(`📤 Emitted message to user ${memberUserId}`);
        return;
      }

      let attempts = 0;
      const retryInterval = setInterval(() => {
        attempts++;
        if (emitToMember(memberUserId, isOwn)) {
          console.log(`📤 Emitted message to user ${memberUserId} (delayed)`);
          clearInterval(retryInterval);
        } else if (attempts >= MESSAGE_DELIVERY_RETRY_ATTEMPTS) {
          clearInterval(retryInterval);
        }
      }, MESSAGE_DELIVERY_RETRY_MS);
    });

    res.status(201).json({
      message: "Message sent successfully",
      data: {
        ...messageData,
        is_own: true,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Edit a message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const currentUserId = req.userId;

    // Validate input
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is the sender
    if (message.sender_id.toString() !== currentUserId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own messages" });
    }

    // Check if message was deleted
    if (message.deleted_at) {
      return res.status(400).json({ error: "Cannot edit deleted message" });
    }

    // Update message
    message.content = content.trim();
    message.updated_at = new Date();
    await message.save();

    // Populate sender details
    const populatedMessage = await Message.findById(message._id).populate(
      "sender_id",
      "first_name last_name email user_type"
    );

    res.json({
      message: "Message updated successfully",
      data: {
        _id: populatedMessage._id,
        content: populatedMessage.content,
        sender_id: populatedMessage.sender_id._id,
        sender: {
          _id: populatedMessage.sender_id._id,
          first_name: populatedMessage.sender_id.first_name,
          last_name: populatedMessage.sender_id.last_name,
          full_name: `${populatedMessage.sender_id.first_name} ${populatedMessage.sender_id.last_name}`,
          email: populatedMessage.sender_id.email,
          user_type: populatedMessage.sender_id.user_type,
        },
        created_at: populatedMessage.created_at,
        updated_at: populatedMessage.updated_at,
        is_edited: true,
        is_own: true,
      },
    });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.userId;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is the sender
    if (message.sender_id.toString() !== currentUserId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own messages" });
    }

    // Check if already deleted
    if (message.deleted_at) {
      return res.status(400).json({ error: "Message already deleted" });
    }

    // Soft delete
    message.deleted_at = new Date();
    await message.save();

    // Notify all channel members about the deletion in real-time
    const channelMembers = await ChannelMember.find({
      channel_id: message.channel_id,
    });
    channelMembers.forEach((member) => {
      const memberSocketId = getReceiverSocketId(member.user_id.toString());
      if (memberSocketId) {
        io.to(memberSocketId).emit("message_deleted", {
          message_id: messageId,
          channel_id: message.channel_id.toString(),
        });
      }
    });

    res.json({
      message: "Message deleted successfully",
      message_id: messageId,
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Clear all messages in a conversation (soft delete all)
export const clearConversation = async (req, res) => {
  try {
    const { channelId } = req.params;
    const currentUserId = req.userId;

    // Verify channel exists
    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Verify user is a member
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: currentUserId,
    });
    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Soft delete all non-deleted messages in this channel
    const result = await Message.updateMany(
      { channel_id: channelId, deleted_at: null },
      { $set: { deleted_at: new Date() } }
    );

    // Notify all channel members about the conversation being cleared
    const channelMembers = await ChannelMember.find({ channel_id: channelId });
    channelMembers.forEach((member) => {
      const memberSocketId = getReceiverSocketId(member.user_id.toString());
      if (memberSocketId) {
        io.to(memberSocketId).emit("conversation_cleared", {
          channel_id: channelId,
        });
      }
    });

    res.json({
      message: "Conversation cleared successfully",
      deleted_count: result.modifiedCount,
    });
  } catch (error) {
    console.error("Clear conversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get unread message count for a channel
export const getUnreadCount = async (req, res) => {
  try {
    const { channelId } = req.params;
    const currentUserId = req.userId;

    // Verify user is a member
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: currentUserId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Count unread messages
    const unreadCount = await Message.countDocuments({
      channel_id: channelId,
      created_at: { $gt: membership.last_read_at || membership.joined_at },
      sender_id: { $ne: currentUserId },
      deleted_at: null,
    });

    res.json({
      channel_id: channelId,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Mark all messages as seen when user opens a chat (UPDATED with user info in socket event)
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Verify channel exists
    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Verify user is a member of the channel
    const isMember = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of this channel" });
    }

    // Find all unseen messages in this channel (excluding user's own messages)
    const unseenMessages = await Message.find({
      channel_id: channelId,
      sender_id: { $ne: userId },
      "seen_by.user_id": { $ne: userId },
      deleted_at: null,
    });

    if (unseenMessages.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unseen messages",
        markedCount: 0,
      });
    }

    // Mark all messages as seen by this user
    const result = await Message.updateMany(
      {
        channel_id: channelId,
        sender_id: { $ne: userId },
        "seen_by.user_id": { $ne: userId },
        deleted_at: null,
      },
      {
        $addToSet: {
          seen_by: {
            user_id: userId,
            seen_at: new Date(),
          },
        },
      }
    );

    // Get user information to send with the socket event
    const user = await User.findById(userId).select(
      "first_name last_name email user_type"
    );

    // Emit socket event to notify sender that message was seen
    const channelMembers = await ChannelMember.find({
      channel_id: channelId,
    });

    channelMembers.forEach((member) => {
      if (member.user_id.toString() !== userId) {
        const receiverSocketId = getReceiverSocketId(member.user_id.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messages_seen", {
            channel_id: channelId,
            seen_by_user_id: userId,
            seen_by_user: {
              _id: user._id,
              first_name: user.first_name,
              last_name: user.last_name,
              full_name: `${user.first_name} ${user.last_name}`,
              email: user.email,
            },
            message_ids: unseenMessages.map((m) => m._id),
          });
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Messages marked as seen",
      markedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking messages as seen:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get message seen status (for read receipts)
export const getMessageSeenStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId)
      .populate("seen_by.user_id", "first_name last_name email")
      .populate("channel_id");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is a member
    const isMember = await ChannelMember.findOne({
      channel_id: message.channel_id._id,
      user_id: userId,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of this channel" });
    }

    // Get all channel members
    const allMembers = await ChannelMember.find({
      channel_id: message.channel_id._id,
    }).populate("user_id", "first_name last_name email");

    // Exclude the sender from the count
    const membersExcludingSender = allMembers.filter(
      (member) => member.user_id._id.toString() !== message.sender_id.toString()
    );

    const totalMembers = membersExcludingSender.length;
    const seenCount = message.seen_by.length;
    const isSeenByAll = seenCount === totalMembers;

    return res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        seenBy: message.seen_by.map((s) => ({
          user_id: {
            _id: s.user_id._id,
            first_name: s.user_id.first_name,
            last_name: s.user_id.last_name,
            full_name: `${s.user_id.first_name} ${s.user_id.last_name}`,
            email: s.user_id.email,
          },
          seen_at: s.seen_at,
        })),
        seenCount,
        totalMembers,
        isSeenByAll,
        channelType: message.channel_id.channel_type,
      },
    });
  } catch (error) {
    console.error("Error getting message seen status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get unread message count for a channel
export const getUnreadMessageCount = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const unreadCount = await Message.countDocuments({
      channel_id: channelId,
      sender_id: { $ne: userId },
      "seen_by.user_id": { $ne: userId },
      deleted_at: null,
    });

    return res.status(200).json({
      success: true,
      channelId,
      unreadCount,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadFileMessage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { caption } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      if (req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(404).json({ error: "Channel not found" });
    }

    const membershipExists = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membershipExists) {
      if (req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Create the message with file data
    const newMessage = new Message({
      channel_id: channelId,
      sender_id: userId,
      content: caption || req.file.originalname,
      message_type: "file", // ✅ Explicitly set
      file_url: req.file.path,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      cloudinary_public_id: req.file.filename,
    });

    await newMessage.save();
    await newMessage.populate(
      "sender_id",
      "first_name last_name full_name email user_type"
    );

    // ✅ Complete response object
    const messageResponse = {
      _id: newMessage._id,
      channel_id: newMessage.channel_id,
      sender_id: newMessage.sender_id._id,
      content: newMessage.content,
      message_type: "file", // ✅ Critical field
      file_url: newMessage.file_url,
      file_name: newMessage.file_name,
      file_type: newMessage.file_type,
      file_size: newMessage.file_size,
      cloudinary_public_id: newMessage.cloudinary_public_id,
      created_at: newMessage.created_at,
      updated_at: newMessage.updated_at,
      sender: {
        _id: newMessage.sender_id._id,
        first_name: newMessage.sender_id.first_name,
        last_name: newMessage.sender_id.last_name,
        full_name: newMessage.sender_id.full_name,
        email: newMessage.sender_id.email,
        user_type: newMessage.sender_id.user_type,
      },
      is_own: true,
      seen_by: [],
      seen_count: 0,
    };

    // ✅ Emit socket event with complete data
    if (io) {
      const channelMembers = await ChannelMember.find({
        channel_id: channelId,
        user_id: { $ne: userId },
      }).select("user_id");

      const socketMessage = {
        ...messageResponse,
        is_own: false,
      };

      channelMembers.forEach((member) => {
        const receiverId = member.user_id.toString();

        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("new_message", socketMessage);
        }
      });
    }

    res.status(201).json({
      success: true,
      data: messageResponse,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    if (req.file && req.file.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    res.status(500).json({
      error: "Failed to upload file",
      message: error.message,
    });
  }
};

// Optional: Delete file message (also removes from Cloudinary)
export const deleteFileMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender_id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "You can only delete your own messages" });
    }

    // Delete file from Cloudinary if it exists
    if (message.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(message.cloudinary_public_id, {
          resource_type: "auto",
        });
      } catch (cloudinaryError) {
        console.error("Error deleting from Cloudinary:", cloudinaryError);
      }
    }

    // Soft delete the message
    message.deleted_at = new Date();
    await message.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(message.channel_id.toString()).emit("message_deleted", {
        message_id: messageId,
        channel_id: message.channel_id,
      });
    }

    res.json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting file message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
};

// ============ Reaction Endpoints ============

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Toggle reaction on a message (add if not present, remove if already reacted with same emoji)
export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.userId;

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ error: "Invalid emoji" });
    }

    const message = await Message.findById(messageId);
    if (!message || message.deleted_at) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is member of the channel
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: currentUserId,
    });
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this channel" });
    }

    // Check if user already reacted with this emoji
    const existingIdx = message.reactions.findIndex(
      (r) => r.user_id.toString() === currentUserId && r.emoji === emoji
    );

    let action;
    if (existingIdx >= 0) {
      // Remove reaction
      message.reactions.splice(existingIdx, 1);
      action = "removed";
    } else {
      // Add reaction
      message.reactions.push({ emoji, user_id: currentUserId });
      action = "added";
    }

    await message.save();

    // Get user info for socket broadcast
    const user = await User.findById(currentUserId).select("first_name last_name");

    // Build grouped reactions for response
    const groupedReactions = {};
    for (const r of message.reactions) {
      if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = [];
      groupedReactions[r.emoji].push(r.user_id.toString());
    }

    const reactionData = {
      message_id: messageId,
      channel_id: message.channel_id.toString(),
      emoji,
      user_id: currentUserId,
      user_name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
      action,
      reactions: groupedReactions,
    };

    // Emit to all channel members
    const channelMembers = await ChannelMember.find({ channel_id: message.channel_id });
    channelMembers.forEach((member) => {
      const socketId = getReceiverSocketId(member.user_id.toString());
      if (socketId) {
        io.to(socketId).emit("message_reaction", reactionData);
      }
    });

    res.json({ success: true, action, reactions: groupedReactions });
  } catch (error) {
    console.error("Toggle reaction error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ============ Call History Endpoint ============

// Save a call log message when a call ends
export const saveCallLog = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { call_type, status, duration, started_at, ended_at, participant_id } = req.body;
    const currentUserId = req.userId;

    if (!call_type || !status) {
      return res.status(400).json({ error: "call_type and status are required" });
    }

    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: currentUserId,
    });
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this channel" });
    }

    // Build content string based on call status
    const contentMap = {
      completed: `${call_type === "video" ? "Video" : "Audio"} call · ${formatDuration(duration || 0)}`,
      missed: `Missed ${call_type === "video" ? "video" : "audio"} call`,
      rejected: `${call_type === "video" ? "Video" : "Audio"} call declined`,
      no_answer: `${call_type === "video" ? "Video" : "Audio"} call · No answer`,
    };

    const message = new Message({
      channel_id: channelId,
      sender_id: currentUserId,
      content: contentMap[status] || "Call ended",
      message_type: "call",
      call_log: {
        call_type,
        status,
        duration: duration || 0,
        started_at: started_at || new Date(),
        ended_at: ended_at || new Date(),
        participants: [currentUserId, participant_id].filter(Boolean),
      },
      seen_by: [],
    });

    await message.save();

    await ChatChannel.findByIdAndUpdate(channelId, {
      last_message_at: message.created_at,
    });

    const sender = await User.findById(currentUserId).select("first_name last_name email user_type");

    const messageData = {
      _id: message._id,
      channel_id: channelId,
      content: message.content,
      sender_id: currentUserId,
      sender: {
        _id: sender._id,
        first_name: sender.first_name,
        last_name: sender.last_name,
        full_name: `${sender.first_name} ${sender.last_name}`,
        email: sender.email,
        user_type: sender.user_type,
      },
      message_type: "call",
      call_log: message.call_log,
      created_at: message.created_at,
      seen_by: [],
      seen_count: 0,
      reactions: [],
    };

    // Emit to all channel members
    const channelMembers = await ChannelMember.find({ channel_id: channelId });
    channelMembers.forEach((member) => {
      const memberUserId = member.user_id.toString();
      const socketId = getReceiverSocketId(memberUserId);
      if (socketId) {
        io.to(socketId).emit("new_message", {
          ...messageData,
          is_own: memberUserId === currentUserId,
        });
      }
    });

    res.status(201).json({ success: true, data: { ...messageData, is_own: true } });
  } catch (error) {
    console.error("Save call log error:", error);
    res.status(500).json({ error: error.message });
  }
};

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}
