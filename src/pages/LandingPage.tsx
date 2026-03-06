import { Link, Navigate } from "react-router-dom";
import { BookOpen, ShieldCheck, Award, ArrowRight, Sparkles, Upload, Brain, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";


const LandingPage = () => {
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
    { icon: Award, title: t("landing.features.instantCertificates"), description: t("landing.features.instantCertificatesDesc") },
  ];

  const steps = [
    { icon: Upload, step: "01", title: t("landing.steps.uploadDoc"), description: t("landing.steps.uploadDocDesc") },
    { icon: Brain, step: "02", title: t("landing.steps.aiGenerates"), description: t("landing.steps.aiGeneratesDesc") },
    { icon: Users, step: "03", title: t("landing.steps.assignTrack"), description: t("landing.steps.assignTrackDesc") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-accent" />
            <span className="text-xl font-bold text-primary">Quali</span>
          </Link>
          <div className="flex items-center gap-3">
            
            <Button variant="ghost" asChild>
              <Link to="/pricing">{t("nav.pricing")}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/login">{t("nav.signIn")}</Link>
            </Button>
            <Button asChild className="gradient-gold border-0 text-accent-foreground hover:opacity-90">
              <Link to="/register">{t("nav.getStarted")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 gradient-navy opacity-95" />
        <div className="relative container flex min-h-[600px] flex-col items-center justify-center py-24 text-center">
          <div className="animate-fade-in max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
              <Sparkles className="h-4 w-4" />
              {t("landing.aiPoweredPlatform")}
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mb-8 text-lg text-primary-foreground/80 md:text-xl">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="gradient-gold border-0 px-8 text-lg text-accent-foreground hover:opacity-90">
                <Link to="/register">
                  {t("landing.requestDemo")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <a href="#features">{t("landing.learnMore")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              {t("landing.everythingYouNeed")}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("landing.everythingDesc")}
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group rounded-xl border border-border bg-card p-8 transition-all hover:border-accent/50 hover:shadow-lg"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="mb-5 inline-flex rounded-lg bg-accent/10 p-3">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-card-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">{t("landing.howItWorks")}</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">{t("landing.howItWorksDesc")}</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  {step.step}
                </div>
                <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-3">
                  <step.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-8 hidden -translate-x-1/2 md:block">
                    <ArrowRight className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gradient-navy py-20">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">{t("landing.readyToTransform")}</h2>
          <p className="mx-auto mb-8 max-w-xl text-primary-foreground/70">{t("landing.readyToTransformDesc")}</p>
          <Button size="lg" asChild className="gradient-gold border-0 px-8 text-lg text-accent-foreground hover:opacity-90">
            <Link to="/register">
              {t("landing.startFreeTrial")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <span className="font-semibold text-foreground">Quali</span>
          </div>
          <p className="text-center">{t("landing.builtForGeorgian")}</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">{t("nav.signIn")}</Link>
            <p>© 2026 Quali. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
