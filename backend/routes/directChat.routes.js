import express from "express";
import {
  searchUsers,
  getUserById,
  startDirectChat,
  getDirectChats,
  getRecentContacts,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  clearConversation,
  getUnreadCount,
  markMessagesAsSeen,
  getMessageSeenStatus,
  getUnreadMessageCount,
  deleteFileMessage,
  uploadFileMessage,
  toggleReaction,
  saveCallLog,
} from "../controllers/chat/direct_message.controller.js";
import { upload } from "../config/cloudinary.js";

import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/search", searchUsers);
router.get("/users/:userId", getUserById);
router.post("/start", startDirectChat);
router.get("/list", getDirectChats);
router.get("/contacts", getRecentContacts);

// Message routes
router.get("/channels/:channelId/messages", getMessages);
router.post("/channels/:channelId/messages", sendMessage);
router.put("/messages/:messageId", editMessage);
router.delete("/messages/:messageId", deleteMessage);
router.delete("/channels/:channelId/clear", clearConversation);
router.get("/channels/:channelId/unread", getUnreadCount);

// NEW: Seen/Read receipt routes
router.post("/channels/:channelId/messages/seen", markMessagesAsSeen);
router.get("/messages/:messageId/seen-status", getMessageSeenStatus);
router.get("/channels/:channelId/unread-count", getUnreadMessageCount);

// File upload route
router.post(
  "/channels/:channelId/messages/upload",
  upload.single("file"),
  uploadFileMessage
);

// Delete file message (optional)
router.delete("/messages/:messageId/file", deleteFileMessage);

// Reaction routes
router.post("/messages/:messageId/reactions", toggleReaction);

// Call history route
router.post("/channels/:channelId/call-log", saveCallLog);

// Add to your routes file for testing
router.post("/test-upload", verifyToken, upload.single("file"), (req, res) => {
  console.log("Test upload - File:", req.file);
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    success: true,
    file: req.file,
    message: "Test upload successful",
  });
});

export default router;
