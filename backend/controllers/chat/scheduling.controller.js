import { Message } from "../../models/Message.js";
import { ScheduledMessage } from "../../models/ScheduledMessage.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import {
  sendSuccess,
  sendError,
  sendCreated,
  sendForbidden,
  sendBadRequest,
  sendServerError,
} from "../../utils/responseFormatter.js";
import { validateMessageContent } from "../../utils/validation.js";

// Schedule a message to send later
export const scheduleMessage = async (req, res) => {
  try {
    const { channel_id, content, scheduled_send_time, message_type, parent_message_id, rich_content, file_url, file_name, file_type, file_size, cloudinary_public_id } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!channel_id || !content || !scheduled_send_time) {
      return sendBadRequest(res, "channel_id, content, and scheduled_send_time are required");
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

    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduled_send_time);
    if (scheduledTime <= new Date()) {
      return sendBadRequest(res, "Scheduled send time must be in the future");
    }

    // Validate parent message if provided
    if (parent_message_id) {
      const parentMessage = await Message.findById(parent_message_id);
      if (!parentMessage || parentMessage.channel_id.toString() !== channel_id) {
        return sendBadRequest(res, "Invalid parent message");
      }
    }

    // Create scheduled message
    const scheduledMessage = new ScheduledMessage({
      channel_id,
      sender_id: userId,
      content: validatedContent,
      scheduled_send_time: scheduledTime,
      message_type: message_type || "text",
      parent_message_id: parent_message_id || null,
      rich_content: rich_content || null,
      file_url: file_url || null,
      file_name: file_name || null,
      file_type: file_type || null,
      file_size: file_size || null,
      cloudinary_public_id: cloudinary_public_id || null,
      status: "pending",
    });

    await scheduledMessage.save();

    // Populate sender info
    const populatedMessage = await ScheduledMessage.findById(scheduledMessage._id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id");

    return sendCreated(res, populatedMessage, "Message scheduled successfully");
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Schedule message error:", error.message);
    return sendServerError(res, error);
  }
};

// Get current user's scheduled messages
export const getScheduledMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 50, offset = 0, status = "pending" } = req.query;

    const query = {
      sender_id: userId,
    };

    if (status) {
      query.status = status;
    }

    const scheduledMessages = await ScheduledMessage.find(query)
      .sort({ scheduled_send_time: 1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate("sender_id", "first_name last_name email")
      .populate("channel_id", "name channel_type")
      .populate("parent_message_id", "content");

    const total = await ScheduledMessage.countDocuments(query);

    return sendSuccess(
      res,
      {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        scheduled_messages: scheduledMessages,
      },
      "Scheduled messages retrieved successfully"
    );
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Get scheduled messages error:", error.message);
    return sendServerError(res, error);
  }
};

// Get scheduled messages in a channel
export const getChannelScheduledMessages = async (req, res) => {
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

    const scheduledMessages = await ScheduledMessage.find({
      channel_id: channelId,
      status: "pending",
    })
      .sort({ scheduled_send_time: 1 })
      .populate("sender_id", "first_name last_name email")
      .populate("parent_message_id", "content");

    return sendSuccess(
      res,
      {
        channel_id: channelId,
        scheduled_count: scheduledMessages.length,
        scheduled_messages: scheduledMessages,
      },
      "Channel scheduled messages retrieved successfully"
    );
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Get channel scheduled messages error:", error.message);
    return sendServerError(res, error);
  }
};

// Edit a scheduled message (before it's sent)
export const editScheduledMessage = async (req, res) => {
  try {
    const { scheduledMessageId } = req.params;
    const { content, scheduled_send_time, rich_content } = req.body;
    const userId = req.userId;

    const scheduledMessage = await ScheduledMessage.findById(scheduledMessageId);
    if (!scheduledMessage) {
      return sendBadRequest(res, "Scheduled message not found");
    }

    // Only sender can edit
    if (scheduledMessage.sender_id.toString() !== userId) {
      return sendForbidden(res, "You can only edit your own scheduled messages");
    }

    // Can only edit pending messages
    if (scheduledMessage.status !== "pending") {
      return sendBadRequest(res, `Cannot edit ${scheduledMessage.status} messages`);
    }

    // Validate new scheduled time if provided
    if (scheduled_send_time) {
      const newTime = new Date(scheduled_send_time);
      if (newTime <= new Date()) {
        return sendBadRequest(res, "Scheduled send time must be in the future");
      }
      scheduledMessage.scheduled_send_time = newTime;
    }

    // Update content if provided
    if (content) {
      try {
        scheduledMessage.content = validateMessageContent(content);
      } catch (validationError) {
        return sendBadRequest(res, validationError.message);
      }
    }

    // Update rich content if provided
    if (rich_content) {
      scheduledMessage.rich_content = rich_content;
    }

    await scheduledMessage.save();

    const updatedMessage = await ScheduledMessage.findById(scheduledMessageId)
      .populate("sender_id", "first_name last_name email");

    return sendSuccess(res, updatedMessage, "Scheduled message updated successfully");
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Edit scheduled message error:", error.message);
    return sendServerError(res, error);
  }
};

