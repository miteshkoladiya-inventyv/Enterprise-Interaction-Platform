import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import {
  Loader2,
  Download,
  FileText,
  AlertCircle,
  Lock,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SharedFilePage() {
  const { token } = useParams();
  // idle | loading | password | success | error
  const [state, setState] = useState("loading");
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const accessFile = async (pw = null) => {
    if (pw !== null) {
      setPwSubmitting(true);
      setPwError("");
    } else {
      setState("loading");
    }
    try {
      const body = pw ? { password: pw } : {};
      const res = await axios.post(
        `${BACKEND_URL}/files/shared/${token}/access`,
        body
      );
      setFileInfo(res.data);
      setState("success");
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || "Something went wrong.";

      if (status === 401) {
        setState("password");
        if (pw !== null) setPwError("Incorrect password. Try again.");
      } else if (status === 403) {
        setError(msg);
        setState("error");
      } else if (status === 410) {
        setError(msg);
        setState("error");
      } else if (status === 404) {
        setError("This link is invalid or has been removed.");
        setState("error");
      } else {
        setError(msg);
        setState("error");
      }
    } finally {
      if (pw !== null) setPwSubmitting(false);
    }
  };

  useEffect(() => {
    accessFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (fileInfo?.url) window.open(fileInfo.url, "_blank");
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="size-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="size-7 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100">Shared File</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Securely shared via Enterprise Platform
            </p>
          </div>

          {/* Loading */}
          {state === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-8 animate-spin text-zinc-500" />
            </div>
          )}

          {/* Password required */}
          {state === "password" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <Lock className="size-4 shrink-0" />
                <span>This link is password protected</span>
              </div>
              {pwError && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="size-4" /> {pwError}
                </p>
              )}
              <Input
                type="password"
                placeholder="Enter link password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !pwSubmitting && accessFile(password)
                }
                className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
                autoFocus
              />
              <Button
                onClick={() => accessFile(password)}
                disabled={pwSubmitting || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {pwSubmitting ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : null}
                {pwSubmitting ? "Verifying…" : "Access File"}
              </Button>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="size-12 text-red-400 mx-auto" />
              <div>
                <p className="text-zinc-300 font-medium">{error}</p>
                <p className="text-xs text-zinc-600 mt-2">
                  The link may have expired, been revoked, or already used.
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {state === "success" && fileInfo && (
            <div className="space-y-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <p className="font-semibold text-zinc-200 text-lg leading-tight">
                  {fileInfo.file_name}
                </p>
                <p className="text-xs text-zinc-500">{fileInfo.file_type}</p>
                {fileInfo.expires_at && (
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="size-3" />
                    Expires:{" "}
                    {new Date(fileInfo.expires_at).toLocaleString()}
                  </div>
                )}
                {fileInfo.one_time && (
                  <p className="text-xs text-amber-400 font-medium">
                    ⚠ One-time link — this link has now been used
                  </p>
                )}
              </div>
              <Button
                onClick={handleDownload}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11"
              >
                <Download className="size-4" />
                Download File
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-700 mt-4">
          Enterprise Interaction Platform · Secure File Sharing
        </p>
      </div>
    </div>
  );
}
