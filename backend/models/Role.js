import { Schema, model } from "mongoose";

const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    display_name: {
      type: String,
      required: true,
      trim: true,
    },
    hierarchy_level: {
      type: Number,
      required: true,
      default: 0,
    },
    permissions: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
    },
    is_system: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
roleSchema.index({ name: 1 });
roleSchema.index({ hierarchy_level: 1 });

export default model("Role", roleSchema);
