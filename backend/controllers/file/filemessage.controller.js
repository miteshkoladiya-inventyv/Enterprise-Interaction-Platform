import crypto from "crypto";
import bcrypt from "bcryptjs";
import OpenAI from "openai";
import File from "../../models/File.js";
import User from "../../models/User.js";
import { cloudinary } from "../../config/cloudinary.js";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fetch from "node-fetch";

// Groq AI client — file content Q&A (same config as ai.controller.js)
let groq = null;
const getGroqClient = () => {
  if (groq) return groq;
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return groq;
};
const GROQ_MODEL = "llama-3.3-70b-versatile";

const parseFirstJsonObject = (text) => {
  if (!text || typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// Helper: extract text content from a file
// Supports: PDF, DOCX, TXT, plain-text types
// For images: returns a placeholder (no OCR dependency needed)
// ─────────────────────────────────────────────
const extractTextContent = async (fileUrl, mimeType, originalName) => {
  try {
    // Fetch the raw file buffer from Cloudinary URL
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // PDF
    if (mimeType === "application/pdf") {
      const data = await pdfParse(buffer);
      return data.text?.trim() || "";
    }

    // DOCX
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword" ||
      originalName?.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.trim() || "";
    }

    // Plain text / CSV / JSON / XML / Markdown
    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      originalName?.match(/\.(txt|csv|json|xml|md|log)$/i)
    ) {
      return buffer.toString("utf-8").trim();
    }

    // Images — return a note; swap in tesseract.js if you want OCR
    if (mimeType.startsWith("image/")) {
      return `[Image file: ${originalName}. OCR not enabled.]`;
    }

    // Unsupported type
    return `[Content extraction not supported for type: ${mimeType}]`;
  } catch (err) {
    console.error("Content extraction error:", err.message);
    return `[Extraction failed: ${err.message}]`;
  }
};

const isAdminUser = (user) => user?.user_type === "admin";

const canEditFile = (fileRecord, userId) => {
  if (fileRecord.uploaded_by.toString() === userId.toString()) return true;
  const role = fileRecord.getPermissionRole(userId);
  return role === "editor";
};

const canManageSharing = (fileRecord, user) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return fileRecord.uploaded_by.toString() === user._id.toString();
};

const sanitizeActivity = (entry) => ({
  user_id: entry.user_id,
  user_name: entry.user_id?.first_name 
    ? `${entry.user_id.first_name} ${entry.user_id.last_name || ""}`.trim() 
    : null,
  user_email: entry.user_id?.email || null,
  action: entry.action,
  timestamp: entry.timestamp,
  ip_address: entry.ip_address,
});

const hasFileAccessSnapshot = (fileRecord, userId) => {
  if (!fileRecord) return false;
  if (fileRecord.permissions?.is_public) return true;
  if (fileRecord.uploaded_by?.toString() === userId.toString()) return true;

  const directUser = (fileRecord.permissions?.user_ids || []).some(
    (id) => id?.toString() === userId.toString()
  );
  if (directUser) return true;

  const sharedUser = (fileRecord.permissions?.shared_with || []).some(
    (entry) => entry.user_id?.toString() === userId.toString()
  );
  if (sharedUser) return true;

  return false;
};

// ─────────────────────────────────────────────
// Upload a file
// POST /api/files/upload
// ─────────────────────────────────────────────
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.userId;
    const uploader = await User.findById(userId).select("first_name last_name email");
    if (!uploader) return res.status(404).json({ error: "User not found" });

    const { description, tags, category, is_public } = req.body;

    const fileRecord = await File.create({
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      storage_path: req.file.filename || req.file.path,
      storage_url: req.file.path, // Cloudinary URL
      uploaded_by: userId,
      uploader_info: {
        name: `${uploader.first_name} ${uploader.last_name || ""}`.trim(),
        email: uploader.email,
      },
      permissions: {
        is_public: is_public === "true" || is_public === true,
        user_ids: [userId],
        shared_with: [],
      },
      metadata: {
        description: description || "",
        tags: tags ? (typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags) : [],
        category: category || null,
      },
    });

    // Try to extract content in the background (only if user didn't provide description)
    try {
      if (!description || !description.trim()) {
        const content = await extractTextContent(fileRecord.storage_url, fileRecord.file_type, fileRecord.file_name);
        if (content && !content.startsWith("[")) {
          fileRecord.metadata.description = content;
          await fileRecord.save();
        }
      }
    } catch {}

    fileRecord.logActivity(userId, "edit", req.ip);
    await fileRecord.save();

    return res.status(201).json(fileRecord);
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ error: "Failed to upload file" });
  }
};

