import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import Department from "../../models/Department.js";
import { sendEmail } from "../../utils/emailService.js";
import { generateTempPassword } from "../../utils/passwordGenerator.js";

// Admin: Reset password to temp and send via email
export const adminResetPasswordToTemp = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id).populate("user_id");
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const user = employee.user_id;
    const tempPassword = generateTempPassword();

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(tempPassword, salt);
    await user.save();

    const loginUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/login`;
    await sendEmail({
      to: user.email,
      subject: "Your Password Has Been Reset",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset by Administrator</h2>
          <p>Hello ${user.first_name},</p>
          <p>Your password has been reset by an administrator. Below are your new temporary credentials:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 5px; border-radius: 3px;">${tempPassword}</code></p>
          </div>
          <p style="color: #d9534f;"><strong>Important:</strong> Please change your password after logging in.</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Login to Your Account</a>
          <br>
          <p style="color: #666;">Best regards,<br>HR Team</p>
        </div>
      `,
    });

    res.json({ message: "Temporary password sent to employee email" });
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Change employee password directly
export const adminChangePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const employee = await Employee.findById(id).populate("user_id");
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const user = employee.user_id;
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Your Password Has Been Changed",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Changed</h2>
          <p>Hello ${user.first_name},</p>
          <p>Your password has been changed by an administrator.</p>
          <p>You can now log in with your new password. If you did not authorize this change, please contact IT support immediately.</p>
          <br>
          <p style="color: #666;">Best regards,<br>HR Team</p>
        </div>
      `,
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Admin change password error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create Employee (Admin/HR only)
export const createEmployee = async (req, res) => {
  try {
    const {
      email,
      first_name,
      last_name,
      phone,
      country,
      timezone,
      employee_type,
      department,
      position,
      team_lead_id,
      hire_date,
    } = req.body;

    // Prevent creating admin accounts
    console.log(req.body);
    if (req.body.user_type === "admin") {
      return res.status(403).json({
        error: "Cannot create admin accounts through this endpoint",
      });
    }

    // Define positions that require a team lead
    const positionsRequiringTeamLead = ["senior_engineer", "engineer", "junior_engineer", "intern"];
    const positionsRequiringDepartment = [
      "project_manager",
      "team_lead",
      "senior_engineer",
      "engineer",
      "junior_engineer",
      "intern",
    ];
    const leadershipPositions = ["ceo", "cto", "project_manager", "team_lead"];

    // Validation based on employee_type
    if (employee_type === "internal_team") {
      // Position is required for internal_team
      if (!position) {
        return res.status(400).json({
          error: "Position is required for internal team members",
        });
      }

      // Department is required for specific positions
      if (positionsRequiringDepartment.includes(position)) {
        if (!department) {
          return res.status(400).json({
            error: `Department is required for ${position} position`,
          });
        }
      }

      // Team lead validation for specific positions
      if (positionsRequiringTeamLead.includes(position)) {
        if (!team_lead_id) {
          return res.status(400).json({
            error: `Team lead is required for ${position} position`,
          });
        }

        // Verify that the team lead exists and has appropriate position
        const teamLead = await Employee.findById(team_lead_id).populate(
          "user_id"
        );
        if (!teamLead) {
          return res.status(400).json({
            error: "Invalid team lead ID",
          });
        }

        // Verify team lead has appropriate position
        if (!leadershipPositions.includes(teamLead.position)) {
          return res.status(400).json({
            error: "Team lead must have a leadership position",
          });
        }
      }
    } else if (employee_type === "customer_support") {
      // For customer_support, position, department, and team_lead_id should not be set
      // We'll ignore these fields even if they're sent
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log("already Exists");
      return res.status(400).json({ error: "User already exists" });
    }

    // Check phone number if provided
    if (phone) {
      const existingPhoneNumber = await User.findOne({ phone });
      if (existingPhoneNumber) {
        console.log("Phone number already Exists");
        return res.status(400).json({
          error: "Phone number already exists. Try with diff phone number",
        });
      }
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    console.log({ tempPassword });
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(tempPassword, salt);
    console.log({ tempPassword, email });

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password_hash,
      user_type: "employee",
      status: "active",
      first_name,
      last_name,
      phone: phone || undefined,
      country,
      timezone: timezone || "UTC",
    });

    await user.save();

    // Create employee record based on employee_type
    const employeeData = {
      user_id: user._id,
      employee_type,
      hire_date: hire_date || new Date(),
      is_active: true,
    };

    // Add position-specific fields only for internal_team
    if (employee_type === "internal_team") {
      employeeData.position = position;

      // Add department if position requires it
      if (positionsRequiringDepartment.includes(position)) {
        employeeData.department = department;
      }

      // Add team_lead_id if position requires it
      if (positionsRequiringTeamLead.includes(position)) {
        employeeData.team_lead_id = team_lead_id;
      }
    } else if (employee_type === "customer_support") {
      // For customer_support, find or use the Customer Support department
      if (!department) {
        const csDept = await Department.findOne({ code: "CS" });
        if (csDept) {
          employeeData.department = csDept._id;
        } else {
          return res.status(400).json({
            error: "Customer Support department not found. Please run the migration script.",
          });
        }
      } else {
        employeeData.department = department;
      }
    }

    const employee = new Employee(employeeData);
    await employee.save();

    // Send welcome email with credentials
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    await sendEmail({
      to: user.email,
      subject: "Welcome to the Team - Your Account Details",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to the Team!</h2>
          <p>Hello ${first_name},</p>
          <p>Your employee account has been created successfully. Below are your login credentials:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 5px; border-radius: 3px;">${tempPassword}</code></p>
          </div>
          
          <p style="color: #d9534f;"><strong>Important:</strong> Please change your password immediately after your first login.</p>
          
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Login to Your Account</a>
          
          <p>If you have any questions, please don't hesitate to reach out to HR.</p>
          
          <br>
          <p style="color: #666;">Best regards,<br>HR Team</p>
        </div>
      `,
    });

    // Prepare response data
    const responseData = {
      message: "Employee created successfully. Credentials sent to email.",
      employee: {
        id: employee._id,
        user_id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_type: employee.employee_type,
      },
    };

    // Add optional fields to response if they exist
    if (employee.department) {
      responseData.employee.department = employee.department;
    }
    if (employee.position) {
      responseData.employee.position = employee.position;
    }
    if (employee.team_lead_id) {
      responseData.employee.team_lead_id = employee.team_lead_id;
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error("Create employee error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Employees
export const getAllEmployees = async (req, res) => {
  try {
    const { department, position, employee_type, is_active, page, limit, search } = req.query;

    // Build filter
    const filter = {};
    if (department && department !== "all") filter.department = department;
    if (position) filter.position = position;
    if (employee_type) filter.employee_type = employee_type;
    if (is_active !== undefined) filter.is_active = is_active === "true";

    // If search is provided, we need to find matching user IDs first
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const matchingUsers = await User.find({
        $or: [
          { first_name: searchRegex },
          { last_name: searchRegex },
          { email: searchRegex },
        ],
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);
      filter.user_id = { $in: userIds };
    }

    // Server-side pagination (optional — if page param is provided)
    if (page) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
      const skip = (pageNum - 1) * pageSize;

      const [employees, total] = await Promise.all([
        Employee.find(filter)
          .populate({ path: "user_id", select: "-password_hash" })
          .populate("department")
          .populate({
            path: "team_lead_id",
            populate: { path: "user_id", select: "first_name last_name email" },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize),
        Employee.countDocuments(filter),
      ]);

      return res.json({
        employees,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    }

    // No pagination — return all (backward compatible)
    const employees = await Employee.find(filter)
      .populate({
        path: "user_id",
        select: "-password_hash",
      })
      .populate("department")
      .populate({
        path: "team_lead_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email",
        },
      })
      .sort({ createdAt: -1 });

    res.json({
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Get all employees error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get Employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id)
      .populate({
        path: "user_id",
        select: "-password_hash",
      })
      .populate("department")
      .populate({
        path: "team_lead_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email",
        },
      });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ user: employee });
  } catch (error) {
    console.error("Get employee by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update Employee
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      country,
      timezone,
      department,
      position,
      team_lead_id,
      employee_type,
      is_active,
      hire_date,
    } = req.body;

    // Find employee
    const employee = await Employee.findById(id).populate("user_id");
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Update user details
    if (first_name) employee.user_id.first_name = first_name;
    if (last_name) employee.user_id.last_name = last_name;
    if (phone) employee.user_id.phone = phone;
    if (country) employee.user_id.country = country;
    if (timezone) employee.user_id.timezone = timezone;

    await employee.user_id.save();

    // Update employee details
    if (department) employee.department = department;
    if (position) employee.position = position;
    if (team_lead_id !== undefined)
      employee.team_lead_id = team_lead_id || null;
    if (employee_type) employee.employee_type = employee_type;
    if (is_active !== undefined) employee.is_active = is_active;
    if (hire_date) employee.hire_date = hire_date;

    await employee.save();

    // Populate and return updated employee
    const updatedEmployee = await Employee.findById(id)
      .populate({
        path: "user_id",
        select: "-password_hash",
      })
      .populate("department")
      .populate({
        path: "team_lead_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email",
        },
      });

    res.json({
      message: "Employee updated successfully",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete Employee (soft delete - mark as inactive)
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id).populate("user_id");
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Soft delete: mark as inactive
    employee.is_active = false;
    employee.user_id.status = "inactive";

    await employee.save();
    await employee.user_id.save();

    res.json({
      message: "Employee deactivated successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ error: error.message });
  }
};
