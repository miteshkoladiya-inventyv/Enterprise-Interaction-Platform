import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    head_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    parent_department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    type: {
      type: String,
      enum: ["department", "team"],
      default: "department",
    },
    color: {
      type: String,
      default: "#6366f1",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

departmentSchema.index({ code: 1 });
departmentSchema.index({ parent_department_id: 1 });
departmentSchema.index({ head_id: 1 });

// Virtual: child departments
departmentSchema.virtual("children", {
  ref: "Department",
  localField: "_id",
  foreignField: "parent_department_id",
});

export default mongoose.model("Department", departmentSchema);
