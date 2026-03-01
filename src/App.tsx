import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import InviteAcceptPage from "./pages/InviteAcceptPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HRDashboard from "./pages/dashboards/HRDashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import DashboardPlaceholder from "./components/DashboardPlaceholder";
import ReportsPage from "./pages/dashboards/hr/ReportsPage";
import UploadCoursePage from "./pages/dashboards/hr/UploadCoursePage";
import CoursesListPage from "./pages/dashboards/hr/CoursesListPage";
import CourseReviewPage from "./pages/dashboards/hr/CourseReviewPage";
import EmployeesPage from "./pages/dashboards/hr/EmployeesPage";
import HRDashboardIndex from "./pages/dashboards/hr/HRDashboardIndex";
import EmployeeCoursesPage from "./pages/dashboards/employee/EmployeeCoursesPage";
import EmployeeCertificatesPage from "./pages/dashboards/employee/EmployeeCertificatesPage";
import CourseLearnPage from "./pages/dashboards/employee/CourseLearnPage";
import QuizPage from "./pages/dashboards/employee/QuizPage";
import QuizResultsPage from "./pages/dashboards/employee/QuizResultsPage";
import NotFound from "./pages/NotFound";
import PricingPage from "./pages/PricingPage";
import BillingPage from "./pages/dashboards/hr/BillingPage";

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
            <Route path="/invite/accept" element={<InviteAcceptPage />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* HR Admin */}
            <Route
              path="/hr"
              element={
                <ProtectedRoute allowedRoles={["hr_admin"]}>
                  <HRDashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<HRDashboardIndex />} />
              <Route path="upload" element={<UploadCoursePage />} />
              <Route path="courses" element={<CoursesListPage />} />
              <Route path="courses/:id/review" element={<CourseReviewPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="billing" element={<BillingPage />} />
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
              <Route index element={<EmployeeCoursesPage />} />
              <Route path="certificates" element={<EmployeeCertificatesPage />} />
              <Route path="learn/:courseId" element={<CourseLearnPage />} />
              <Route path="learn/:courseId/quiz" element={<QuizPage />} />
              <Route path="learn/:courseId/results" element={<QuizResultsPage />} />
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