// ─────────────────────────────────────────────
// List accessible files
// GET /api/files
// ─────────────────────────────────────────────
export const listFiles = async (req, res) => {
  try {
    const userId = req.userId;
    const files = await File.findAccessibleFiles(userId);
    return res.status(200).json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    return res.status(500).json({ error: "Failed to list files" });
  }
};

// ─────────────────────────────────────────────
// List files in trash (owner only)
// GET /api/files/trash
// ─────────────────────────────────────────────
export const listTrashFiles = async (req, res) => {
  try {
    const userId = req.userId;
    const files = await File.findTrashFiles(userId);
    return res.status(200).json(files);
  } catch (error) {
    console.error("Error listing trash files:", error);
    return res.status(500).json({ error: "Failed to list trash files" });
  }
};

// ─────────────────────────────────────────────
// Get single file details
// GET /api/files/:fileId
// ─────────────────────────────────────────────
export const getFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json(fileRecord);
  } catch (error) {
    console.error("Error getting file:", error);
    return res.status(500).json({ error: "Failed to get file" });
  }
};


// ─────────────────────────────────────────────
// Controller: Extract / view file content
// GET /api/files/:fileId/content
// ─────────────────────────────────────────────
export const extractFileContent = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: "File record not found" });
    }

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "You do not have access to this file" });
    }

    // ── Log the view activity ─────────────────────────────────────────
    fileRecord.logActivity(userId, "view", req.ip || null);
    await fileRecord.save();

    // ── Return content ────────────────────────────────────────────────
    const content = fileRecord.metadata?.description || "";
    const hasContent =
      content.length > 0 &&
      !content.startsWith("[Content extraction not supported") &&
      !content.startsWith("[Image file:") &&
      !content.startsWith("[Extraction failed:");

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      file_type: fileRecord.file_type,
      file_size: fileRecord.file_size,
      storage_url: fileRecord.storage_url,
      uploaded_by: fileRecord.uploader_info,
      created_at: fileRecord.created_at,
      has_extracted_content: hasContent,
      content: content,
      metadata: {
        tags: fileRecord.metadata?.tags || [],
        category: fileRecord.metadata?.category || null,
      },
      permissions: {
        is_public: fileRecord.permissions?.is_public,
      },
    });
  } catch (error) {
    console.error("Error fetching file content:", error);
    return res.status(500).json({ error: "Failed to fetch file content", message: error.message });
  }
};

// ─────────────────────────────────────────────
// Update file metadata
// PATCH /api/files/:fileId
// ─────────────────────────────────────────────
export const updateFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    const canEdit = canEditFile(fileRecord, userId) || isAdminUser(user);
    if (!canEdit) {
      return res.status(403).json({ error: "Only owner/editor can update this file" });
    }

    const { file_name, description, tags, category, is_public } = req.body;

    // Allow renaming the file (only owner/admin can rename)
    const isOwner = fileRecord.uploaded_by.toString() === userId.toString() || isAdminUser(user);
    if (file_name !== undefined && isOwner) {
      const newName = file_name.trim();
      if (newName.length > 0 && newName.length <= 255) {
        fileRecord.file_name = newName;
      }
    }

    if (description !== undefined) fileRecord.metadata.description = description;
    if (tags !== undefined) {
      fileRecord.metadata.tags = typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags;
    }
    if (category !== undefined) fileRecord.metadata.category = category;

    if (is_public !== undefined && isOwner) {
      fileRecord.permissions.is_public = is_public === "true" || is_public === true;
    }

    fileRecord.logActivity(userId, "edit", req.ip);
    await fileRecord.save();

    return res.status(200).json(fileRecord);
  } catch (error) {
    console.error("Error updating file:", error);
    return res.status(500).json({ error: "Failed to update file" });
  }
};

