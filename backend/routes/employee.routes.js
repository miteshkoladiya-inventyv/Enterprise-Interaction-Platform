import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  adminResetPasswordToTemp,
  adminChangePassword,
} from "../controllers/employee/employee.controller.js";
import { verifyToken, isAdmin, isHR } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create employee (Admin or HR only)
router.post("/", isHR, createEmployee);

// Get all employees
router.get("/", getAllEmployees);

// Get employee by ID
router.get("/:id", getEmployeeById);

// Update employee (Admin or HR only)
router.put("/:id", isHR, updateEmployee);

// Admin password reset: temp password + email
router.post("/:id/admin-reset-password", isHR, adminResetPasswordToTemp);

// Admin change password directly
router.put("/:id/admin-change-password", isHR, adminChangePassword);

// Delete employee (Admin only)
router.delete("/:id", isAdmin, deleteEmployee);

export default router;
