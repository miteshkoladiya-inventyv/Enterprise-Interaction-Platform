import { Schema, model } from "mongoose";

const channelMemberSchema = new Schema(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: "ChatChannel",
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate memberships
channelMemberSchema.index({ channel_id: 1, user_id: 1 }, { unique: true });
channelMemberSchema.index({ channel_id: 1 });
channelMemberSchema.index({ user_id: 1 });

export const ChannelMember = model("ChannelMember", channelMemberSchema);
