import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Download,
  Search,
  Grid3X3,
  List,
  X,
  Share2,
  MoreVertical,
  Eye,
  Tag,
  FolderOpen,
  Loader2,
  Globe,
  Lock,
  Users,
  Plus,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const axiosConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getFileIcon(mimeType, className = "size-5") {
  if (!mimeType) return <FileIcon className={className} />;
  if (mimeType.startsWith("image/")) return <Image className={`${className} text-emerald-400`} />;
  if (mimeType === "application/pdf") return <FileText className={`${className} text-red-400`} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className={`${className} text-green-400`} />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className={`${className} text-blue-400`} />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive"))
    return <Archive className={`${className} text-amber-400`} />;
  if (mimeType.startsWith("text/")) return <FileText className={`${className} text-zinc-400`} />;
  return <FileIcon className={`${className} text-zinc-500`} />;
}

// ─── Upload Modal ────────────────────────────────────────────
function UploadModal({ open, onClose, onUploaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setDescription("");
    setTags("");
    setCategory("");
    setIsPublic(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description) formData.append("description", description);
      if (tags) formData.append("tags", tags);
      if (category) formData.append("category", category);
      formData.append("is_public", isPublic);

      await axios.post(`${BACKEND_URL}/files/upload`, formData, {
        ...axiosConfig(),
        headers: { ...axiosConfig().headers, "Content-Type": "multipart/form-data" },
      });

      toast.success("File uploaded successfully");
      reset();
      onClose();
      onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Upload File</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-500"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
          />
          {file ? (
            <div className="flex items-center gap-3 justify-center">
              {getFileIcon(file.type, "size-8")}
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-200 truncate max-w-[240px]">{file.name}</p>
                <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-2 p-1 rounded hover:bg-zinc-800"
              >
                <X className="size-4 text-zinc-400" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="size-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Drop a file here or click to browse</p>
              <p className="text-xs text-zinc-600 mt-1">Max 10 MB — Images, PDFs, Docs, Spreadsheets, Archives</p>
            </>
          )}
        </div>

        {/* Metadata fields */}
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Tags (comma-separated)</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="report, finance, Q1"
                className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Reports"
                className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-indigo-500"
            />
            Make file public (accessible to everyone)
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-zinc-400 hover:text-zinc-200">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {uploading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Upload className="size-4 mr-2" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Modal ───────────────────────────────────────────
function PreviewModal({ open, onClose, file }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/files/${file._id}/content`, axiosConfig())
      .then((res) => setContent(res.data))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [open, file]);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            {getFileIcon(file.file_type)} {file.file_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 text-xs text-zinc-500 mt-1">
          <span>{formatSize(file.file_size)}</span>
          <span>{file.file_type}</span>
          <span>Uploaded {timeAgo(file.created_at)}</span>
        </div>

        {file.metadata?.tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {file.metadata.tags.map((t, i) => (
              <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-400 text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto mt-4 rounded-lg bg-zinc-950 border border-zinc-800 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-zinc-500" />
            </div>
          ) : file.file_type?.startsWith("image/") ? (
            <img src={file.storage_url} alt={file.file_name} className="max-w-full rounded-lg mx-auto" />
          ) : content?.has_extracted_content ? (
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
              {content.content}
            </pre>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <FileIcon className="size-10 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm">Preview not available for this file type</p>
              <a
                href={file.storage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block"
              >
                Open in new tab →
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Share Modal ─────────────────────────────────────────────
function ShareModal({ open, onClose, file, onShared }) {
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);

  const searchUsers = useCallback(async (q) => {
    if (!q || q.length < 2) { setUsers([]); return; }
    setSearching(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/employees?search=${encodeURIComponent(q)}`, axiosConfig());
      setUsers((res.data?.employees || res.data || []).slice(0, 8));
    } catch {
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(email), 300);
    return () => clearTimeout(t);
  }, [email, searchUsers]);

  const handleShare = async (userId) => {
    setSharing(true);
    try {
      await axios.post(`${BACKEND_URL}/files/${file._id}/share`, { userId }, axiosConfig());
      toast.success("File shared");
      onShared();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to share");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Share File</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-zinc-500 -mt-2">Search for a user to share "{file?.file_name}" with</p>

        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Search by name or email..."
          className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 mt-2"
        />

        <div className="max-h-48 overflow-y-auto mt-2 space-y-1">
          {searching && (
            <div className="text-center py-4"><Loader2 className="size-4 animate-spin text-zinc-500 mx-auto" /></div>
          )}
          {!searching && users.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer"
              onClick={() => handleShare(u._id)}
            >
              <div>
                <p className="text-sm text-zinc-200">{u.first_name} {u.last_name}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
              {sharing ? (
                <Loader2 className="size-4 animate-spin text-zinc-500" />
              ) : (
                <Plus className="size-4 text-indigo-400" />
              )}
            </div>
          ))}
          {!searching && email.length >= 2 && users.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main FileManager ────────────────────────────────────────
export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid"); // grid | list
  const [filter, setFilter] = useState("all"); // all | my | shared | public
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [shareFile, setShareFile] = useState(null);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = userData?._id || userData?.id;

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/files`, axiosConfig());
      setFiles(res.data || []);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (fileId) => {
    if (!confirm("Delete this file permanently?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/files/${fileId}`, axiosConfig());
      toast.success("File deleted");
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleDownload = async (file) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/files/${file._id}/download`, axiosConfig());
      window.open(res.data.url, "_blank");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  // Filtering
  const filtered = files.filter((f) => {
    if (search && !f.file_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "my") return String(f.uploaded_by) === String(userId);
    if (filter === "shared") return String(f.uploaded_by) !== String(userId) && !f.permissions?.is_public;
    if (filter === "public") return f.permissions?.is_public;
    return true;
  });

  const stats = {
    total: files.length,
    my: files.filter((f) => String(f.uploaded_by) === String(userId)).length,
    shared: files.filter((f) => String(f.uploaded_by) !== String(userId) && !f.permissions?.is_public).length,
    public: files.filter((f) => f.permissions?.is_public).length,
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <FolderOpen className="size-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">File Manager</h1>
            <p className="text-xs text-zinc-500">Upload, share & manage files</p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Upload className="size-4" /> Upload File
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-6 py-3 border-b border-zinc-800/40 overflow-x-auto">
        {[
          { key: "all", label: "All Files", value: stats.total, icon: FolderOpen, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { key: "my", label: "My Files", value: stats.my, icon: Lock, color: "text-purple-400", bg: "bg-purple-500/10" },
          { key: "shared", label: "Shared", value: stats.shared, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { key: "public", label: "Public", value: stats.public, icon: Globe, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map(({ key, label, value, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all min-w-[140px] ${
              filter === key
                ? "border-indigo-500/40 bg-indigo-500/5"
                : "border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-700"
            }`}
          >
            <div className={`size-8 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon className={`size-4 ${color}`} />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{label}</p>
              <p className="text-lg font-bold text-zinc-200">{value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/40">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded ${view === "grid" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <Grid3X3 className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded ${view === "list" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* File list / grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="size-8 animate-spin text-zinc-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="size-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="size-7 text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-zinc-400">
              {search ? "No files match your search" : "No files yet"}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              {search ? "Try a different search term" : "Click Upload File to get started"}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((f) => (
              <FileCard
                key={f._id}
                file={f}
                isMine={String(f.uploaded_by) === String(userId)}
                onPreview={() => setPreviewFile(f)}
                onDownload={() => handleDownload(f)}
                onDelete={() => handleDelete(f._id)}
                onShare={() => setShareFile(f)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {/* List header */}
            <div className="grid grid-cols-[1fr_120px_120px_100px_40px] gap-3 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider font-medium">
              <span>Name</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span>Access</span>
              <span></span>
            </div>
            {filtered.map((f) => (
              <FileRow
                key={f._id}
                file={f}
                isMine={String(f.uploaded_by) === String(userId)}
                onPreview={() => setPreviewFile(f)}
                onDownload={() => handleDownload(f)}
                onDelete={() => handleDelete(f._id)}
                onShare={() => setShareFile(f)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={fetchFiles} />
      <PreviewModal open={!!previewFile} onClose={() => setPreviewFile(null)} file={previewFile} />
      <ShareModal open={!!shareFile} onClose={() => setShareFile(null)} file={shareFile} onShared={fetchFiles} />
    </div>
  );
}

// ─── Grid Card ───────────────────────────────────────────────
function FileCard({ file, isMine, onPreview, onDownload, onDelete, onShare }) {
  return (
    <div className="group bg-zinc-900/70 border border-zinc-800/60 rounded-xl overflow-hidden hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer">
      {/* Thumbnail area */}
      <div className="h-28 bg-zinc-900 flex items-center justify-center relative" onClick={onPreview}>
        {file.file_type?.startsWith("image/") ? (
          <img src={file.storage_url} alt={file.file_name} className="h-full w-full object-cover" />
        ) : (
          getFileIcon(file.file_type, "size-10 opacity-40")
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="size-6 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200 truncate">{file.file_name}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
              <span>{formatSize(file.file_size)}</span>
              <span>·</span>
              <span>{timeAgo(file.created_at)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 flex-shrink-0">
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <DropdownMenuItem onClick={onPreview} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Eye className="size-4 mr-2" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownload} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Download className="size-4 mr-2" /> Download
              </DropdownMenuItem>
              {isMine && (
                <>
                  <DropdownMenuItem onClick={onShare} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    <Share2 className="size-4 mr-2" /> Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:bg-zinc-800 focus:text-red-300">
                    <Trash2 className="size-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tags + badges */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {file.permissions?.is_public && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">
              Public
            </Badge>
          )}
          {isMine && (
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] px-1.5 py-0">
              Mine
            </Badge>
          )}
          {file.metadata?.tags?.slice(0, 2).map((t, i) => (
            <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5 py-0">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── List Row ────────────────────────────────────────────────
function FileRow({ file, isMine, onPreview, onDownload, onDelete, onShare }) {
  return (
    <div
      className="grid grid-cols-[1fr_120px_120px_100px_40px] gap-3 items-center px-4 py-2.5 rounded-lg hover:bg-zinc-900/70 cursor-pointer group"
      onClick={onPreview}
    >
      <div className="flex items-center gap-3 min-w-0">
        {getFileIcon(file.file_type, "size-5 flex-shrink-0")}
        <span className="text-sm text-zinc-200 truncate">{file.file_name}</span>
        {isMine && (
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] px-1.5 py-0 flex-shrink-0">
            Mine
          </Badge>
        )}
      </div>
      <span className="text-xs text-zinc-500">{formatSize(file.file_size)}</span>
      <span className="text-xs text-zinc-500">{timeAgo(file.created_at)}</span>
      <span className="text-xs">
        {file.permissions?.is_public ? (
          <span className="text-emerald-400 flex items-center gap-1"><Globe className="size-3" /> Public</span>
        ) : (
          <span className="text-zinc-500 flex items-center gap-1"><Lock className="size-3" /> Private</span>
        )}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
          <DropdownMenuItem onClick={onPreview} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <Eye className="size-4 mr-2" /> Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <Download className="size-4 mr-2" /> Download
          </DropdownMenuItem>
          {isMine && (
            <>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Share2 className="size-4 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 focus:bg-zinc-800 focus:text-red-300">
                <Trash2 className="size-4 mr-2" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
