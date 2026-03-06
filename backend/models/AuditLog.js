import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    action: {
      type: String,
      required: true,
    },

    resourceType: {
      type: String,
      required: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    metadata: {
      type: Object,
    },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
