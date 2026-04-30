import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Key,
} from "lucide-react";
// import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";
import { toast } from "sonner";
import axios from "axios";

const AdminChangePasswordPage = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");

    if (name === "newPassword") {
      calculatePasswordStrength(value);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[@#$!%*?&]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const toggleShowPassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      setLoading(false);
      return;
    }
    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    if (!/[A-Z]/.test(formData.newPassword)) {
      setError("Password must contain at least one uppercase letter");
      setLoading(false);
      return;
    }
    if (!/[a-z]/.test(formData.newPassword)) {
      setError("Password must contain at least one lowercase letter");
      setLoading(false);
      return;
    }
    if (!/[0-9]/.test(formData.newPassword)) {
      setError("Password must contain at least one number");
      setLoading(false);
      return;
    }
    if (!/[@#$!%*?&]/.test(formData.newPassword)) {
      setError(
        "Password must contain at least one special character (@#$!%*?&)"
      );
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${BACKEND_URL}/auth/change-password`,
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = response.data;
      if (result.success) {
        setSuccess(true);
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPasswordStrength(0);
        toast.success("Password changed successfully");
        setTimeout(() => onNavigate("profile"), 1500);
      } else {
        setError(result.error || "Failed to change password");
        toast.error(result.message || "Failed to change password");
      }
    } catch (err) {
      const message =
        err.response?.data?.error || "Network error. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-400";
    if (passwordStrength <= 3) return "bg-amber-400";
    if (passwordStrength <= 4) return "bg-indigo-500";
    return "bg-emerald-500";
  };

  const getStrengthText = () => {
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 3) return "Fair";
    if (passwordStrength <= 4) return "Good";
    return "Strong";
  };

  const inputClasses =
    "w-full px-3 py-2 border border-zinc-600 rounded-lg text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-500 transition";

  return (
    <div className="p-6 lg:p-8 max-w-md mx-auto bg-zinc-950 min-h-screen">
      <button
        onClick={() => onNavigate("profile")}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Profile
      </button>

      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-700/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Change Password
              </h1>
              <p className="text-xs text-zinc-500">Keep your account secure</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2.5 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className={`${inputClasses} pr-10`}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => toggleShowPassword("current")}
                className="absolute right-2.5 top-1/2 -tranzinc-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className={`${inputClasses} pr-10`}
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => toggleShowPassword("new")}
                className="absolute right-2.5 top-1/2 -tranzinc-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {formData.newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">Strength</span>
                  <span className="text-xs font-medium text-zinc-300">
                    {getStrengthText()}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{
                      width: `${(passwordStrength / 5) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`${inputClasses} pr-10`}
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => toggleShowPassword("confirm")}
                className="absolute right-2.5 top-1/2 -tranzinc-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {formData.confirmPassword &&
              formData.newPassword !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">
                  Passwords do not match
                </p>
              )}
          </div>

          {/* Requirements */}
          <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-lg p-3">
            <p className="text-xs font-medium text-zinc-400 mb-2">
              Requirements
            </p>
            <div className="space-y-1">
              <RequirementItem
                text="At least 8 characters"
                met={formData.newPassword.length >= 8}
              />
              <RequirementItem
                text="One uppercase letter (A-Z)"
                met={/[A-Z]/.test(formData.newPassword)}
              />
              <RequirementItem
                text="One lowercase letter (a-z)"
                met={/[a-z]/.test(formData.newPassword)}
              />
              <RequirementItem
                text="One number (0-9)"
                met={/[0-9]/.test(formData.newPassword)}
              />
              <RequirementItem
                text="One special character (@#$!%*?&)"
                met={/[@#$!%*?&]/.test(formData.newPassword)}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || success}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing Password...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Password Changed!
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const RequirementItem = ({ text, met }) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
        met ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    >
      {met && <CheckCircle className="w-2.5 h-2.5 text-white" />}
    </div>
    <span className={`text-xs ${met ? "text-zinc-300" : "text-zinc-500"}`}>
      {text}
    </span>
  </div>
);

export default AdminChangePasswordPage;