// Cancel a scheduled message
export const cancelScheduledMessage = async (req, res) => {
  try {
    const { scheduledMessageId } = req.params;
    const userId = req.userId;

    const scheduledMessage = await ScheduledMessage.findById(scheduledMessageId);
    if (!scheduledMessage) {
      return sendBadRequest(res, "Scheduled message not found");
    }

    // Only sender can cancel
    if (scheduledMessage.sender_id.toString() !== userId) {
      return sendForbidden(res, "You can only cancel your own scheduled messages");
    }

    // Can only cancel pending messages
    if (scheduledMessage.status !== "pending") {
      return sendBadRequest(res, `Cannot cancel ${scheduledMessage.status} messages`);
    }

    scheduledMessage.status = "cancelled";
    await scheduledMessage.save();

    // Emit socket event
    const io = require("./../../index.js").io;
    if (io) {
      io.to(`channel:${scheduledMessage.channel_id}`).emit("message:scheduled-cancelled", {
        scheduled_message_id: scheduledMessageId,
        channel_id: scheduledMessage.channel_id,
      });
    }

    return sendSuccess(res, { scheduled_message_id: scheduledMessageId }, "Scheduled message cancelled successfully");
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Cancel scheduled message error:", error.message);
    return sendServerError(res, error);
  }
};

// Send a scheduled message immediately (don't wait for scheduled time)
export const sendScheduledMessageNow = async (req, res) => {
  try {
    const { scheduledMessageId } = req.params;
    const userId = req.userId;

    const scheduledMessage = await ScheduledMessage.findById(scheduledMessageId);
    if (!scheduledMessage) {
      return sendBadRequest(res, "Scheduled message not found");
    }

    // Only sender can send
    if (scheduledMessage.sender_id.toString() !== userId) {
      return sendForbidden(res, "You can only send your own scheduled messages");
    }

    // Can only send pending messages
    if (scheduledMessage.status !== "pending") {
      return sendBadRequest(res, `Cannot send ${scheduledMessage.status} messages`);
    }

    // Create and save the actual message
    const message = new Message({
      channel_id: scheduledMessage.channel_id,
      sender_id: scheduledMessage.sender_id,
      content: scheduledMessage.content,
      message_type: scheduledMessage.message_type,
      parent_message_id: scheduledMessage.parent_message_id || null,
      rich_content: scheduledMessage.rich_content || null,
      file_url: scheduledMessage.file_url || null,
      file_name: scheduledMessage.file_name || null,
      file_type: scheduledMessage.file_type || null,
      file_size: scheduledMessage.file_size || null,
      cloudinary_public_id: scheduledMessage.cloudinary_public_id || null,
    });

    await message.save();

    // Update scheduled message status
    scheduledMessage.status = "sent";
    scheduledMessage.sent_at = new Date();
    scheduledMessage.sent_message_id = message._id;
    await scheduledMessage.save();

    // Populate the message
    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "first_name last_name email user_type")
      .populate("parent_message_id");

    // Emit socket event
    const io = require("./../../index.js").io;
    if (io) {
      io.to(`channel:${message.channel_id}`).emit("new_message", populatedMessage);
    }

    return sendSuccess(
      res,
      {
        scheduled_message_id: scheduledMessageId,
        message_id: message._id,
      },
      "Scheduled message sent successfully"
    );
  } catch (error) {
    console.error("[SCHEDULED MESSAGE] Send scheduled message now error:", error.message);
    return sendServerError(res, error);
  }
};
