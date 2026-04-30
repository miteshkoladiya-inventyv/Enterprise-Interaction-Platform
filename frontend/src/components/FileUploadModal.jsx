import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  File,
  Image,
  FileText,
  Loader2,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";

const FileUploadModal = ({ show, onClose, selectedChat, onFileSent }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef(null);

  const token = localStorage.getItem("token");

  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  // File type validation
  const allowedTypes = {
    image: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
    document: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    other: ["application/zip", "application/x-rar-compressed"],
  };

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      toast.error("File size should not exceed 10MB");
      return;
    }

    // Validate file type
    const allAllowedTypes = [
      ...allowedTypes.image,
      ...allowedTypes.document,
      ...allowedTypes.other,
    ];

    if (!allAllowedTypes.includes(file.type)) {
      toast.error("File type not supported");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (allowedTypes.image.includes(file.type)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (caption.trim()) {
      formData.append("caption", caption.trim());
    }

    // Log for debugging
    console.log("Uploading file:", {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
    });

    setUploading(true);

    try {
      // Determine endpoint based on chat type
      const isGroupChat = selectedChat?.channel_type === "group";
      const endpoint = isGroupChat
        ? `${BACKEND_URL}/chat/channels/${selectedChat._id}/messages/upload`
        : `${BACKEND_URL}/direct_chat/channels/${selectedChat._id}/messages/upload`;

      const response = await axios.post(
        endpoint,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log("Upload progress:", percentCompleted + "%");
          },
        }
      );

      console.log("Upload response:", response.data);
      toast.success("File sent successfully");
      onFileSent(response.data.data);
      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to upload file. Please try again.";

      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const getFileIcon = () => {
    if (!selectedFile)
      return <File className="w-12 h-12 text-muted-foreground" />;

    if (allowedTypes.image.includes(selectedFile.type)) {
      return <Image className="w-12 h-12 text-blue-500" />;
    }
    if (allowedTypes.document.includes(selectedFile.type)) {
      return <FileText className="w-12 h-12 text-orange-500" />;
    }
    return <File className="w-12 h-12 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Send File</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={uploading}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Click to upload a file
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Images, Documents, PDF (Max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Preview */}
              <div className="border border-border rounded-lg p-4 bg-muted/30">
                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-48 object-contain rounded"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {getFileIcon()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Caption Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Caption (Optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  disabled={uploading}
                />
              </div>

              {/* Change File Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Choose Different File
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedFile && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Send File
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadModal;
