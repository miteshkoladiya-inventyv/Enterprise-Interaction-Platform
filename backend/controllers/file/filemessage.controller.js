import File from "../../models/File.js";
import User from "../../models/User.js";
import { cloudinary } from "../../config/cloudinary.js";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fetch from "node-fetch";

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
    const uploader = await User.findById(userId).select("first_name last_name email department");
    if (!uploader) return res.status(404).json({ error: "User not found" });

    const { description, tags, category, is_public, department } = req.body;

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
      country: "india",
      permissions: {
        is_public: is_public === "true" || is_public === true,
        department: department || uploader.department || null,
        user_ids: [userId],
      },
      metadata: {
        description: description || "",
        tags: tags ? (typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags) : [],
        category: category || null,
      },
    });

    // Try to extract content in the background
    try {
      const content = await extractTextContent(fileRecord.storage_url, fileRecord.file_type, fileRecord.file_name);
      if (content && !content.startsWith("[")) {
        fileRecord.metadata.description = content;
        await fileRecord.save();
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
    const user = await User.findById(userId).select("department");
    const userDept = user?.department || null;

    const files = await File.findAccessibleFiles(userId, userDept);
    return res.status(200).json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    return res.status(500).json({ error: "Failed to list files" });
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
    const user = await User.findById(userId).select("department");

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId, user?.department)) {
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

    // ── Access check ──────────────────────────────────────────────────
    const uploader = await User.findById(userId).select("department");
    const userDepartment = uploader?.department || null;

    if (!fileRecord.hasAccess(userId, userDepartment)) {
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
      content: content,                          // ← the extracted text
      metadata: {
        tags: fileRecord.metadata?.tags || [],
        category: fileRecord.metadata?.category || null,
      },
      permissions: {
        is_public: fileRecord.permissions?.is_public,
        department: fileRecord.permissions?.department,
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

    // Only uploader can update
    if (fileRecord.uploaded_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the uploader can update this file" });
    }

    const { description, tags, category, is_public, department } = req.body;

    if (description !== undefined) fileRecord.metadata.description = description;
    if (tags !== undefined) {
      fileRecord.metadata.tags = typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags;
    }
    if (category !== undefined) fileRecord.metadata.category = category;
    if (is_public !== undefined) fileRecord.permissions.is_public = is_public === "true" || is_public === true;
    if (department !== undefined) fileRecord.permissions.department = department;

    fileRecord.logActivity(userId, "edit", req.ip);
    await fileRecord.save();

    return res.status(200).json(fileRecord);
  } catch (error) {
    console.error("Error updating file:", error);
    return res.status(500).json({ error: "Failed to update file" });
  }
};

// ─────────────────────────────────────────────
// Delete a file
// DELETE /api/files/:fileId
// ─────────────────────────────────────────────
export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (fileRecord.uploaded_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the uploader can delete this file" });
    }

    // Delete from Cloudinary
    try {
      const publicId = fileRecord.storage_path;
      const isImage = fileRecord.file_type?.startsWith("image/");
      await cloudinary.uploader.destroy(publicId, { resource_type: isImage ? "image" : "raw" });
    } catch (err) {
      console.error("Cloudinary delete error:", err.message);
    }

    await File.findByIdAndDelete(fileId);
    return res.status(200).json({ message: "File deleted" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
};

// ─────────────────────────────────────────────
// Share file with a user
// POST /api/files/:fileId/share
// ─────────────────────────────────────────────
export const shareFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId: targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (fileRecord.uploaded_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the uploader can share this file" });
    }

    fileRecord.grantAccess(targetUserId);
    fileRecord.logActivity(userId, "share", req.ip);
    await fileRecord.save();

    return res.status(200).json({ message: "Access granted" });
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

    if (fileRecord.uploaded_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the uploader can revoke access" });
    }

    fileRecord.revokeAccess(targetUserId);
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
    const user = await User.findById(userId).select("department");

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    if (!fileRecord.hasAccess(userId, user?.department)) {
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