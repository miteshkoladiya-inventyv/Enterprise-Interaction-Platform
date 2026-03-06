import { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: "ChatChannel",
      required: true,
    },
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    message_type: {
      type: String,
      enum: ["text", "file", "system", "call"],
      default: "text",
    },
    parent_message_id: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    // Reactions
    reactions: [
      {
        emoji: { type: String, required: true },
        user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reacted_at: { type: Date, default: Date.now },
      },
    ],
    // Call history log
    call_log: {
      call_type: { type: String, enum: ["audio", "video", "group"] },
      status: {
        type: String,
        enum: ["completed", "missed", "rejected", "no_answer"],
      },
      duration: { type: Number, default: 0 }, // seconds
      started_at: { type: Date },
      ended_at: { type: Date },
      participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    file_url: {
      type: String,
    },
    file_name: {
      type: String,
    },
    file_type: {
      type: String,
    },
    file_size: {
      type: Number,
    },
    cloudinary_public_id: {
      type: String,
    },
    edited_at: {
      type: Date,
    },
    deleted_at: {
      type: Date,
    },
    // New field for tracking who has seen the message
    seen_by: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        seen_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Indexes
messageSchema.index({ channel_id: 1, created_at: -1 });
messageSchema.index({ sender_id: 1 });
messageSchema.index({ parent_message_id: 1 });
messageSchema.index({ "seen_by.user_id": 1 });
messageSchema.index({ "reactions.user_id": 1 });

// Virtual to check if all members have seen the message (for group chats)
messageSchema.virtual("is_seen_by_all").get(function () {
  return this.seen_by && this.seen_by.length > 0;
});

export const Message = model("Message", messageSchema);
