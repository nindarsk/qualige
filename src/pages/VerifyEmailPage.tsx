import { Link } from "react-router-dom";
import { BookOpen, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/use-page-title";

const VerifyEmailPage = () => {
  usePageTitle("Verify Email");
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-border p-3">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">{t("auth.checkYourEmail")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{t("auth.verifyEmailSent")}</p>
        <Button variant="outline" asChild>
          <Link to="/login">{t("auth.backToSignIn")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
