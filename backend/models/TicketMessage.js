import { Schema, model } from "mongoose";

const ticketMessageSchema = new Schema(
  {
    ticket_id: {
      type: Schema.Types.ObjectId,
      ref: "SupportTicket",
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
      enum: ["text", "system", "file", "meeting"],
      default: "text",
    },
    file_url: {
      type: String,
    },
    file_name: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

ticketMessageSchema.index({ ticket_id: 1, created_at: -1 });
ticketMessageSchema.index({ sender_id: 1 });

export const TicketMessage = model("TicketMessage", ticketMessageSchema);
