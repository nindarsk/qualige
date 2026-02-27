import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HRDashboard from "./pages/dashboards/HRDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import DashboardPlaceholder from "./components/DashboardPlaceholder";
import UploadCoursePage from "./pages/dashboards/hr/UploadCoursePage";
import CoursesListPage from "./pages/dashboards/hr/CoursesListPage";
import CourseReviewPage from "./pages/dashboards/hr/CourseReviewPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* HR Admin */}
            <Route
              path="/hr"
              element={
                <ProtectedRoute allowedRoles={["hr_admin"]}>
                  <HRDashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPlaceholder title="Dashboard" description="Welcome to your HR Admin dashboard. Course management and analytics coming soon." />} />
              <Route path="upload" element={<UploadCoursePage />} />
              <Route path="courses" element={<CoursesListPage />} />
              <Route path="courses/:id/review" element={<CourseReviewPage />} />
              <Route path="employees" element={<DashboardPlaceholder title="Employees" description="Manage employee accounts and training progress." />} />
              <Route path="reports" element={<DashboardPlaceholder title="Reports" description="View compliance reports and training analytics." />} />
              <Route path="settings" element={<DashboardPlaceholder title="Settings" description="Organization settings and configuration." />} />
            </Route>

            {/* Employee */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPlaceholder title="My Courses" description="Your assigned training courses will appear here." />} />
              <Route path="certificates" element={<DashboardPlaceholder title="My Certificates" description="Your earned certificates will appear here." />} />
              <Route path="profile" element={<DashboardPlaceholder title="Profile" description="Manage your profile and preferences." />} />
            </Route>

            {/* Super Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPlaceholder title="Organizations" description="Manage all registered organizations." />} />
              <Route path="billing" element={<DashboardPlaceholder title="Billing" description="Manage billing and subscriptions." />} />
              <Route path="settings" element={<DashboardPlaceholder title="Settings" description="Platform-wide settings." />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
