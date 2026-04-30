import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
// import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(`${BACKEND_URL}/auth/request-reset`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-950 p-8">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        {sent ? (
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Check your email</h2>
            <p className="text-gray-500 text-sm">
              If an account exists for <strong>{email}</strong>, we've sent a
              password reset link. Please check your inbox and spam folder.
            </p>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Try another email
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-bold">Forgot password?</h2>
              <p className="text-gray-500 text-sm">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>
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
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-violet-600 hover:bg-violet-700"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
