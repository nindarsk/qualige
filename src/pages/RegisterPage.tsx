import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const passwordRequirements = [
  { label: "Minimum 8 characters", test: (v: string) => v.length >= 8 },
  { label: "At least one uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "At least one number", test: (v: string) => /[0-9]/.test(v) },
  { label: "At least one special character (!@#$%^&)*", test: (v: string) => /[!@#$%^&)*]/.test(v) },
];

const registerSchema = z
  .object({
    companyName: z.string().trim().min(1, "This field is required").max(200),
    fullName: z.string().trim().min(1, "This field is required").max(200),
    email: z.string().trim().min(1, "This field is required").email("Please enter a valid email address").max(255),
    password: z
      .string()
      .min(1, "This field is required")
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[!@#$%^&)*]/, "Password must contain a special character"),
    confirmPassword: z.string().min(1, "This field is required"),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: false as any,
    },
  });

  const password = watch("password", "");
  const confirmPassword = watch("confirmPassword", "");

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: data.fullName,
            company_name: data.companyName,
          },
        },
      });

      if (authError) throw authError;

      // Organization, profile, and role are created automatically via database trigger
      toast({
        title: "Registration successful!",
        description: "Please check your email to verify your account.",
      });
      navigate("/verify-email");
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

  const onError = () => {
    // Scroll to first error
    const firstError = formRef.current?.querySelector('[data-error="true"]');
    firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children} <span className="text-destructive">*</span>
    </label>
  );

  const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-sm text-destructive mt-1">{message}</p> : null;

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

          <form ref={formRef} onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4">
            {/* Company Name */}
            <div data-error={!!errors.companyName}>
              <FieldLabel htmlFor="companyName">Company Name</FieldLabel>
              <Input
                id="companyName"
                placeholder="Acme Financial Corp"
                className={cn(errors.companyName && "border-destructive focus-visible:ring-destructive")}
                {...register("companyName")}
              />
              <FieldError message={errors.companyName?.message} />
            </div>

            {/* Full Name */}
            <div data-error={!!errors.fullName}>
              <FieldLabel htmlFor="fullName">HR Admin Full Name</FieldLabel>
              <Input
                id="fullName"
                placeholder="Jane Doe"
                className={cn(errors.fullName && "border-destructive focus-visible:ring-destructive")}
                {...register("fullName")}
              />
              <FieldError message={errors.fullName?.message} />
            </div>

            {/* Email */}
            <div data-error={!!errors.email}>
              <FieldLabel htmlFor="email">Work Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="jane@acme.com"
                className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>

            {/* Password */}
            <div data-error={!!errors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className={cn(errors.password && "border-destructive focus-visible:ring-destructive")}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
              {/* Password requirements checklist */}
              <ul className="mt-2 space-y-1">
                {passwordRequirements.map((req) => {
                  const met = req.test(password);
                  return (
                    <li key={req.label} className={cn("flex items-center gap-2 text-xs", met ? "text-green-600" : "text-muted-foreground")}>
                      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {req.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Confirm Password */}
            <div data-error={!!errors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  className={cn(
                    errors.confirmPassword && "border-destructive focus-visible:ring-destructive",
                    passwordsMatch && "border-green-500 focus-visible:ring-green-500",
                    "pr-10"
                  )}
                  {...register("confirmPassword")}
                />
                {confirmPassword.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </span>
                )}
              </div>
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            {/* Terms */}
            <div data-error={!!errors.agreedToTerms}>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  onCheckedChange={(c) => setValue("agreedToTerms", c === true ? true : false as any, { shouldValidate: true })}
                />
                <label htmlFor="terms" className="text-sm leading-tight text-muted-foreground">
                  I agree to the Terms of Service and Privacy Policy <span className="text-destructive">*</span>
                </label>
              </div>
              <FieldError message={errors.agreedToTerms?.message} />
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
