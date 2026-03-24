import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["message", "mention", "meeting", "system", "audio_call", "video_call", "call"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    // Source information
    source_id: {
      type: Schema.Types.ObjectId,
    },
    source_type: {
      type: String,
      enum: ["message", "meeting", "ticket", "system", "call", "audio_call", "video_call"],
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: "ChatChannel",
    },
    // Who triggered this notification
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sender_name: String,
    sender_avatar: String, // URL to avatar/profile pic
    // Status tracking
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
    },
    read_at: Date,
    // Action information
    action_url: String, // URL to navigate when clicked (e.g., /chat/channelId)
    // Additional metadata
    metadata: {
      messagePreview: String, // First ~100 chars of message
      senderRole: String, // admin, moderator, member
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes for performance
notificationSchema.index({ user_id: 1, is_read: -1, created_at: -1 }); // For unread notifications list
notificationSchema.index({ user_id: 1, created_at: -1 }); // For all notifications list
notificationSchema.index({ source_id: 1, source_type: 1 }); // For duplicate prevention
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days auto-delete

export const Notification = model("Notification", notificationSchema);
