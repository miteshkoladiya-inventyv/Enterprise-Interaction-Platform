import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employee_type: {
      type: String,
      enum: ["customer_support", "internal_team"],
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    position: {
      type: String,
      enum: [
        "ceo",
        "cto",
        "project_manager",
        "team_lead",
        "senior_engineer",
        "engineer",
        "junior_engineer",
        "intern",
      ],
      required: function () {
        return this.employee_type === "internal_team";
      },
    },
    team_lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: function () {
        return (
          this.employee_type === "internal_team" &&
          this.position &&
          ["senior_engineer", "engineer", "junior_engineer", "intern"].includes(
            this.position
          )
        );
      },
    },
    hire_date: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
employeeSchema.index({ user_id: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ employee_type: 1 });
employeeSchema.index({ team_lead_id: 1 });

export default mongoose.model("Employee", employeeSchema);
