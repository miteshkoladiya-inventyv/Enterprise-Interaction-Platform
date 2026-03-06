import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Building2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { BACKEND_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/context/AuthContextProvider"; // Import the hook

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuthContext(); // Get setUser from context
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    console.log(`${BACKEND_URL}/auth/employee/login`);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/auth/employee/login`,
        formData
      );

      // Store in localStorage
      localStorage.setItem("user", JSON.stringify(response.data.user));
      localStorage.setItem("token", response.data.token);

      // Update context state to trigger socket connection
      setUser(response.data.user);

      // Navigate after a small delay to ensure socket connects
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (error) {
      setError(error.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-600 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-700 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">
            Enterprise Platform
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your digital
            <br />
            workspace
            <br />
            awaits
          </h1>
          <p className="text-emerald-100 text-lg max-w-md">
            Connect with your team, access resources, and manage your work all
            in one secure platform.
          </p>
          {/* <div className="flex gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold text-white">24/7</p>
              <p className="text-emerald-200 text-sm">Access</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">100%</p>
              <p className="text-emerald-200 text-sm">Secure</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">Fast</p>
              <p className="text-emerald-200 text-sm">Response</p>
            </div>
          </div> */}
        </div>

        {/* Footer */}
        <p className="text-emerald-200 text-sm relative z-10">
          © 2026 Enterprise Platform. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-sky-50 dark:bg-gray-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="font-semibold text-lg">Enterprise Platform</span>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-gray-500">Sign in to access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t space-y-3">
            <p className="text-center text-sm text-gray-500">
              Administrator?{" "}
              <a
                href="/adminLogin"
                className="text-emerald-600 font-medium hover:underline"
              >
                Admin login
              </a>
            </p>
            <p className="text-center text-xs text-gray-400">
              Employee accounts are created by your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
