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

const plans = [
  {
    name: "Starter",
    monthlyPrice: 149,
    annualPrice: 1490,
    maxUsers: 50,
    maxCourses: "10",
    popular: false,
    features: [
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
    features: [
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
    features: [
      "Everything in Growth",
      "Custom branding",
      "2FA enforcement",
      "Dedicated onboarding",
      "API access",
    ],
  },
];

const PricingPage = () => {
  const [annual, setAnnual] = useState(false);
  const { session } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-accent" />
            <span className="text-xl font-bold text-primary">Quali</span>
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <Button asChild>
                <Link to="/hr">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild className="gradient-gold border-0 text-accent-foreground hover:opacity-90">
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-16">
        <div className="container text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Choose the plan that fits your organization. All plans include a 14-day free trial.
          </p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <Label htmlFor="billing-toggle" className={cn("text-sm font-medium", !annual && "text-foreground")}>
              Monthly
            </Label>
            <Switch id="billing-toggle" checked={annual} onCheckedChange={setAnnual} />
            <Label htmlFor="billing-toggle" className={cn("text-sm font-medium", annual && "text-foreground")}>
              Annual
            </Label>
            {annual && (
              <span className="ml-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                Save 20%
              </span>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative flex flex-col transition-all hover:shadow-lg",
                  plan.popular && "border-2 border-accent shadow-lg scale-[1.02]"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full gradient-gold px-4 py-1 text-xs font-bold text-accent-foreground">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl text-foreground">{plan.name}</CardTitle>
                  <CardDescription>Up to {plan.maxUsers} employees</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">
                      ${annual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                    {annual && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        ${plan.annualPrice.toLocaleString()}/year
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className={cn(
                      "w-full",
                      plan.popular
                        ? "gradient-gold border-0 text-accent-foreground hover:opacity-90"
                        : ""
                    )}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    Request Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <span className="font-semibold text-foreground">Quali</span>
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
