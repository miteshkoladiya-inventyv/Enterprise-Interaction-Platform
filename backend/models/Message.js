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
    // ===== PHASE 1: STARRED MESSAGES & MESSAGE PINNING =====
    // Starred Messages
    starred_by: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Message Pinning
    is_pinned: {
      type: Boolean,
      default: false,
    },
    pinned_at: {
      type: Date,
    },
    pinned_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    pin_reason: {
      type: String,
    },
    // ===== PHASE 2: RICH TEXT FORMATTING & @MENTIONS =====
    // Rich Text Formatting
    rich_content: {
      format: {
        type: String,
        enum: ["html", "markdown", "plaintext"],
        default: "plaintext",
      },
      styled_content: {
        type: String, // HTML or markdown with formatting
      },
      plain_text: {
        type: String, // Plain text version for search/fallback
      },
    },
    // @Mentions
    mentioned_users: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        username: {
          type: String,
        },
        mentioned_at: {
          type: Date,
          default: Date.now,
        },
        notification_sent: {
          type: Boolean,
          default: false,
        },
      },
    ],
    mention_notifications: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        read_at: {
          type: Date,
        },
      },
    ],
    // ===== PHASE 3: MESSAGE STATUS INDICATORS & REACTION ANALYTICS =====
    // Message Delivery Status
    delivered_to: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        delivered_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Reaction Analytics
    reaction_analytics: {
      total_reactions: {
        type: Number,
        default: 0,
      },
      reactions_by_emoji: {
        type: Map,
        of: {
          count: {
            type: Number,
            default: 0,
          },
          users: [
            {
              type: Schema.Types.ObjectId,
              ref: "User",
            },
          ],
          recent: [
            {
              user_id: {
                type: Schema.Types.ObjectId,
                ref: "User",
              },
              reacted_at: {
                type: Date,
                default: Date.now,
              },
            },
          ],
        },
        default: new Map(),
      },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Indexes - single and compound
messageSchema.index({ channel_id: 1, created_at: -1 });
messageSchema.index({ sender_id: 1 });
messageSchema.index({ parent_message_id: 1 });
messageSchema.index({ "seen_by.user_id": 1 });
messageSchema.index({ "reactions.user_id": 1 });

// Indexes for Phase 1 features: Starred Messages & Pinning
messageSchema.index({ starred_by: 1 });
messageSchema.index({ is_pinned: 1, channel_id: 1, pinned_at: -1 });
messageSchema.index({ channel_id: 1, is_pinned: 1 });

// Indexes for Phase 2 features: @Mentions & Rich Text
messageSchema.index({ "mentioned_users.user_id": 1 });
messageSchema.index({ "mention_notifications.user_id": 1 });

// Indexes for Phase 3 features: Status Indicators & Reaction Analytics
messageSchema.index({ "delivered_to.user_id": 1 });
messageSchema.index({ channel_id: 1, "delivered_to.user_id": 1 });

// Compound indexes for common queries
messageSchema.index({ channel_id: 1, parent_message_id: 1, deleted_at: 1 });
messageSchema.index({ channel_id: 1, sender_id: 1, created_at: -1 });

// Text index for search functionality
messageSchema.index({ content: "text" });

// Virtual to check if message has been seen by at least one user
messageSchema.virtual("is_seen_by_any").get(function () {
  return this.seen_by && this.seen_by.length > 0;
});

// Virtual for starred count (Phase 1)
messageSchema.virtual("starred_count").get(function () {
  return this.starred_by ? this.starred_by.length : 0;
});

// Virtual for delivered count (Phase 3)
messageSchema.virtual("delivered_count").get(function () {
  return this.delivered_to ? this.delivered_to.length : 0;
});

// Virtual for read count (Phase 3)
messageSchema.virtual("read_count").get(function () {
  return this.seen_by ? this.seen_by.length : 0;
});

// Virtual for total reactions (Phase 3)
messageSchema.virtual("total_reactions_count").get(function () {
  return this.reaction_analytics?.total_reactions || 0;
});

export const Message = model("Message", messageSchema);