// ─────────────────────────────────────────────
// Delete a file (soft delete - move to trash)
// DELETE /api/files/:fileId
// ─────────────────────────────────────────────
export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    const canDelete = fileRecord.uploaded_by.toString() === userId.toString() || isAdminUser(user);
    if (!canDelete) {
      return res.status(403).json({ error: "Only the uploader/admin can delete this file" });
    }

    // Soft delete - move to trash
    fileRecord.is_deleted = true;
    fileRecord.deleted_at = new Date();
    fileRecord.deleted_by = userId;
    fileRecord.logActivity(userId, "delete", req.ip);
    await fileRecord.save();

    return res.status(200).json({ message: "File moved to trash" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
};

// ─────────────────────────────────────────────
// Restore file from trash
// POST /api/files/:fileId/restore
// ─────────────────────────────────────────────
export const restoreFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    const canRestore = fileRecord.uploaded_by.toString() === userId.toString() || isAdminUser(user);
    if (!canRestore) {
      return res.status(403).json({ error: "Only the uploader/admin can restore this file" });
    }

    if (!fileRecord.is_deleted) {
      return res.status(400).json({ error: "File is not in trash" });
    }

    fileRecord.is_deleted = false;
    fileRecord.deleted_at = null;
    fileRecord.deleted_by = null;
    await fileRecord.save();

    return res.status(200).json({ message: "File restored", file: fileRecord });
  } catch (error) {
    console.error("Error restoring file:", error);
    return res.status(500).json({ error: "Failed to restore file" });
  }
};

// ─────────────────────────────────────────────
// Permanently delete file from trash
// DELETE /api/files/:fileId/permanent
// ─────────────────────────────────────────────
export const permanentDeleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    const canDelete = fileRecord.uploaded_by.toString() === userId.toString() || isAdminUser(user);
    if (!canDelete) {
      return res.status(403).json({ error: "Only the uploader/admin can permanently delete this file" });
    }

    // Delete from Cloudinary
    try {
      const publicId = fileRecord.storage_path;
      const isImage = fileRecord.file_type?.startsWith("image/");
      await cloudinary.uploader.destroy(publicId, { resource_type: isImage ? "image" : "raw" });
      
      // Delete all versions from Cloudinary
      for (const version of fileRecord.versions || []) {
        try {
          await cloudinary.uploader.destroy(version.storage_path, { 
            resource_type: fileRecord.file_type?.startsWith("image/") ? "image" : "raw" 
          });
        } catch (err) {
          console.error("Version delete error:", err.message);
        }
      }
    } catch (err) {
      console.error("Cloudinary delete error:", err.message);
    }

    await File.findByIdAndDelete(fileId);
    return res.status(200).json({ message: "File permanently deleted" });
  } catch (error) {
    console.error("Error permanently deleting file:", error);
    return res.status(500).json({ error: "Failed to permanently delete file" });
  }
};

// ─────────────────────────────────────────────
// Share file with a user
// POST /api/files/:fileId/share
// ─────────────────────────────────────────────
export const shareFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId: targetUserId, access_role } = req.body;
    const userId = req.userId;

    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    if (!canManageSharing(fileRecord, user)) {
      return res.status(403).json({ error: "Only owner/admin can share this file" });
    }
    const shareRole = access_role === "editor" ? "editor" : "viewer";
    fileRecord.grantAccess(targetUserId, shareRole, userId);
    fileRecord.logActivity(userId, "share", req.ip);
    await fileRecord.save();

    return res.status(200).json({ message: "Access granted", role: shareRole });
  } catch (error) {
    console.error("Error sharing file:", error);
    return res.status(500).json({ error: "Failed to share file" });
  }
};

