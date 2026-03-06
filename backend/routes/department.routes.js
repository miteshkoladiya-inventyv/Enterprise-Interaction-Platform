import express from "express";
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getOrgTree,
  assignDepartmentHead,
} from "../controllers/department/department.controller.js";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", getAllDepartments);
router.get("/org-tree", getOrgTree);
router.get("/:id", getDepartmentById);
router.post("/", requirePermission("departments:create"), createDepartment);
router.put("/:id", requirePermission("departments:update"), updateDepartment);
router.put("/:id/head", requirePermission("departments:update"), assignDepartmentHead);
router.delete("/:id", requirePermission("departments:delete"), deleteDepartment);

export default router;
