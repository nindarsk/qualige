import { Link, Navigate } from "react-router-dom";
import { BookOpen, ShieldCheck, Award, ArrowRight, Sparkles, Upload, Brain, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { usePageTitle } from "@/hooks/use-page-title";

const LandingPage = () => {
  usePageTitle("AI Learning Management System for Banks");
  const { session, role, loading } = useAuth();
  const { t } = useTranslation();

  if (!loading && session && role) {
    if (role === "employee") return <Navigate to="/employee" replace />;
    if (role === "hr_admin") return <Navigate to="/hr" replace />;
    if (role === "super_admin") return <Navigate to="/admin" replace />;
  }

  const features = [
  { icon: Sparkles, title: t("landing.features.aiCourseGen"), description: t("landing.features.aiCourseGenDesc") },
  { icon: ShieldCheck, title: t("landing.features.complianceTracking"), description: t("landing.features.complianceTrackingDesc") },
  { icon: Award, title: t("landing.features.instantCertificates"), description: t("landing.features.instantCertificatesDesc") }];


  const steps = [
  { icon: Upload, step: "01", title: t("landing.steps.uploadDoc"), description: t("landing.steps.uploadDocDesc") },
  { icon: Brain, step: "02", title: t("landing.steps.aiGenerates"), description: t("landing.steps.aiGeneratesDesc") },
  { icon: Users, step: "03", title: t("landing.steps.assignTrack"), description: t("landing.steps.assignTrackDesc") }];


  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold text-foreground">Quali</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pricing">{t("nav.pricing")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">{t("nav.signIn")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">{t("nav.getStarted")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-14">
        <div className="container flex min-h-[520px] flex-col items-center justify-center py-24 text-center">
          <div className="animate-fade-in max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[13px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {t("landing.aiPoweredPlatform")}
            </div>
            <h1 className="mb-6 font-bold leading-[1.1] tracking-[-0.03em] text-foreground text-3xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mb-8 text-xl leading-relaxed text-muted-foreground max-w-[560px] mx-auto">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link to="/register">
                  {t("landing.requestDemo")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">{t("landing.learnMore")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">
              {t("landing.everythingYouNeed")}
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              {t("landing.everythingDesc")}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, i) =>
            <div
              key={i}
              className="rounded-[10px] border border-border bg-background p-6 transition-colors duration-150 hover:border-muted-foreground/30">
              
                <div className="mb-4 inline-flex rounded-lg border border-border p-2.5">
                  <feature.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-[15px] font-medium text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">{t("landing.howItWorks")}</h2>
            <p className="mx-auto max-w-lg text-muted-foreground">{t("landing.howItWorksDesc")}</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) =>
            <div key={step.step} className="relative text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border text-sm font-semibold text-foreground">
                  {step.step}
                </div>
                <div className="mb-3 inline-flex rounded-lg border border-border p-2.5">
                  <step.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-[15px] font-medium text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                {i < steps.length - 1 &&
              <div className="absolute right-0 top-6 hidden -translate-x-1/2 md:block">
                    <ArrowRight className="h-4 w-4 text-border" />
                  </div>
              }
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="container text-center">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">{t("landing.readyToTransform")}</h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">{t("landing.readyToTransformDesc")}</p>
          <Button size="lg" asChild>
            <Link to="/register">
              {t("landing.startFreeTrial")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Quali</span>
          </div>
          <p className="text-center">{t("landing.builtForGeorgian")}</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">{t("nav.signIn")}</Link>
            <p>© 2026 Quali. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>);

};

export default LandingPage;