// ─────────────────────────────────────────────
// Revoke file access
// DELETE /api/files/:fileId/share/:targetUserId
// ─────────────────────────────────────────────
export const revokeFileAccess = async (req, res) => {
  try {
    const { fileId, targetUserId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId).select("user_type");
    if (!canManageSharing(fileRecord, user)) {
      return res.status(403).json({ error: "Only owner/admin can revoke access" });
    }

    fileRecord.revokeAccess(targetUserId);
    fileRecord.logActivity(userId, "share", req.ip);
    await fileRecord.save();

    return res.status(200).json({ message: "Access revoked" });
  } catch (error) {
    console.error("Error revoking access:", error);
    return res.status(500).json({ error: "Failed to revoke access" });
  }
};

// ─────────────────────────────────────────────
// Download / redirect to file
// GET /api/files/:fileId/download
// ─────────────────────────────────────────────
export const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    fileRecord.logActivity(userId, "download", req.ip);
    await fileRecord.save();

    return res.status(200).json({ url: fileRecord.storage_url, file_name: fileRecord.file_name });
  } catch (error) {
    console.error("Error downloading file:", error);
    return res.status(500).json({ error: "Failed to download file" });
  }
};

// ─────────────────────────────────────────────
// Upload new version for a file
// POST /api/files/:fileId/version
// ─────────────────────────────────────────────
export const uploadFileVersion = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = await User.findById(userId).select("user_type");
    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const canVersion = canEditFile(fileRecord, userId) || isAdminUser(user);
    if (!canVersion) {
      return res.status(403).json({ error: "Only owner/editor can upload a new version" });
    }

    fileRecord.addVersion(req.file.filename || req.file.path, userId, req.file.size, req.file.path);
    fileRecord.storage_url = req.file.path;
    fileRecord.file_type = req.file.mimetype;
    fileRecord.file_name = req.file.originalname;
    fileRecord.logActivity(userId, "edit", req.ip);
    await fileRecord.save();

    return res.status(200).json({
      message: "New version uploaded",
      version_number: fileRecord.versions.length,
      file: fileRecord,
    });
  } catch (error) {
    console.error("Error uploading file version:", error);
    return res.status(500).json({ error: "Failed to upload file version" });
  }
};

// ─────────────────────────────────────────────
// Get file versions
// GET /api/files/:fileId/versions
// ─────────────────────────────────────────────
export const getFileVersions = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId).populate("versions.uploaded_by", "first_name last_name email");
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      current_version: fileRecord.versions.length,
      versions: fileRecord.versions || [],
    });
  } catch (error) {
    console.error("Error fetching file versions:", error);
    return res.status(500).json({ error: "Failed to fetch file versions" });
  }
};

// ─────────────────────────────────────────────
// Create secure share link
// POST /api/files/:fileId/share-link
// ─────────────────────────────────────────────
export const createSecureShareLink = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;
    const { expires_in_hours = 24, one_time = false, password } = req.body || {};

    const user = await User.findById(userId).select("user_type");
    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!canManageSharing(fileRecord, user)) {
      return res.status(403).json({ error: "Only owner/admin can create secure links" });
    }

    const ttlHours = Math.min(Math.max(Number(expires_in_hours) || 24, 1), 168);
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    let passwordHash = null;
    if (typeof password === "string" && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    fileRecord.secure_links = fileRecord.secure_links || [];
    fileRecord.secure_links.push({
      token,
      expires_at: expiresAt,
      one_time: one_time === true,
      created_by: userId,
      password_hash: passwordHash,
    });

    fileRecord.logActivity(userId, "share", req.ip);
    await fileRecord.save();

    return res.status(201).json({
      message: "Secure link created",
      token,
      url: `/api/files/shared/${token}`,
      expires_at: expiresAt,
      one_time: one_time === true,
      requires_password: Boolean(passwordHash),
    });
  } catch (error) {
    console.error("Error creating secure share link:", error);
    return res.status(500).json({ error: "Failed to create secure share link" });
  }
};

