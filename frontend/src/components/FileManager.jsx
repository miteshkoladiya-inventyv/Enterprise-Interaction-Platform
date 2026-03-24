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
  MessageSquare,
  BarChart3,
  RotateCcw,
  Star,
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
  const [accessRole, setAccessRole] = useState("viewer");

  const searchUsers = useCallback(async (q) => {
    if (!q || q.length < 2) { setUsers([]); return; }
    setSearching(true);
    try {
      const res = await axios.get(
        `${BACKEND_URL}/helper/search-users?query=${encodeURIComponent(q)}&limit=8`,
        axiosConfig()
      );
      setUsers(res.data?.users || []);
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
      await axios.post(
        `${BACKEND_URL}/files/${file._id}/share`,
        { userId, access_role: accessRole },
        axiosConfig()
      );
      toast.success(`File shared as ${accessRole}`);
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

        <div className="mt-2">
          <label className="text-xs text-zinc-500 mb-1 block">Access role</label>
          <select
            value={accessRole}
            onChange={(e) => setAccessRole(e.target.value)}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm px-3 py-2"
          >
            <option value="viewer">Viewer (read/download)</option>
            <option value="editor">Editor (metadata + versions)</option>
          </select>
        </div>

        <div className="max-h-48 overflow-y-auto mt-2 space-y-1">
          {searching && (
            <div className="text-center py-4"><Loader2 className="size-4 animate-spin text-zinc-500 mx-auto" /></div>
          )}
          {!searching && users.map((u, idx) => {
            const targetId = u?._id || u?.id || u?.user_id;
            const fullName = `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || u?.name || "Unknown User";
            const emailValue = u?.email || "No email";

            return (
              <div
                key={targetId || idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer"
                onClick={() => targetId && handleShare(targetId)}
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{fullName}</p>
                  <p className="text-xs text-zinc-500 truncate">{emailValue}</p>
                </div>
                {sharing ? (
                  <Loader2 className="size-4 animate-spin text-zinc-500" />
                ) : (
                  <Plus className="size-4 text-indigo-400 shrink-0" />
                )}
              </div>
            );
          })}
          {!searching && email.length >= 2 && users.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecureLinkModal({ open, onClose, file }) {
  const [hours, setHours] = useState(24);
  const [oneTime, setOneTime] = useState(false);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [linkResult, setLinkResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setLinkResult(null);
      setPassword("");
      setHours(24);
      setOneTime(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!file?._id) return;
    setCreating(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/files/${file._id}/share-link`,
        {
          expires_in_hours: Number(hours) || 24,
          one_time: oneTime,
          password: password || undefined,
        },
        axiosConfig()
      );
      setLinkResult(res.data);
      toast.success("Secure link created");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create secure link");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!linkResult?.token) return;
    const shareUrl = `${window.location.origin}/shared/${linkResult.token}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create Secure Link</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-zinc-500 -mt-2">{file?.file_name}</p>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Expires in (hours)</label>
            <Input
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Optional link password</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set password for this link"
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={oneTime}
              onChange={(e) => setOneTime(e.target.checked)}
              className="accent-indigo-500"
            />
            One-time download link
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            Close
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {creating ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {creating ? "Creating..." : "Create Link"}
          </Button>
        </div>

        {linkResult?.token && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-xs text-zinc-500">Token: {linkResult.token}</p>
            <p className="text-xs text-zinc-500 mt-1">Expires: {new Date(linkResult.expires_at).toLocaleString()}</p>
            <Button onClick={copyLink} className="mt-3 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
              Copy Share URL
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersionsModal({ open, onClose, file, canUpload, onUpdated }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const fetchVersions = useCallback(async () => {
    if (!file?._id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/files/${file._id}/versions`, axiosConfig());
      setVersions(res.data?.versions || []);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [file?._id]);

  useEffect(() => {
    if (open) fetchVersions();
  }, [open, fetchVersions]);

  const handleUploadVersion = async (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile || !file?._id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", nextFile);
      await axios.post(`${BACKEND_URL}/files/${file._id}/version`, formData, {
        ...axiosConfig(),
        headers: { ...axiosConfig().headers, "Content-Type": "multipart/form-data" },
      });
      toast.success("New version uploaded");
      await fetchVersions();
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload new version");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRestore = async (versionNumber) => {
    if (!file?._id || !confirm(`Restore file to version ${versionNumber}? The current state will be replaced.`)) return;
    setRestoring(versionNumber);
    try {
      await axios.post(
        `${BACKEND_URL}/files/${file._id}/versions/${versionNumber}/restore`,
        {},
        axiosConfig()
      );
      toast.success(`Restored to version ${versionNumber}`);
      await fetchVersions();
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Versions: {file?.file_name}</DialogTitle>
        </DialogHeader>

        {canUpload && (
          <div className="mb-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-sm text-white cursor-pointer">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload New Version
              <input type="file" className="hidden" onChange={handleUploadVersion} disabled={uploading} />
            </label>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-6"><Loader2 className="size-5 animate-spin text-zinc-500 mx-auto" /></div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-zinc-500">No versions found.</p>
          ) : (
            versions
              .slice()
              .sort((a, b) => b.version_number - a.version_number)
              .map((v) => (
                <div key={`${v.version_number}-${v.uploaded_at}`} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium">Version {v.version_number}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatSize(v.file_size)} · {new Date(v.uploaded_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        By: {v.uploaded_by?.first_name ? `${v.uploaded_by.first_name} ${v.uploaded_by.last_name || ""}`.trim() : "Unknown"}
                      </p>
                    </div>
                    {canUpload && (
                      <button
                        onClick={() => handleRestore(v.version_number)}
                        disabled={restoring === v.version_number}
                        className="ml-3 shrink-0 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 border border-indigo-500/30 rounded px-2 py-1"
                      >
                        {restoring === v.version_number
                          ? <Loader2 className="size-3 animate-spin" />
                          : <RotateCcw className="size-3" />}
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityModal({ open, onClose, file }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file?._id) return;
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/files/${file._id}/activity`, axiosConfig())
      .then((res) => setEvents(res.data?.activity_log || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [open, file?._id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Activity: {file?.file_name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-6"><Loader2 className="size-5 animate-spin text-zinc-500 mx-auto" /></div>
          ) : events.length === 0 ? (
            <p className="text-sm text-zinc-500">No activity found.</p>
          ) : (
            events
              .slice()
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((e, idx) => (
                <div key={`${e.timestamp}-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-sm text-zinc-200 uppercase">{e.action}</p>
                  <p className="text-xs text-zinc-500 mt-1">{new Date(e.timestamp).toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    By: {e.user_id?.first_name ? `${e.user_id.first_name} ${e.user_id.last_name || ""}`.trim() : "Unknown"}
                  </p>
                </div>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ask AI Modal ─────────────────────────────────────────────
function AskAIModal({ open, onClose, file }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQuestion(""); setAnswer(null); }
  }, [open]);

  const handleAsk = async () => {
    if (!question.trim() || !file?._id) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/files/${file._id}/ask`,
        { question: question.trim() },
        axiosConfig()
      );
      setAnswer(res.data.answer);
    } catch (err) {
      toast.error(err.response?.data?.error || "AI Q&A failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <MessageSquare className="size-5 text-indigo-400" />
            Ask AI: {file?.file_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAsk()}
              placeholder="Ask a question about this file…"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 flex-1"
              autoFocus
            />
            <Button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
            </Button>
          </div>
          {answer && (
            <div className="rounded-lg border border-indigo-500/30 bg-zinc-950 p-4 max-h-72 overflow-y-auto">
              <p className="text-xs text-indigo-400 font-medium mb-2 flex items-center gap-1">
                <MessageSquare className="size-3" /> AI Answer
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
          {!answer && !loading && (
            <p className="text-xs text-zinc-600">Works best with PDF, Word (.docx), and text files.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AISummaryModal({ open, onClose, file }) {
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file?._id) return;
    setSummary("");
    setKeyPoints([]);
    setLoading(true);

    axios
      .post(`${BACKEND_URL}/files/${file._id}/summary`, {}, axiosConfig())
      .then((res) => {
        setSummary(res.data?.summary || "No summary returned.");
        setKeyPoints(Array.isArray(res.data?.key_points) ? res.data.key_points : []);
      })
      .catch((err) => {
        toast.error(err.response?.data?.error || "AI summary failed");
      })
      .finally(() => setLoading(false));
  }, [open, file?._id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <FileText className="size-5 text-indigo-400" />
            AI Summary: {file?.file_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="size-7 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wider text-indigo-400 mb-2">Summary</p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{summary || "No summary available."}</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wider text-indigo-400 mb-2">Key Points</p>
              {keyPoints.length === 0 ? (
                <p className="text-sm text-zinc-500">No key points available.</p>
              ) : (
                <ul className="space-y-2">
                  {keyPoints.map((point, idx) => (
                    <li key={`${idx}-${point}`} className="text-sm text-zinc-300 flex gap-2">
                      <span className="text-indigo-400">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Activity Dashboard ────────────────────────────────────────
function ActivityDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 500 });
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("date_to", new Date(dateTo + "T23:59:59").toISOString());
      const res = await axios.get(`${BACKEND_URL}/files/activity?${params}`, axiosConfig());
      setEvents(res.data?.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = events.filter((e) => {
    if (!userFilter) return true;
    const name = e.user_id?.first_name
      ? `${e.user_id.first_name} ${e.user_id.last_name || ""}`.toLowerCase()
      : "";
    return name.includes(userFilter.toLowerCase());
  });

  const actionColor = {
    download: "bg-emerald-500/10 text-emerald-400",
    view: "bg-blue-500/10 text-blue-400",
    edit: "bg-amber-500/10 text-amber-400",
    share: "bg-purple-500/10 text-purple-400",
    favorite: "bg-yellow-500/10 text-yellow-400",
    summary: "bg-indigo-500/10 text-indigo-400",
    delete: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-2 h-9"
        >
          <option value="">All Actions</option>
          <option value="view">View</option>
          <option value="download">Download</option>
          <option value="edit">Edit</option>
          <option value="share">Share</option>
          <option value="favorite">Favorite</option>
          <option value="summary">Summary</option>
          <option value="delete">Delete</option>
        </select>
        <Input
          placeholder="Filter by user name…"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="w-44 bg-zinc-900 border-zinc-800 text-zinc-300 h-9"
        />
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-600 mb-0.5 ml-1">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 bg-zinc-900 border-zinc-800 text-zinc-300 h-9"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-600 mb-0.5 ml-1">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 bg-zinc-900 border-zinc-800 text-zinc-300 h-9"
          />
        </div>
        <Button onClick={fetchEvents} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9">
          {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Apply
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="size-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No activity events found.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-zinc-600 mb-2">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-[1fr_100px_150px_170px] gap-2 px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider font-medium border-b border-zinc-800/60">
            <span>File</span><span>Action</span><span>User</span><span>Date / Time</span>
          </div>
          <div className="space-y-0.5 mt-1">
            {filtered.map((e, i) => (
              <div
                key={`${e.file_id}-${e.timestamp}-${i}`}
                className="grid grid-cols-[1fr_100px_150px_170px] gap-2 px-3 py-2.5 rounded-lg hover:bg-zinc-900/60 items-center"
              >
                <span className="text-sm text-zinc-300 truncate">{e.file_name}</span>
                <span className={`text-xs font-medium uppercase px-2 py-0.5 rounded w-fit ${actionColor[e.action] || "bg-zinc-800 text-zinc-400"}`}>
                  {e.action}
                </span>
                <span className="text-xs text-zinc-400 truncate">
                  {e.user_id?.first_name
                    ? `${e.user_id.first_name} ${e.user_id.last_name || ""}`.trim()
                    : "Unknown"}
                </span>
                <span className="text-xs text-zinc-500">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const [linkFile, setLinkFile] = useState(null);
  const [versionsFile, setVersionsFile] = useState(null);
  const [activityFile, setActivityFile] = useState(null);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = userData?._id || userData?.id;
  const [askFile, setAskFile] = useState(null);
  const [summaryFile, setSummaryFile] = useState(null);

  const getMyRole = (file) => {
    if (!file || !userId) return null;
    if (String(file.uploaded_by) === String(userId)) return "owner";
    const shared = (file.permissions?.shared_with || []).find(
      (entry) => String(entry.user_id) === String(userId)
    );
    if (shared?.role) return shared.role;
    if ((file.permissions?.user_ids || []).some((id) => String(id) === String(userId))) return "viewer";
    return null;
  };

  const isFavorited = (file) =>
    (file?.favorites || []).some((entry) => String(entry?.user_id) === String(userId));

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

  const handleFavoriteToggle = async (file) => {
    if (!file?._id) return;
    const next = !isFavorited(file);
    try {
      await axios.post(
        `${BACKEND_URL}/files/${file._id}/favorite`,
        { favorite: next },
        axiosConfig()
      );
      setFiles((prev) =>
        prev.map((item) => {
          if (item._id !== file._id) return item;
          const favorites = (item.favorites || []).filter(
            (entry) => String(entry.user_id) !== String(userId)
          );
          if (next) favorites.push({ user_id: userId, added_at: new Date().toISOString() });
          return { ...item, favorites };
        })
      );
      toast.success(next ? "Added to favorites" : "Removed from favorites");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update favorite");
    }
  };

  // Filtering + favorite-to-top ordering
  const filtered = files
    .filter((f) => {
      if (search && !f.file_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "my") return String(f.uploaded_by) === String(userId);
      if (filter === "shared") return String(f.uploaded_by) !== String(userId) && !f.permissions?.is_public;
      if (filter === "public") return f.permissions?.is_public;
      if (filter === "favorites") return isFavorited(f);
      return true;
    })
    .slice()
    .sort((a, b) => {
      const favA = isFavorited(a) ? 1 : 0;
      const favB = isFavorited(b) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const stats = {
    total: files.length,
    my: files.filter((f) => String(f.uploaded_by) === String(userId)).length,
    shared: files.filter((f) => String(f.uploaded_by) !== String(userId) && !f.permissions?.is_public).length,
    public: files.filter((f) => f.permissions?.is_public).length,
    favorites: files.filter((f) => isFavorited(f)).length,
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
          { key: "favorites", label: "Favorites", value: stats.favorites, icon: Star, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { key: "activity", label: "Activity Log", value: null, icon: BarChart3, color: "text-sky-400", bg: "bg-sky-500/10" },
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
              <p className="text-lg font-bold text-zinc-200">{value ?? "—"}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/40">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 inset-y-0 my-auto size-4 text-zinc-500 pointer-events-none" />
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
        {filter === "activity" ? (
          <ActivityDashboard />
        ) : loading ? (
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
                myRole={getMyRole(f)}
                onPreview={() => setPreviewFile(f)}
                onDownload={() => handleDownload(f)}
                onDelete={() => handleDelete(f._id)}
                onShare={() => setShareFile(f)}
                onCreateLink={() => setLinkFile(f)}
                onVersions={() => setVersionsFile(f)}
                onActivity={() => setActivityFile(f)}
                onAsk={() => setAskFile(f)}
                onSummary={() => setSummaryFile(f)}
                onToggleFavorite={() => handleFavoriteToggle(f)}
                isFavorited={isFavorited(f)}
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
                myRole={getMyRole(f)}
                onPreview={() => setPreviewFile(f)}
                onDownload={() => handleDownload(f)}
                onDelete={() => handleDelete(f._id)}
                onShare={() => setShareFile(f)}
                onCreateLink={() => setLinkFile(f)}
                onVersions={() => setVersionsFile(f)}
                onActivity={() => setActivityFile(f)}
                onAsk={() => setAskFile(f)}
                onSummary={() => setSummaryFile(f)}
                onToggleFavorite={() => handleFavoriteToggle(f)}
                isFavorited={isFavorited(f)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={fetchFiles} />
      <PreviewModal open={!!previewFile} onClose={() => setPreviewFile(null)} file={previewFile} />
      <ShareModal open={!!shareFile} onClose={() => setShareFile(null)} file={shareFile} onShared={fetchFiles} />
      <SecureLinkModal open={!!linkFile} onClose={() => setLinkFile(null)} file={linkFile} />
      <VersionsModal
        open={!!versionsFile}
        onClose={() => setVersionsFile(null)}
        file={versionsFile}
        canUpload={["owner", "editor"].includes(getMyRole(versionsFile))}
        onUpdated={fetchFiles}
      />
      <ActivityModal open={!!activityFile} onClose={() => setActivityFile(null)} file={activityFile} />
      <AskAIModal open={!!askFile} onClose={() => setAskFile(null)} file={askFile} />
      <AISummaryModal open={!!summaryFile} onClose={() => setSummaryFile(null)} file={summaryFile} />
    </div>
  );
}

// ─── Grid Card ───────────────────────────────────────────────
function FileCard({ file, isMine, myRole, onPreview, onDownload, onDelete, onShare, onCreateLink, onVersions, onActivity, onAsk, onSummary, onToggleFavorite, isFavorited }) {
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
        {/* Quick-action star button */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`p-1 rounded bg-black/40 hover:bg-black/60 transition-all ${isFavorited ? "text-yellow-400 opacity-100" : "text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400"}`}
            title={isFavorited ? "Remove Favorite" : "Add Favorite"}
          >
            <Star className={`size-3.5 ${isFavorited ? "fill-yellow-400" : ""}`} />
          </button>
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
              <DropdownMenuItem onClick={onToggleFavorite} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Star className="size-4 mr-2" /> {isFavorited ? "Remove Favorite" : "Add Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onVersions} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Archive className="size-4 mr-2" /> Versions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onActivity} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Tag className="size-4 mr-2" /> Activity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSummary} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <FileText className="size-4 mr-2" /> AI Summary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAsk} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <MessageSquare className="size-4 mr-2" /> Ask AI
              </DropdownMenuItem>
              {isMine && (
                <>
                  <DropdownMenuItem onClick={onShare} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    <Share2 className="size-4 mr-2" /> Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onCreateLink} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    <Globe className="size-4 mr-2" /> Secure Link
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
          {isFavorited && (
            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px] px-1.5 py-0">
              Favorite
            </Badge>
          )}
          {!isMine && myRole === "editor" && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0">
              Editor
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
function FileRow({ file, isMine, myRole, onPreview, onDownload, onDelete, onShare, onCreateLink, onVersions, onActivity, onAsk, onSummary, onToggleFavorite, isFavorited }) {
  return (
    <div
      className="grid grid-cols-[1fr_120px_120px_100px_40px] gap-3 items-center px-4 py-2.5 rounded-lg hover:bg-zinc-900/70 cursor-pointer group"
      onClick={onPreview}
    >
      <div className="flex items-center gap-3 min-w-0">
        {getFileIcon(file.file_type, "size-5 flex-shrink-0")}
        <span className="text-sm text-zinc-200 truncate">{file.file_name}</span>
        {/* Quick-action star button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`p-0.5 rounded flex-shrink-0 transition-all ${isFavorited ? "text-yellow-400 opacity-100" : "text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-yellow-400"}`}
          title={isFavorited ? "Remove Favorite" : "Add Favorite"}
        >
          <Star className={`size-3.5 ${isFavorited ? "fill-yellow-400" : ""}`} />
        </button>
        {isMine && (
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] px-1.5 py-0 flex-shrink-0">
            Mine
          </Badge>
        )}
        {isFavorited && (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px] px-1.5 py-0 flex-shrink-0">
            Favorite
          </Badge>
        )}
        {!isMine && myRole === "editor" && (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0 flex-shrink-0">
            Editor
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
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <Star className="size-4 mr-2" /> {isFavorited ? "Remove Favorite" : "Add Favorite"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onVersions(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <Archive className="size-4 mr-2" /> Versions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onActivity(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <Tag className="size-4 mr-2" /> Activity
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSummary(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <FileText className="size-4 mr-2" /> AI Summary
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAsk(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
            <MessageSquare className="size-4 mr-2" /> Ask AI
          </DropdownMenuItem>
          {isMine && (
            <>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Share2 className="size-4 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateLink(); }} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                <Globe className="size-4 mr-2" /> Secure Link
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
