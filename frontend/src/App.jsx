import { Route, Routes } from "react-router-dom";
import "./App.css";

import JoinMeetingPage from "@/pages/JoinMeetingPage";
import EmployeeLogin from "@/pages/employee/EmployeeLogin";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfilePage from "./pages/employee/ProfilePage";
import ChangePasswordPage from "./pages/employee/ChangePasswordPage";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerRegister from "./pages/customer/CustomerRegister";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SharedFilePage from "./pages/SharedFilePage";

import AuthContextProvider from "./context/AuthContextProvider";
import NotificationContextProvider from "./context/NotificationContextProvider";
import NotificationInitializer from "./components/NotificationInitializer";
import NotificationListener from "./components/NotificationListener";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import CustomerProtectedRoute from "./components/CustomerProtectedRoute";

import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <AuthContextProvider>
      <NotificationContextProvider>
        {/* Initialize notification system on app load */}
        <NotificationInitializer />

        {/* Invisible listener for notification events */}
        <NotificationListener />

        <Routes>
          {/* PUBLIC ROUTES */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <EmployeeLogin />
              </PublicRoute>
            }
          />

          <Route
            path="/adminLogin"
            element={
              <PublicRoute>
                <AdminLoginPage />
              </PublicRoute>
            }
          />

          {/* CUSTOMER PUBLIC ROUTES */}
          <Route
            path="/customer/login"
            element={
              <PublicRoute>
                <CustomerLogin />
              </PublicRoute>
            }
          />
          <Route
            path="/customer/register"
            element={
              <PublicRoute>
                <CustomerRegister />
              </PublicRoute>
            }
          />

          <Route path="/join/:code" element={<JoinMeetingPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/shared/:token" element={<SharedFilePage />} />

          {/* EMPLOYEE PROTECTED */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <EmployeeProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          {/* ADMIN PROTECTED */}
          <Route
            path="/adminDashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />

          {/* CUSTOMER PROTECTED */}
          <Route
            path="/customer/dashboard"
            element={
              <CustomerProtectedRoute>
                <CustomerDashboard />
              </CustomerProtectedRoute>
            }
          />
        </Routes>

        <Toaster position="top-right" richColors duration={3000} />
      </NotificationContextProvider>
    </AuthContextProvider>
  );
}

export default App;
