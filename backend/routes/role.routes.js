import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware.js";
import {
  getRoles,
  getPermissions,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  removeRoleAssignment,
  getUserRoles,
} from "../controllers/role/role.controller.js";

const router = Router();

router.use(verifyToken);

// Permission listing (must come before /:id to avoid route conflict)
router.get("/permissions", requirePermission("roles:read"), getPermissions);

// User role assignments
router.get("/user/:userId", getUserRoles);
router.post("/assign", requirePermission("roles:assign"), assignRole);
router.delete("/assign/:id", requirePermission("roles:assign"), removeRoleAssignment);

// Role CRUD
router.get("/", requirePermission("roles:read"), getRoles);
router.post("/", requirePermission("roles:create"), createRole);
router.get("/:id", requirePermission("roles:read"), getRoleById);
router.put("/:id", requirePermission("roles:update"), updateRole);
router.delete("/:id", requirePermission("roles:delete"), deleteRole);

export default router;
