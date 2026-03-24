import { Schema, model } from "mongoose";

const scheduledMessageSchema = new Schema(
  {
    // Reference to channel
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: "ChatChannel",
      required: true,
      index: true,
    },
    // Sender of the scheduled message
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // When to send the message
    scheduled_send_time: {
      type: Date,
      required: true,
      index: true,
    },
    // The actual message content to send
    content: {
      type: String,
      required: true,
    },
    // Message type (text, file, etc.)
    message_type: {
      type: String,
      enum: ["text", "file", "system"],
      default: "text",
    },
    // Rich content (Phase 2 feature)
    rich_content: {
      format: {
        type: String,
        enum: ["html", "markdown", "plaintext"],
        default: "plaintext",
      },
      styled_content: String,
      plain_text: String,
    },
    // File attachment info (if applicable)
    file_url: String,
    file_name: String,
    file_type: String,
    file_size: Number,
    cloudinary_public_id: String,
    // Parent message ID for threading
    parent_message_id: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    // Scheduling status
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    // When it was actually sent (if successful)
    sent_at: Date,
    // Error message if failed
    error_message: String,
    // Retry tracking
    retry_count: {
      type: Number,
      default: 0,
    },
    max_retries: {
      type: Number,
      default: 3,
    },
    // Reference to actual message if already sent
    sent_message_id: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    // When the scheduled message was created
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We manage timestamps manually
  }
);

// Compound indexes for common queries
scheduledMessageSchema.index({ channel_id: 1, status: 1 });
scheduledMessageSchema.index({ sender_id: 1, status: 1 });
scheduledMessageSchema.index({ scheduled_send_time: 1, status: 1 }); // For background job
scheduledMessageSchema.index({ created_at: -1, sender_id: 1 }); // For user's scheduled messages list

export const ScheduledMessage = model("ScheduledMessage", scheduledMessageSchema);
