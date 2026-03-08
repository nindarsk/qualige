import DashboardPlaceholder from "@/components/DashboardPlaceholder";
import { usePageTitle } from "@/hooks/use-page-title";

const AdminSettingsPage = () => {
  usePageTitle("Settings | Super Admin");
  return (
  <DashboardPlaceholder
    title="Platform Settings"
    description="Platform-wide configuration and feature flags."
  />
);

export default AdminSettingsPage;
