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
  searchMessagesInChannel,
} from "../controllers/chat/chat.controller.js";
import {
  sendMessage,
  getChannelMessages,
  getMessageById,
  editMessage,
  deleteMessage,
  getThread,
  searchMessages,
  getUnreadCount,
} from "../controllers/chat/message.controller.js";
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
router.get("/channels/:channelId/search", searchMessages);

// Get unread message count
router.get("/unread", getUnreadCount);

// Search messages in a channel
router.get("/channels/:channelId/messages/search", searchMessagesInChannel);

export default router;
