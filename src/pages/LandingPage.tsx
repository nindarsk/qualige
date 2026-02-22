import { Link } from "react-router-dom";
import { BookOpen, ShieldCheck, Award, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Sparkles,
    title: "AI Course Generation",
    description: "Upload any document — policies, manuals, regulations — and let AI transform it into interactive training courses in minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Tracking",
    description: "Stay audit-ready with automated compliance tracking, deadline alerts, and real-time completion dashboards.",
  },
  {
    icon: Award,
    title: "Instant Certificates",
    description: "Generate branded, verifiable certificates the moment employees complete their courses.",
  },
];

const LandingPage = () => {
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
            <Button variant="ghost" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="gradient-gold border-0 text-accent-foreground hover:opacity-90">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 gradient-navy opacity-80" />
        <div className="relative container flex min-h-[600px] flex-col items-center justify-center py-24 text-center">
          <div className="animate-fade-in max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
              <Sparkles className="h-4 w-4" />
              AI-Powered Learning Platform
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
              Turn Any Document Into a Training Course in Minutes
            </h1>
            <p className="mb-8 text-lg text-primary-foreground/80 md:text-xl">
              AI-powered LMS built for financial institutions. Simplify compliance training, accelerate onboarding, and certify your workforce — all in one platform.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="gradient-gold border-0 px-8 text-lg text-accent-foreground hover:opacity-90">
                <Link to="/register">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Everything Your Institution Needs
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              From AI-generated courses to compliance tracking and certification — Quali handles it all.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-8 transition-all hover:border-accent/50 hover:shadow-lg"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="mb-5 inline-flex rounded-lg bg-accent/10 p-3">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-navy py-20">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
            Ready to Transform Your Training?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-primary-foreground/70">
            Join forward-thinking financial institutions already using Quali to streamline compliance and employee development.
          </p>
          <Button size="lg" asChild className="gradient-gold border-0 px-8 text-lg text-accent-foreground hover:opacity-90">
            <Link to="/register">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <span className="font-semibold text-foreground">Quali</span>
          </div>
          <p>© 2026 Quali. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
