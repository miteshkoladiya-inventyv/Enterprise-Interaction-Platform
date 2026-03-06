import express from "express";
import {
  adminSignup,
  adminLogin,
  employeeLogin,
  customerRegister,
  customerLogin,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  removeProfilePicture,
  verifyAdminAccess,
  verifyEmployeeAccess,
} from "../controllers/auth/auth.controller.js";
import { verifyToken, isAdmin, isHR } from "../middlewares/auth.middleware.js";
import { uploadProfilePic } from "../config/cloudinary.js";

const router = express.Router();

// Admin routes
router.post("/admin/signup", adminSignup);
router.post("/admin/login", adminLogin);

// Employee routes
router.post("/employee/login", employeeLogin);

// Customer routes
router.post("/customer/register", customerRegister);
router.post("/customer/login", customerLogin);

// Session verification
router.get("/admin/verify", verifyToken, verifyAdminAccess);
router.get("/employee/verify", verifyToken, verifyEmployeeAccess);

// Protected routes
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.put(
  "/profile/picture",
  verifyToken,
  uploadProfilePic.single("profile_picture"),
  uploadProfilePicture
);
router.delete("/profile/picture", verifyToken, removeProfilePicture);
router.post("/change-password", verifyToken, changePassword);
router.post("/request-reset", requestPasswordReset);
router.post("/reset-password/:token", resetPassword);

export default router;