// ─────────────────────────────────────────────
// Access secure share link
// POST /api/files/shared/:token/access
// ─────────────────────────────────────────────
export const accessSecureShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    const fileRecord = await File.findOne({ "secure_links.token": token });
    if (!fileRecord) return res.status(404).json({ error: "Invalid or expired link" });

    const secureLink = (fileRecord.secure_links || []).find((entry) => entry.token === token);
    if (!secureLink) return res.status(404).json({ error: "Invalid or expired link" });

    if (secureLink.expires_at && new Date(secureLink.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: "Link has expired" });
    }

    if (secureLink.one_time && secureLink.used_at) {
      return res.status(410).json({ error: "This one-time link has already been used" });
    }

    if (secureLink.password_hash) {
      const ok = await bcrypt.compare(password || "", secureLink.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid link password" });
      }
    }

    if (secureLink.one_time) {
      secureLink.used_at = new Date();
      await fileRecord.save();
    }

    return res.status(200).json({
      file_name: fileRecord.file_name,
      file_type: fileRecord.file_type,
      url: fileRecord.storage_url,
      expires_at: secureLink.expires_at,
      one_time: secureLink.one_time,
    });
  } catch (error) {
    console.error("Error accessing secure share link:", error);
    return res.status(500).json({ error: "Failed to access shared link" });
  }
};

// ─────────────────────────────────────────────
// List file activity logs
// GET /api/files/:fileId/activity
// ─────────────────────────────────────────────
export const getFileActivityLog = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId).select("user_type");
    const fileRecord = await File.findById(fileId)
      .populate("activity_log.user_id", "first_name last_name email")
      .lean();

    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const isOwner = fileRecord.uploaded_by.toString() === userId.toString();
    const canRead = isOwner || isAdminUser(user) || hasFileAccessSnapshot(fileRecord, userId);
    if (!canRead) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      total_events: (fileRecord.activity_log || []).length,
      activity_log: (fileRecord.activity_log || []).map(sanitizeActivity),
    });
  } catch (error) {
    console.error("Error fetching file activity log:", error);
    return res.status(500).json({ error: "Failed to fetch file activity log" });
  }
};

// ─────────────────────────────────────────────
// Organization-level file activity logs
// GET /api/files/activity
// ─────────────────────────────────────────────
export const listFileActivity = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("department user_type");
    const { action, file_id, limit = 100, user_id, date_from, date_to } = req.query;

    const files = await File.find(file_id ? { _id: file_id } : {})
      .select("_id file_name uploaded_by permissions activity_log")
      .populate("activity_log.user_id", "first_name last_name email")
      .lean();

    const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const isAdmin = isAdminUser(user);

    const events = [];
    for (const fileRecord of files) {
      const canRead =
        isAdmin ||
        fileRecord.uploaded_by.toString() === userId.toString() ||
        hasFileAccessSnapshot(fileRecord, userId);

      if (!canRead) continue;

      for (const entry of fileRecord.activity_log || []) {
        if (action && entry.action !== action) continue;
        const entryUserId = (entry.user_id?._id || entry.user_id)?.toString();
        if (user_id && entryUserId !== user_id) continue;
        if (date_from && new Date(entry.timestamp) < new Date(date_from)) continue;
        if (date_to && new Date(entry.timestamp) > new Date(new Date(date_to).setHours(23, 59, 59, 999))) continue;
        events.push({
          file_id: fileRecord._id,
          file_name: fileRecord.file_name,
          ...sanitizeActivity(entry),
        });
      }
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({
      total_events: events.length,
      events: events.slice(0, max),
    });
  } catch (error) {
    console.error("Error listing file activity:", error);
    return res.status(500).json({ error: "Failed to list file activity" });
  }
};

