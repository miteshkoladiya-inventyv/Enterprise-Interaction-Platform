import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
// import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";

const ProtectedRoute = ({ children }) => {
  const [status, setStatus] = useState("checking"); // "checking" | "valid" | "invalid"

  const userRaw = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!userRaw || !token) {
      setStatus("invalid");
      return;
    }

    let user;
    try {
      user = JSON.parse(userRaw);
    } catch {
      setStatus("invalid");
      return;
    }

    if (user.user_type !== "employee") {
      setStatus("invalid");
      return;
    }

    // Verify with backend that employee access is still valid
    axios
      .get(`${BACKEND_URL}/auth/employee/verify`, {
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
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setStatus("invalid");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (status === "invalid") {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
