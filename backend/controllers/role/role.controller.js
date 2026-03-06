import Role from "../../models/Role.js";
import Permission from "../../models/Permission.js";
import { UserRole } from "../../models/UserRole.js";
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";

// GET /api/roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ hierarchy_level: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/roles/permissions
export const getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({}).sort({ category: 1, name: 1 });

    // Group by category
    const grouped = {};
    for (const perm of permissions) {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    }

    res.json({ permissions, grouped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/roles/:id
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: "Role not found" });
    res.json(role);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/roles
export const createRole = async (req, res) => {
  try {
    const { name, display_name, hierarchy_level, permissions, description } = req.body;

    if (!name || !display_name || hierarchy_level === undefined) {
      return res.status(400).json({ error: "name, display_name, and hierarchy_level are required" });
    }

    // Validate permission names exist
    if (permissions && permissions.length > 0) {
      const validPerms = await Permission.find({ name: { $in: permissions } });
      if (validPerms.length !== permissions.length) {
        return res.status(400).json({ error: "Some permission names are invalid" });
      }
    }

    const role = await Role.create({
      name: name.toLowerCase().replace(/\s+/g, "_"),
      display_name,
      hierarchy_level,
      permissions: permissions || [],
      description,
      is_system: false,
    });

    res.status(201).json(role);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "A role with this name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/roles/:id
export const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const { display_name, hierarchy_level, permissions, description } = req.body;

    // Validate permission names if provided
    if (permissions && permissions.length > 0) {
      const validPerms = await Permission.find({ name: { $in: permissions } });
      if (validPerms.length !== permissions.length) {
        return res.status(400).json({ error: "Some permission names are invalid" });
      }
    }

    if (display_name !== undefined) role.display_name = display_name;
    if (hierarchy_level !== undefined) role.hierarchy_level = hierarchy_level;
    if (permissions !== undefined) role.permissions = permissions;
    if (description !== undefined) role.description = description;

    await role.save();
    res.json(role);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/roles/:id
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: "Role not found" });

    if (role.is_system) {
      return res.status(400).json({ error: "Cannot delete a system role" });
    }

    // Remove all UserRole assignments for this role
    await UserRole.deleteMany({ role_id: role._id });
    await role.deleteOne();

    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/roles/assign
export const assignRole = async (req, res) => {
  try {
    const { user_id, role_id } = req.body;

    if (!user_id || !role_id) {
      return res.status(400).json({ error: "user_id and role_id are required" });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const role = await Role.findById(role_id);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const userRole = await UserRole.findOneAndUpdate(
      { user_id, role_id },
      { user_id, role_id, assigned_by: req.user._id, assigned_at: new Date() },
      { upsert: true, new: true }
    );

    // Reactivate employee if they were deactivated
    await Employee.findOneAndUpdate(
      { user_id, is_active: false },
      { is_active: true }
    );

    const populated = await UserRole.findById(userRole._id).populate("role_id");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/roles/assign/:id
export const removeRoleAssignment = async (req, res) => {
  try {
    const userRole = await UserRole.findByIdAndDelete(req.params.id);
    if (!userRole) return res.status(404).json({ error: "Role assignment not found" });

    // Check if the user has any remaining roles
    const remainingRoles = await UserRole.countDocuments({ user_id: userRole.user_id });
    if (remainingRoles === 0) {
      // No roles left — deactivate the employee
      await Employee.findOneAndUpdate(
        { user_id: userRole.user_id },
        { is_active: false }
      );
    }

    res.json({ message: "Role assignment removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/roles/user/:userId
export const getUserRoles = async (req, res) => {
  try {
    const userRoles = await UserRole.find({ user_id: req.params.userId }).populate("role_id");
    res.json(userRoles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