// ─────────────────────────────────────────────
// AI File Content Q&A (Groq)
// POST /api/files/:fileId/ask
// ─────────────────────────────────────────────
export const askFileQuestion = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { question } = req.body;
    const userId = req.userId;

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required" });
    }

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const content = await extractTextContent(
      fileRecord.storage_url,
      fileRecord.file_type,
      fileRecord.file_name
    );

    if (!content || content.startsWith("[")) {
      return res.status(422).json({
        error: "Cannot extract text from this file type for AI analysis.",
        file_type: fileRecord.file_type,
      });
    }

    // Truncate to ~12000 chars to stay within token limits
    const truncatedContent =
      content.length > 12000
        ? content.slice(0, 12000) + "\n\n[Content truncated due to length]"
        : content;

    const groqClient = getGroqClient();

    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful document assistant. Answer questions about the provided document content clearly and concisely. If the answer is not in the document, say so honestly.",
        },
        {
          role: "user",
          content: `Document: ${fileRecord.file_name}\n\nContent:\n${truncatedContent}\n\nQuestion: ${question.trim()}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    fileRecord.logActivity(userId, "view", req.ip);
    await fileRecord.save();

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      question: question.trim(),
      answer,
    });
  } catch (error) {
    console.error("Error in file Q&A:", error);
    return res.status(500).json({ error: "AI Q&A failed", message: error.message });
  }
};

// ─────────────────────────────────────────────
// AI one-click summary + key points
// POST /api/files/:fileId/summary
// ─────────────────────────────────────────────
export const summarizeFileContent = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId).select("department");
    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const content = await extractTextContent(
      fileRecord.storage_url,
      fileRecord.file_type,
      fileRecord.file_name
    );

    if (!content || content.startsWith("[")) {
      return res.status(422).json({
        error: "Cannot extract text from this file type for AI summary.",
        file_type: fileRecord.file_type,
      });
    }

    const truncatedContent =
      content.length > 12000
        ? content.slice(0, 12000) + "\n\n[Content truncated due to length]"
        : content;

    const groqClient = getGroqClient();
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Summarize documents. Return strict JSON only with keys: summary (string), key_points (array of 3-7 short strings).",
        },
        {
          role: "user",
          content: `Document: ${fileRecord.file_name}\n\nContent:\n${truncatedContent}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = parseFirstJsonObject(raw) || {};

    let summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    let keyPoints = Array.isArray(parsed.key_points)
      ? parsed.key_points.map((v) => String(v).trim()).filter(Boolean)
      : [];

    if (!summary) {
      summary = raw.replace(/[\{\}\[\]"]/g, " ").replace(/\s+/g, " ").trim();
    }

    if (keyPoints.length === 0) {
      keyPoints = summary
        .split(/[.!?]\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    fileRecord.logActivity(userId, "summary", req.ip);
    await fileRecord.save();

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      summary,
      key_points: keyPoints,
    });
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return res.status(500).json({ error: "AI summary failed", message: error.message });
  }
};

// ─────────────────────────────────────────────
// Toggle user favorite
// POST /api/files/:fileId/favorite
// ─────────────────────────────────────────────
export const toggleFileFavorite = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;
    const requested = req.body?.favorite;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const current = fileRecord.isFavoritedBy(userId);
    const next = typeof requested === "boolean" ? requested : !current;

    fileRecord.setFavoriteForUser(userId, next);
    fileRecord.logActivity(userId, "favorite", req.ip);
    await fileRecord.save();

    return res.status(200).json({
      file_id: fileRecord._id,
      favorite: next,
    });
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return res.status(500).json({ error: "Failed to update favorite" });
  }
};

