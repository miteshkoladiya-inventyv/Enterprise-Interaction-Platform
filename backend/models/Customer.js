import { Schema, model } from "mongoose";

const customerSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    customer_type: {
      type: String,
      enum: ["individual", "business"],
      required: true,
    },
    assigned_support_agent_id: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    subscription_tier: {
      type: String,
      trim: true,
    },
    onboarding_status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
customerSchema.index({ user_id: 1 });
customerSchema.index({ assigned_support_agent_id: 1 });
customerSchema.index({ customer_type: 1 });

export const Customer = model("Customer", customerSchema);
