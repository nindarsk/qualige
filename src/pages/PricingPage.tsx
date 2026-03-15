import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import RequestDemoModal from "@/components/RequestDemoModal";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { usePageTitle } from "@/hooks/use-page-title";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 149,
    annualPrice: 1490,
    maxUsers: 50,
    maxCourses: "10",
    popular: false,
    featureKeys: [
      "AI course generation",
      "Quizzes & assessments",
      "Certificates",
      "Up to 10 courses",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthlyPrice: 349,
    annualPrice: 3490,
    maxUsers: 200,
    maxCourses: "Unlimited",
    popular: true,
    featureKeys: [
      "Everything in Starter",
      "Unlimited courses",
      "Compliance reports",
      "Audit logs",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    monthlyPrice: 699,
    annualPrice: 6990,
    maxUsers: 500,
    maxCourses: "Unlimited",
    popular: false,
    featureKeys: [
      "Everything in Growth",
      "Custom branding",
      "2FA enforcement",
      "Dedicated onboarding",
      "API access",
    ],
  },
];

const PricingPage = () => {
  usePageTitle("Plans & Pricing");
  const [annual, setAnnual] = useState(false);
  const { session } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold text-foreground">Quali</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {session ? (
              <Button size="sm" asChild>
                <Link to="/hr">{t("nav.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">{t("nav.signIn")}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">{t("nav.getStarted")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-16">
        <div className="container text-center">
          <h1 className="mb-3 text-3xl font-semibold text-foreground">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-muted-foreground">
            {t("pricing.subtitle")}
          </p>

          <div className="flex items-center justify-center gap-3 mb-12">
            <Label htmlFor="billing-toggle" className={cn("text-sm", !annual && "text-foreground font-medium")}>
              {t("pricing.monthly")}
            </Label>
            <Switch id="billing-toggle" checked={annual} onCheckedChange={setAnnual} />
            <Label htmlFor="billing-toggle" className={cn("text-sm", annual && "text-foreground font-medium")}>
              {t("pricing.annual")}
            </Label>
            {annual && (
              <span className="ml-2 rounded px-2 py-0.5 text-xs font-medium border border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]">
                {t("pricing.save20")}
              </span>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative flex flex-col",
                  plan.popular && "border-primary"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded px-3 py-0.5 text-xs font-medium bg-primary text-primary-foreground">
                    {t("pricing.mostPopular")}
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg text-foreground">{plan.name}</CardTitle>
                  <CardDescription>{t("pricing.upToEmployees", { count: plan.maxUsers })}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-center">
                  <div className="mb-6">
                    <span className="text-3xl font-semibold text-foreground">
                      ${annual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground text-sm">{t("pricing.perMonth")}</span>
                    {annual && (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        ${plan.annualPrice.toLocaleString()}{t("pricing.perYear")}
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.featureKeys.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    {t("pricing.requestDemo")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface py-8 mt-12">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Quali</span>
          </div>
          <p>© 2026 Quali. All rights reserved.</p>
        </div>
      </footer>

      <RequestDemoModal
        open={!!selectedPlan}
        onOpenChange={(open) => !open && setSelectedPlan(null)}
        planName={selectedPlan || ""}
        billingCycle={annual ? "annual" : "monthly"}
      />
    </div>
  );
};

export default PricingPage;
