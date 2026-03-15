import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { upload } from "../config/cloudinary.js";
import {
  uploadFile,
  listFiles,
  getFile,
  extractFileContent,
  updateFile,
  deleteFile,
  shareFile,
  revokeFileAccess,
  downloadFile,
  uploadFileVersion,
  getFileVersions,
  createSecureShareLink,
  accessSecureShareLink,
  getFileActivityLog,
  listFileActivity,
  askFileQuestion,
  summarizeFileContent,
  toggleFileFavorite,
  restoreFileVersion,
} from "../controllers/file/filemessage.controller.js";

const router = express.Router();

// Public secure-link access route (for customers/external users)
router.post("/shared/:token/access", accessSecureShareLink);

// All remaining routes require authentication
router.use(verifyToken);

router.post("/upload", upload.single("file"), uploadFile);
router.get("/", listFiles);
router.get("/activity", listFileActivity);
router.get("/:fileId", getFile);
router.get("/:fileId/content", extractFileContent);
router.get("/:fileId/download", downloadFile);
router.get("/:fileId/versions", getFileVersions);
router.get("/:fileId/activity", getFileActivityLog);
router.patch("/:fileId", updateFile);
router.delete("/:fileId", deleteFile);
router.post("/:fileId/share", shareFile);
router.post("/:fileId/share-link", createSecureShareLink);
router.post("/:fileId/ask", askFileQuestion);
router.post("/:fileId/summary", summarizeFileContent);
router.post("/:fileId/favorite", toggleFileFavorite);
router.post("/:fileId/version", upload.single("file"), uploadFileVersion);
router.post("/:fileId/versions/:versionNumber/restore", restoreFileVersion);
router.delete("/:fileId/share/:targetUserId", revokeFileAccess);

export default router;
