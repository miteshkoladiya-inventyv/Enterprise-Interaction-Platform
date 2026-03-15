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
    // Priority & urgency
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      description: "How urgent the issue is to the customer",
    },
    subscription_tier: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: "pro",
      description: "Customer subscription level affecting priority routing",
    },
    priority_score: {
      type: Number,
      default: 0,
      description: "Calculated priority score: higher = more urgent",
    },
    // Status tracking
    status: {
      type: String,
      enum: ["pending", "open", "in_progress", "resolved", "closed"],
      default: "pending",
    },
    // Timestamps for SLA
    assigned_at: { type: Date },
    started_at: { type: Date },
    resolved_at: { type: Date },
    // SLA & escalation
    sla_target_minutes: { type: Number, default: 240 }, // 4 hours default
    response_target_minutes: { type: Number, default: 60 }, // 1 hour first response
    sla_breached: { type: Boolean, default: false },
    first_response_breached: { type: Boolean, default: false },
    escalation_level: { type: Number, default: 0 }, // 0=none, 1=team_lead, 2=manager, 3=director
    is_escalated: { type: Boolean, default: false },
    // Feedback
    satisfaction_rating: { type: Number, min: 1, max: 5 },
    satisfaction_comment: { type: String },
    rated_at: { type: Date },
    // Routing
    category: {
      type: String,
      trim: true,
    },
    department_id: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      description: "Assigned department for routing",
    },
    country: {
      type: String,
      enum: ["germany", "india", "usa"],
    },
    // Declined tracking
    declined_by: [
      {
        agent_id: { type: Schema.Types.ObjectId, ref: "Employee" },
        declined_at: { type: Date, default: Date.now },
        reason: String,
      },
    ],
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
