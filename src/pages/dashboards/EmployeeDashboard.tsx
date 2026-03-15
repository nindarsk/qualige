import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Award, UserCircle, LogOut, Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";

const EmployeeDashboard = () => {
  const { fullName, signOut } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { title: t("nav.myCourses"), path: "/employee", icon: BookOpen },
    { title: t("nav.myCertificates"), path: "/employee/certificates", icon: Award },
    { title: t("nav.profile"), path: "/employee/profile", icon: UserCircle },
  ];

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "EM";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/employee" className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold text-foreground">Quali</span>
            </Link>
            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="hidden text-sm text-muted-foreground sm:block">{fullName}</span>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-border px-4 py-2 md:hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default EmployeeDashboard;
