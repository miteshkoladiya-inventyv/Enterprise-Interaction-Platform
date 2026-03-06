import { Schema, model } from "mongoose";

const supportTicketSchema = new Schema(
  {
    ticket_number: {
      type: String,
      required: true,
      unique: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    assigned_agent_id: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    collaborators: [
      {
        type: Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "open", "in_progress", "resolved", "closed"],
      default: "pending",
    },
    category: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      enum: ["germany", "india", "usa"],
    },
    resolved_at: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
supportTicketSchema.index({ ticket_number: 1 });
supportTicketSchema.index({ customer_id: 1 });
supportTicketSchema.index({ assigned_agent_id: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ country: 1 });

export const SupportTicket = model("SupportTicket", supportTicketSchema);
