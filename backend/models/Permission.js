import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: String,
    category: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

permissionSchema.index({ category: 1 });

export default mongoose.model("Permission", permissionSchema);
