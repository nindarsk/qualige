import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RegisterPage = () => {
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: "Please agree to the terms", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Create organization
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .insert({ name: companyName })
          .select()
          .single();

        if (orgError) throw orgError;

        // 3. Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            organization_id: orgData.id,
            full_name: fullName,
          });

        if (profileError) throw profileError;

        // 4. Assign HR Admin role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "hr_admin",
          });

        if (roleError) throw roleError;

        toast({
          title: "Registration successful!",
          description: "Please check your email to verify your account.",
        });
        navigate("/verify-email");
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 gradient-navy lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary-foreground">Quali</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground">
            Transform your organization's training
          </h2>
          <p className="text-primary-foreground/70">
            Set up your organization in minutes and start creating AI-powered training courses for your team.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-accent" />
              <span className="text-xl font-bold text-primary">Quali</span>
            </Link>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Register Your Organization</h1>
          <p className="mb-8 text-muted-foreground">Create an account to get started with Quali</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Financial Corp" required />
            </div>
            <div>
              <Label htmlFor="fullName">HR Admin Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
            </div>
            <div>
              <Label htmlFor="email">Work Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(c) => setAgreedToTerms(c === true)} />
              <Label htmlFor="terms" className="text-sm leading-tight text-muted-foreground">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Organization
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
