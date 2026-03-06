import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import Department from "../../models/Department.js";
import Role from "../../models/Role.js";
import { UserRole } from "../../models/UserRole.js";
import { Customer } from "../../models/Customer.js";
import { sendEmail } from "../../utils/emailService.js";
import { cloudinary } from "../../config/cloudinary.js";

// Admin Signup
export const adminSignup = async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      country,
      timezone,
      company_id,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create admin user
    const user = new User({
      email: email.toLowerCase(),
      password_hash,
      user_type: "admin",
      status: "active",
      first_name,
      last_name,
      phone,
      country,
      timezone: timezone || "UTC",
      company_id,
    });

    await user.save();

    // Create employee record for admin
    // Find the Administration or HR department for the admin
    let adminDept = await Department.findOne({ code: "ADM" });
    if (!adminDept) {
      adminDept = await Department.findOne({ code: "HR" });
    }
    if (!adminDept) {
      // Create a default Administration department if none exists
      adminDept = await Department.create({
        name: "Administration",
        code: "ADM",
        color: "#6366f1",
      });
    }

    const employee = new Employee({
      user_id: user._id,
      employee_type: "internal_team",
      department: adminDept._id,
      position: "ceo",
      hire_date: new Date(),
      is_active: true,
    });

    await employee.save();

    // Assign super_admin role
    const superAdminRole = await Role.findOne({ name: "super_admin" });
    if (superAdminRole) {
      await UserRole.findOneAndUpdate(
        { user_id: user._id, role_id: superAdminRole._id },
        { user_id: user._id, role_id: superAdminRole._id, assigned_at: new Date() },
        { upsert: true }
      );
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Admin account created successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Admin Login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // First try to find a native admin user
    let user = await User.findOne({
      email: email.toLowerCase(),
      user_type: "admin",
    });

    let hasAdminRole = false;

    if (!user) {
      // If no admin user found, check if an employee has an admin-level role (e.g. super_admin)
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if this user has been assigned a super_admin or admin-level role
      const adminRoles = await Role.find({
        $or: [
          { name: "super_admin" },
          { name: "admin" },
          { hierarchy_level: { $lte: 2 } },
        ],
      });
      const adminRoleIds = adminRoles.map((r) => r._id);

      const userAdminRole = await UserRole.findOne({
        user_id: user._id,
        role_id: { $in: adminRoleIds },
      });

      if (!userAdminRole) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      hasAdminRole = true;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if account is active
    if (user.status !== "active") {
      return res.status(403).json({ error: "Account is not active" });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate token — use "admin" as user_type so admin routes are accessible
    const token = jwt.sign(
      { id: user._id, user_type: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: "admin",
        original_user_type: user.user_type,
        has_admin_role: hasAdminRole,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Employee Login
export const employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase(),
      user_type: "employee",
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if account is active
    if (user.status !== "active") {
      return res.status(403).json({ error: "Account is not active" });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Get employee details
    const employee = await Employee.findOne({ user_id: user._id }).populate("department");

    if (!employee || !employee.is_active) {
      return res.status(403).json({ error: "Your employee account has been deactivated. Contact your administrator." });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, user_type: user.user_type, employee_id: employee._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        profile_picture: user.profile_picture,
        employee: {
          id: employee._id,
          department: employee.department,
          position: employee.position,
        },
      },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "New password must be at least 8 characters long",
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);

    // If user was in pending status, activate them
    // if (user.status === "pending") {
    //   user.status = "active";
    // }

    await user.save();

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: "Password Changed Successfully",
      html: `
        <h2>Password Changed</h2>
        <p>Hello ${user.first_name},</p>
        <p>Your password has been changed successfully.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <br>
        <p>Best regards,<br>Your Team</p>
      `,
    });

    res.json({ message: "Password changed successfully", success: true });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Request Password Reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        message: "If an account exists, a reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save hashed token to user (you'll need to add these fields to User model)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email
    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.first_name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this reset, please ignore this email.</p>
        <br>
        <p>Best regards,<br>Your Team</p>
      `,
    });

    res.json({
      message: "If an account exists, a reset link has been sent",
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    // Hash the token from URL
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: "Password Reset Successful",
      html: `
        <h2>Password Reset Successful</h2>
        <p>Hello ${user.first_name},</p>
        <p>Your password has been reset successfully.</p>
        <p>You can now log in with your new password.</p>
        <br>
        <p>Best regards,<br>Your Team</p>
      `,
    });

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "-password_hash -resetPasswordToken -resetPasswordExpire"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // If user is admin or employee, also fetch the employee record
    const employee = await Employee.findOne({ user_id: userId }).populate("department");

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || "",
        country: user.country,
        timezone: user.timezone,
        user_type: user.user_type,
        status: user.status,
        last_login: user.last_login,
        profile_picture: user.profile_picture,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      employee: employee
        ? {
            id: employee._id,
            department: employee.department,
            position: employee.position,
            employee_type: employee.employee_type,
          }
        : null,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update current user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone, timezone } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update allowed fields
    if (first_name !== undefined) user.first_name = first_name.trim();
    if (last_name !== undefined) user.last_name = last_name.trim();
    if (phone !== undefined) user.phone = phone.trim() || undefined;
    if (timezone !== undefined) user.timezone = timezone;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || "",
        country: user.country,
        timezone: user.timezone,
        user_type: user.user_type,
        status: user.status,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Upload / Update Profile Picture
export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // If user already has a profile picture, delete the old one from Cloudinary
    if (user.profile_picture) {
      try {
        // Extract public_id from the URL
        const urlParts = user.profile_picture.split("/");
        const folderAndFile = urlParts.slice(-2).join("/"); // e.g. "profile-pictures/12345-name"
        const publicId = folderAndFile.split(".")[0]; // remove extension if present
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
        // Continue even if deletion fails
      }
    }

    // The file is already uploaded to Cloudinary via multer-storage-cloudinary
    user.profile_picture = req.file.path;
    await user.save();

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profile_picture: user.profile_picture,
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Remove Profile Picture
export const removeProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.profile_picture) {
      try {
        const urlParts = user.profile_picture.split("/");
        const folderAndFile = urlParts.slice(-2).join("/");
        const publicId = folderAndFile.split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting profile picture:", err);
      }
    }

    user.profile_picture = null;
    await user.save();

    res.json({
      success: true,
      message: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("Remove profile picture error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Customer Registration
export const customerRegister = async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      country,
      customer_type,
    } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = new User({
      email: email.toLowerCase(),
      password_hash,
      user_type: "customer",
      status: "active",
      first_name,
      last_name,
      phone,
      country,
    });
    await user.save();

    const customer = new Customer({
      user_id: user._id,
      customer_type: customer_type || "individual",
      onboarding_status: "completed",
    });
    await customer.save();

    const token = jwt.sign(
      { id: user._id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Customer account created successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        profile_picture: user.profile_picture,
        customer_id: customer._id,
      },
    });
  } catch (error) {
    console.error("Customer register error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Customer Login
export const customerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      user_type: "customer",
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "Account is not active" });
    }

    user.last_login = new Date();
    await user.save();

    const customer = await Customer.findOne({ user_id: user._id });

    const token = jwt.sign(
      { id: user._id, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        profile_picture: user.profile_picture,
        customer_id: customer?._id,
      },
    });
  } catch (error) {
    console.error("Customer login error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify admin access — called by frontend to check if session is still valid
export const verifyAdminAccess = async (req, res) => {
  try {
    const user = req.user;

    // Native admins always have access
    if (user.user_type === "admin") {
      return res.json({ valid: true, user_type: "admin" });
    }

    // For non-admin users, check if they have an admin-level role assigned
    const adminRoles = await Role.find({
      $or: [
        { name: "super_admin" },
        { name: "admin" },
        { hierarchy_level: { $lte: 2 } },
      ],
    });
    const adminRoleIds = adminRoles.map((r) => r._id);

    const userAdminRole = await UserRole.findOne({
      user_id: user._id,
      role_id: { $in: adminRoleIds },
    });

    if (!userAdminRole) {
      return res.status(403).json({ valid: false, error: "Admin access revoked" });
    }

    return res.json({ valid: true, user_type: user.user_type, has_admin_role: true });
  } catch (error) {
    console.error("Verify admin access error:", error);
    res.status(500).json({ valid: false, error: error.message });
  }
};

// Verify employee access — called by frontend to check if session is still valid
export const verifyEmployeeAccess = async (req, res) => {
  try {
    const user = req.user;

    // Check user is active
    if (user.status !== "active") {
      return res.status(403).json({ valid: false, error: "Account is not active" });
    }

    // Check employee record exists and is active
    const employee = await Employee.findOne({ user_id: user._id });
    if (!employee || !employee.is_active) {
      return res.status(403).json({ valid: false, error: "Employee access revoked" });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error("Verify employee access error:", error);
    res.status(500).json({ valid: false, error: error.message });
  }
};