// ─────────────────────────────────────────────
// Restore file to a previous version
// POST /api/files/:fileId/versions/:versionNumber/restore
// ─────────────────────────────────────────────
export const restoreFileVersion = async (req, res) => {
  try {
    const { fileId, versionNumber } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId).select("user_type");
    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const canRestore = canEditFile(fileRecord, userId) || isAdminUser(user);
    if (!canRestore) {
      return res.status(403).json({ error: "Only owner/editor can restore versions" });
    }

    const vNum = Number(versionNumber);
    const targetVersion = (fileRecord.versions || []).find((v) => v.version_number === vNum);
    if (!targetVersion) {
      return res.status(404).json({ error: `Version ${vNum} not found` });
    }

    // Determine the URL for this version (use stored URL or derive from cloudinary)
    let restoreUrl = targetVersion.storage_url;
    if (!restoreUrl) {
      const isImage = fileRecord.file_type?.startsWith("image/");
      restoreUrl = cloudinary.url(targetVersion.storage_path, {
        resource_type: isImage ? "image" : "raw",
        secure: true,
      });
    }

    fileRecord.storage_path = targetVersion.storage_path;
    fileRecord.storage_url = restoreUrl;
    fileRecord.file_size = targetVersion.file_size;
    fileRecord.logActivity(userId, "edit", req.ip);
    await fileRecord.save();

    return res.status(200).json({
      message: `Restored to version ${vNum}`,
      file: fileRecord,
    });
  } catch (error) {
    console.error("Error restoring file version:", error);
    return res.status(500).json({ error: "Failed to restore file version" });
  }
};

// ─────────────────────────────────────────────
// Add comment to file
// POST /api/files/:fileId/comments
// ─────────────────────────────────────────────
export const addFileComment = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({ error: "Comment too long (max 2000 characters)" });
    }

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const comment = {
      user_id: userId,
      content: content.trim(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    fileRecord.comments = fileRecord.comments || [];
    fileRecord.comments.push(comment);
    await fileRecord.save();

    // Populate user info for response
    await fileRecord.populate("comments.user_id", "first_name last_name email");
    const addedComment = fileRecord.comments[fileRecord.comments.length - 1];

    return res.status(201).json({
      message: "Comment added",
      comment: addedComment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return res.status(500).json({ error: "Failed to add comment" });
  }
};

// ─────────────────────────────────────────────
// Get file comments
// GET /api/files/:fileId/comments
// ─────────────────────────────────────────────
export const getFileComments = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId)
      .populate("comments.user_id", "first_name last_name email profile_picture");

    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json({
      file_id: fileRecord._id,
      file_name: fileRecord.file_name,
      total_comments: (fileRecord.comments || []).length,
      comments: (fileRecord.comments || []).map((c) => ({
        _id: c._id,
        user_id: c.user_id?._id,
        user_name: c.user_id?.first_name
          ? `${c.user_id.first_name} ${c.user_id.last_name || ""}`.trim()
          : "Unknown",
        user_email: c.user_id?.email || "",
        user_profile_picture: c.user_id?.profile_picture || "",
        content: c.content,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
};

// ─────────────────────────────────────────────
// Update comment
// PATCH /api/files/:fileId/comments/:commentId
// ─────────────────────────────────────────────
export const updateFileComment = async (req, res) => {
  try {
    const { fileId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({ error: "Comment too long (max 2000 characters)" });
    }

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const comment = fileRecord.comments?.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    // Only comment author can edit their own comment
    if (comment.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    comment.content = content.trim();
    comment.updated_at = new Date();
    await fileRecord.save();

    await fileRecord.populate("comments.user_id", "first_name last_name email");
    const updatedComment = fileRecord.comments.id(commentId);

    return res.status(200).json({
      message: "Comment updated",
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return res.status(500).json({ error: "Failed to update comment" });
  }
};

// ─────────────────────────────────────────────
// Delete comment
// DELETE /api/files/:fileId/comments/:commentId
// ─────────────────────────────────────────────
export const deleteFileComment = async (req, res) => {
  try {
    const { fileId, commentId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId).select("user_type");
    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    const comment = fileRecord.comments?.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    // Only comment author or file owner or admin can delete
    const isCommentAuthor = comment.user_id.toString() === userId.toString();
    const isFileOwner = fileRecord.uploaded_by.toString() === userId.toString();
    const isAdmin = isAdminUser(user);

    if (!isCommentAuthor && !isFileOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    comment.remove();
    await fileRecord.save();

    return res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
};
