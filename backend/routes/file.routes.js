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
} from "../controllers/file/filemessage.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.post("/upload", upload.single("file"), uploadFile);
router.get("/", listFiles);
router.get("/:fileId", getFile);
router.get("/:fileId/content", extractFileContent);
router.get("/:fileId/download", downloadFile);
router.patch("/:fileId", updateFile);
router.delete("/:fileId", deleteFile);
router.post("/:fileId/share", shareFile);
router.delete("/:fileId/share/:targetUserId", revokeFileAccess);

export default router;
