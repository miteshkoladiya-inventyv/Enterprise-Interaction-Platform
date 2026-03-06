import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      enum: ["germany", "india", "usa"],
      required: true,
    },
    address: {
      type: String,
    },
    industry: {
      type: String,
      trim: true,
    },
    is_internal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Indexes
companySchema.index({ country: 1 });
companySchema.index({ is_internal: 1 });

export default mongoose.model("Company", companySchema);
