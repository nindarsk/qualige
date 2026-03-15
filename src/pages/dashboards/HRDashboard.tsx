import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlusCircle, CreditCard, FileStack } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const HRDashboard = () => {
  const { organizationName, fullName, signOut, user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { title: t("nav.dashboard"), path: "/hr", icon: LayoutDashboard },
    { title: t("nav.createCourse"), path: "/hr/upload", icon: PlusCircle },
    { title: t("nav.courses"), path: "/hr/courses", icon: BookOpen },
    { title: t("nav.templates"), path: "/hr/templates", icon: FileStack },
    { title: t("nav.employees"), path: "/hr/employees", icon: Users },
    { title: t("nav.reports"), path: "/hr/reports", icon: BarChart3 },
    { title: t("nav.billing"), path: "/hr/billing", icon: CreditCard },
    { title: t("nav.settings"), path: "/hr/settings", icon: Settings },
  ];

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "HR";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-background transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-6">
          <Link to="/hr" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold text-foreground">Quali</span>
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign Out */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{organizationName || "Organization"}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default HRDashboard;
