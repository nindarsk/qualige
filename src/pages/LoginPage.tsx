import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-log";
import { useTranslation } from "react-i18next";
import TwoFactorVerify from "@/components/TwoFactorVerify";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      logAuditEvent({ action: "USER_LOGIN", details: "User logged in" });

      if (roleData?.role === "hr_admin") navigate("/hr");
      else if (roleData?.role === "employee") navigate("/employee");
      else if (roleData?.role === "super_admin") navigate("/admin");
      else navigate("/");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if MFA is required
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factors?.totp?.filter(f => f.status === 'verified') || [];

      if (verifiedFactors.length > 0) {
        // Show 2FA verification screen
        setMfaFactorId(verifiedFactors[0].id);
        setLoading(false);
        return;
      }

      await redirectByRole();
    } catch (error: any) {
      toast({
        title: t("auth.loginFailed"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (mfaFactorId) {
    return (
      <TwoFactorVerify
        factorId={mfaFactorId}
        onVerified={redirectByRole}
      />
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 gradient-navy lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary-foreground">Quali</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground">
            {t("auth.welcomeBack")}
          </h2>
          <p className="text-primary-foreground/70">
            {t("auth.signInToAccess")}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-accent" />
              <span className="text-xl font-bold text-primary">Quali</span>
            </Link>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">{t("auth.signIn")}</h1>
          <p className="mb-8 text-muted-foreground">{t("auth.enterCredentials")}</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" required />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("auth.signIn")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t("auth.registerOrg")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
