import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    leave_type: {
      type: String,
      enum: ["paid", "floater", "marriage", "unpaid"],
      required: true,
    },
    allocated: {
      type: Number,
      default: 0,
    },
    used: {
      type: Number,
      default: 0,
    },
    carried_forward: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// One balance record per employee per year per leave type
leaveBalanceSchema.index(
  { employee_id: 1, year: 1, leave_type: 1 },
  { unique: true }
);

leaveBalanceSchema.virtual("remaining").get(function () {
  return this.allocated + this.carried_forward - this.used;
});

leaveBalanceSchema.set("toJSON", { virtuals: true });
leaveBalanceSchema.set("toObject", { virtuals: true });

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
export default LeaveBalance;
