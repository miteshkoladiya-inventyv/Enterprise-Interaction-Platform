import { Schema, model } from "mongoose";

const userRoleSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role_id: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    assigned_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assigned_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate user-role assignments
userRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });
userRoleSchema.index({ user_id: 1 });
userRoleSchema.index({ role_id: 1 });

export const UserRole = model("UserRole", userRoleSchema);
