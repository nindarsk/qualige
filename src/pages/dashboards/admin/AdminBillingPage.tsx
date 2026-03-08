import DashboardPlaceholder from "@/components/DashboardPlaceholder";
import { usePageTitle } from "@/hooks/use-page-title";

const AdminBillingPage = () => {
  usePageTitle("Billing | Super Admin");
  return (
  <DashboardPlaceholder
    title="Platform Billing"
    description="View and manage platform-wide billing. Use the Organizations tab to adjust individual plans."
  />
);

export default AdminBillingPage;
