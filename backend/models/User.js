import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    user_type: {
      type: String,
      enum: ["admin", "employee", "customer"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "inactive"],
      default: "pending",
    },
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      unique: true,
      trim: true,
    },
    country: {
      type: String,
      enum: ["germany", "india", "usa"],
      required: true,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    profile_picture: {
      type: String,
      default: null,
    },
    date_of_birth: {
      type: Date,
      default: null,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    last_login: {
      type: Date,
    },
    // Password reset fields
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ user_type: 1 });
userSchema.index({ company_id: 1 });
userSchema.index({ resetPasswordToken: 1 });

export default mongoose.model("User", userSchema);
