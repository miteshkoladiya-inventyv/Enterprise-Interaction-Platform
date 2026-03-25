import express from "express";
import {
  createChannel,
  getUserChannels,
  getChannelById,
  addChannelMembers,
  removeChannelMember,
  updateMemberRole,
  leaveChannel,
  deleteChannel,
  updateChannelName,
  updateChannelAvatar,
  searchMessagesInChannel,
} from "../controllers/chat/chat.controller.js";
import {
  sendMessage,
  getChannelMessages,
  getMessageById,
  editMessage,
  deleteMessage,
  getThread,
  getUnreadCount,
  toggleStarMessage,
  getStarredMessages,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  getMyMentions,
  markMentionAsRead,
  getChannelMentions,
  markMessageDelivered,
  getMessageStatus,
  getReactionAnalytics,
  getChannelReactionAnalytics,
} from "../controllers/chat/message.controller.js";
import {
  uploadFileMessage,
  deleteFileMessage,
} from "../controllers/chat/direct_message.controller.js";
import {
  scheduleMessage,
  getScheduledMessages,
  getChannelScheduledMessages,
  editScheduledMessage,
  cancelScheduledMessage,
  sendScheduledMessageNow,
} from "../controllers/chat/scheduling.controller.js";
import { upload } from "../config/cloudinary.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============ Channel Routes ============

// Create a new channel
router.post("/", createChannel);

// Get all channels for current user
router.get("/channels", getUserChannels);

// Get channel by ID
router.get("/channels/:id", getChannelById);

// Add members to channel
router.post("/channels/:id/members", addChannelMembers);

// Update member role in channel
router.put("/channels/:id/members/:memberId", updateMemberRole);

// Remove member from channel
router.delete("/channels/:id/members/:memberId", removeChannelMember);

// Leave channel
router.post("/channels/:id/leave", leaveChannel);

// Delete channel
router.delete("/channels/:id", deleteChannel);

// Update channel name (admin only)
router.post("/channels/:channelId/name", updateChannelName);

// Update channel avatar (admin only)
router.post(
  "/channels/:channelId/avatar",
  upload.single("avatar"),
  updateChannelAvatar
);

// ============ Message Routes ============

// Send a message
router.post("/messages", sendMessage);

// Get messages in a channel
router.get("/channels/:channelId/messages", getChannelMessages);

// Get message by ID
router.get("/messages/:id", getMessageById);

// Edit message
router.put("/messages/:id", editMessage);

// Delete message
router.delete("/messages/:id", deleteMessage);

// Get thread (message with replies)
router.get("/messages/:id/thread", getThread);

// Search messages in a channel
router.get("/channels/:channelId/search", searchMessagesInChannel);

// Get unread message count
router.get("/unread", getUnreadCount);

// ============ File Upload Routes ============

// Upload file message to channel
router.post(
  "/channels/:channelId/messages/upload",
  upload.single("file"),
  uploadFileMessage
);

// Delete file message
router.delete("/messages/:messageId/file", deleteFileMessage);

// ============ Phase 1: Starred Messages Routes ============

// Toggle star on message
router.post("/messages/:messageId/star", toggleStarMessage);

// Get current user's starred messages
router.get("/starred", getStarredMessages);

// ============ Phase 1: Message Pinning Routes ============

// Pin message in channel
router.post("/channels/:channelId/pin/:messageId", pinMessage);

// Unpin message
router.delete("/channels/:channelId/pin/:messageId", unpinMessage);

// Get all pinned messages in channel
router.get("/channels/:channelId/pinned", getPinnedMessages);

// ============ Phase 2: @Mentions Routes ============

// Get current user's mentions
router.get("/mentions", getMyMentions);

// Mark mention as read
router.post("/messages/:messageId/mention/read", markMentionAsRead);

// Get mentions in a specific channel
router.get("/channels/:channelId/mentions", getChannelMentions);

// ============ Phase 3: Message Status Indicators Routes ============

// Mark message as delivered
router.post("/messages/:messageId/delivered", markMessageDelivered);

// Get message delivery and read status
router.get("/messages/:messageId/status", getMessageStatus);

// ============ Phase 3: Reaction Analytics Routes ============

// Get reaction analytics for a message
router.get("/messages/:messageId/reactions/analytics", getReactionAnalytics);

// Get channel-wide reaction analytics
router.get("/channels/:channelId/reactions/analytics", getChannelReactionAnalytics);

// ============ Phase 4: Message Scheduling Routes ============

// Schedule a message to send later
router.post("/messages/schedule", scheduleMessage);

// Get current user's scheduled messages
router.get("/scheduled-messages", getScheduledMessages);

// Get scheduled messages in a channel
router.get("/channels/:channelId/scheduled", getChannelScheduledMessages);

// Edit a scheduled message
router.put("/scheduled-messages/:scheduledMessageId", editScheduledMessage);

// Cancel a scheduled message
router.delete("/scheduled-messages/:scheduledMessageId", cancelScheduledMessage);

// Send a scheduled message immediately (don't wait for scheduled time)
router.post("/scheduled-messages/:scheduledMessageId/send", sendScheduledMessageNow);

export default router;
