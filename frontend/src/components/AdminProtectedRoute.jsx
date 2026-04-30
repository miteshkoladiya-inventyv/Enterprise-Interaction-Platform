import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
//import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";

const AdminProtectedRoute = ({ children }) => {
  const [status, setStatus] = useState("checking"); // "checking" | "valid" | "invalid"

  const adminRaw = localStorage.getItem("adminData");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!adminRaw || !token) {
      setStatus("invalid");
      return;
    }

    let admin;
    try {
      admin = JSON.parse(adminRaw);
    } catch {
      setStatus("invalid");
      return;
    }

    // Quick local check first
    if (admin.user_type !== "admin" && !admin.has_admin_role) {
      setStatus("invalid");
      return;
    }

    // Verify with backend that admin access is still valid
    axios
      .get(`${BACKEND_URL}/auth/admin/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => {
        // Access revoked or token expired
        localStorage.removeItem("adminData");
        localStorage.removeItem("token");
        setStatus("invalid");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (status === "invalid") {
    localStorage.removeItem("adminData");
    localStorage.removeItem("token");
    return <Navigate to="/adminLogin" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
