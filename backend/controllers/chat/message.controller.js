import { Message } from "../../models/Message.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { channel_id, content, message_type, parent_message_id } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!channel_id || !content) {
      return res
        .status(400)
        .json({ error: "channel_id and content are required" });
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Validate parent message if provided
    if (parent_message_id) {
      const parentMessage = await Message.findById(parent_message_id);
      if (
        !parentMessage ||
        parentMessage.channel_id.toString() !== channel_id
      ) {
        return res.status(400).json({ error: "Invalid parent message" });
      }
    }

    // Create message
    const message = new Message({
      channel_id,
      sender_id: userId,
      content,
      message_type: message_type || "text",
      parent_message_id: parent_message_id || null,
    });

    await message.save();

    // Populate and return message
    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id");

    res.status(201).json({
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
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
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
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

    // Pagination
    if (before) {
      query.created_at = { $lt: new Date(before) };
    }
    if (after) {
      query.created_at = { $gt: new Date(after) };
    }

    // Get messages
    const messages = await Message.find(query)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id")
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    // Get reply counts for each message
    const messagesWithReplies = await Promise.all(
      messages.map(async (message) => {
        const replyCount = await Message.countDocuments({
          parent_message_id: message._id,
          deleted_at: null,
        });
        return {
          ...message.toObject(),
          reply_count: replyCount,
        };
      })
    );

    res.json({
      count: messagesWithReplies.length,
      messages: messagesWithReplies.reverse(), // Oldest first
    });
  } catch (error) {
    console.error("Get channel messages error:", error);
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Get replies
    const replies = await Message.find({
      parent_message_id: message._id,
      deleted_at: null,
    })
      .populate("sender_id", "first_name last_name email user_type")
      .sort({ created_at: 1 });

    res.json({
      message,
      replies,
    });
  } catch (error) {
    console.error("Get message by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Edit message
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender_id.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own messages" });
    }

    // Check if message is deleted
    if (message.deleted_at) {
      return res.status(400).json({ error: "Cannot edit deleted message" });
    }

    // Update message
    message.content = content;
    message.edited_at = new Date();
    await message.save();

    const updatedMessage = await Message.findById(id).populate(
      "sender_id",
      "first_name last_name email user_type"
    );

    res.json({
      message: "Message updated successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete message (soft delete)
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the sender or channel admin
    const membership = await ChannelMember.findOne({
      channel_id: message.channel_id,
      user_id: userId,
    });

    const isSender = message.sender_id.toString() === userId;
    const isAdmin = membership && membership.role === "admin";

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        error:
          "You can only delete your own messages or if you are a channel admin",
      });
    }

    // Soft delete
    message.deleted_at = new Date();
    message.content = "[Message deleted]";
    await message.save();

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: parentMessage.channel_id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Get all replies
    const replies = await Message.find({
      parent_message_id: id,
      deleted_at: null,
    })
      .populate("sender_id", "first_name last_name email user_type")
      .sort({ created_at: 1 });

    res.json({
      parent_message: parentMessage,
      replies,
      reply_count: replies.length,
    });
  } catch (error) {
    console.error("Get thread error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Search messages in a channel
export const searchMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { query, limit = 20 } = req.query;
    const userId = req.userId;

    if (!query) {
      return res.status(400).json({ error: "search query is required" });
    }

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Search messages
    const messages = await Message.find({
      channel_id: channelId,
      deleted_at: null,
      content: { $regex: query, $options: "i" },
    })
      .populate("sender_id", "first_name last_name email user_type")
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    res.json({
      count: messages.length,
      query,
      messages,
    });
  } catch (error) {
    console.error("Search messages error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get unread message count for user
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    // Get all user's channels
    const memberships = await ChannelMember.find({ user_id: userId });
    const channelIds = memberships.map((m) => m.channel_id);

    // Get unread count per channel
    const unreadCounts = await Promise.all(
      memberships.map(async (membership) => {
        const count = await Message.countDocuments({
          channel_id: membership.channel_id,
          created_at: { $gt: membership.joined_at },
          sender_id: { $ne: userId },
          deleted_at: null,
        });

        return {
          channel_id: membership.channel_id,
          unread_count: count,
        };
      })
    );

    const totalUnread = unreadCounts.reduce(
      (sum, item) => sum + item.unread_count,
      0
    );

    res.json({
      total_unread: totalUnread,
      channels: unreadCounts,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: error.message });
  }
};
