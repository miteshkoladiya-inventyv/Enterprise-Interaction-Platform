import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { UserRole } from "../models/UserRole.js";

import Role from "../models/Role.js";

// Verify JWT Token
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password_hash");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.status !== "active" && user.status !== "pending") {
      return res.status(403).json({ error: "Account is not active" });
    }

    req.user = user;
    req.userId = decoded.id;

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Token is not valid" });
  }
};

// Check if user is Admin
// Check if user is Admin (native admin or has admin-level role)
export const isAdmin = async (req, res, next) => {
  try {
    if (req.user.user_type === "admin") return next();

    // Check if user has an admin-level role assigned
    const adminRoles = await Role.find({
      $or: [
        { name: "super_admin" },
        { name: "admin" },
        { hierarchy_level: { $lte: 2 } },
      ],
    });
    const adminRoleIds = adminRoles.map((r) => r._id);

    const userAdminRole = await UserRole.findOne({
      user_id: req.user._id,
      role_id: { $in: adminRoleIds },
    });

    if (userAdminRole) return next();

    return res.status(403).json({
      error: "Access denied. Admin privileges required.",
    });
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all permissions for a user from their assigned roles
export const getUserPermissions = async (userId) => {
  const userRoles = await UserRole.find({ user_id: userId }).populate(
    "role_id"
  );
  const permissions = new Set();
  for (const ur of userRoles) {
    if (ur.role_id && ur.role_id.permissions) {
      for (const perm of ur.role_id.permissions) {
        permissions.add(perm);
      }
    }
  }
  return permissions;
};

// Permission-based middleware factory
// Admin (user_type === "admin") always bypasses
export const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (req.user.user_type === "admin") return next();

    const permissions = await getUserPermissions(req.user._id);
    if (permissions.has(permission)) return next();

    return res.status(403).json({
      error: `Access denied. Required permission: ${permission}`,
    });
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Backward-compatible: Check if user is HR or Admin
export const isHR = requirePermission("employees:create");

// Backward-compatible: Check if user is team lead
export const isTeamLead = requirePermission("leave:approve");
