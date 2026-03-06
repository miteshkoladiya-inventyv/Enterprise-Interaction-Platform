import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Handles shareable meeting links: /join/:code
 * Redirects to the appropriate dashboard (admin or employee) with joinCode in URL.
 */
export default function JoinMeetingPage() {
  const navigate = useNavigate();
  const { code } = useParams();

  useEffect(() => {
    if (!code) {
      navigate("/");
      return;
    }

    const token = localStorage.getItem("token");
    const adminData = localStorage.getItem("adminData");
    const userData = localStorage.getItem("user");
    const customerData = localStorage.getItem("customerData");

    if (!token) {
      navigate(`/login?returnTo=/join/${code}`);
      return;
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const joinParam = `?joinCode=${encodeURIComponent(normalizedCode)}`;

    if (adminData) {
      navigate(`/adminDashboard${joinParam}`, { replace: true });
    } else if (userData) {
      navigate(`/${joinParam}`, { replace: true });
    } else if (customerData) {
      navigate(`/customer/dashboard${joinParam}`, { replace: true });
    } else {
      navigate("/");
    }
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to meeting...</p>
      </div>
    </div>
  );
}
