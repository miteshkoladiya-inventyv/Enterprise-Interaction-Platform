import { Schema, model } from "mongoose";

const notificationPreferenceSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // Master toggle
    notifications_enabled: {
      type: Boolean,
      default: true,
    },
    // Desktop/browser notifications toggle
    desktop_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    // Only notify on @mentions (ignore regular messages)
    mention_only: {
      type: Boolean,
      default: false,
    },
    // Do Not Disturb settings
    do_not_disturb_enabled: {
      type: Boolean,
      default: false,
    },
    do_not_disturb_start: {
      type: String, // Format: HH:MM (24-hour)
      default: "22:00",
    },
    do_not_disturb_end: {
      type: String, // Format: HH:MM (24-hour)
      default: "08:00",
    },
    // Channels to mute
    muted_channels: [
      {
        type: Schema.Types.ObjectId,
        ref: "ChatChannel",
      },
    ],
    // Users to mute (don't notify from these users)
    muted_users: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export const NotificationPreference = model(
  "NotificationPreference",
  notificationPreferenceSchema
);
