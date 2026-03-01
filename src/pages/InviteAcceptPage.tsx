import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const passwordRequirements = [
  { label: "Minimum 8 characters", test: (v: string) => v.length >= 8 },
  { label: "At least one uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "At least one number", test: (v: string) => /[0-9]/.test(v) },
  { label: "At least one special character (!@#$%^&)*", test: (v: string) => /[!@#$%^&)*]/.test(v) },
];

const setupSchema = z
  .object({
    fullName: z.string().trim().min(1, "This field is required").max(200),
    password: z
      .string()
      .min(1, "This field is required")
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number")
      .regex(/[!@#$%^&)*]/, "Password must contain a special character"),
    confirmPassword: z.string().min(1, "This field is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SetupForm = z.infer<typeof setupSchema>;

const InviteAcceptPage = () => {
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: "", password: "", confirmPassword: "" },
  });

  const password = watch("password", "");
  const confirmPassword = watch("confirmPassword", "");

  useEffect(() => {
    const handleInviteToken = async () => {
      try {
        // Supabase will have already exchanged the token via the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          setTokenValid(false);
          setPageLoading(false);
          return;
        }

        const user = session.user;
        setUserEmail(user.email || "");
        setTokenValid(true);

        // Extract metadata from invitation
        const meta = user.user_metadata || {};
        const fullName = meta.full_name || "";
        const orgId = meta.organization_id || "";

        setInviteFullName(fullName);
        if (fullName) setValue("fullName", fullName);

        // Fetch org name
        if (orgId) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .single();
          if (orgData) setOrgName(orgData.name);
        }
      } catch (err) {
        console.error("Error processing invite:", err);
        setTokenValid(false);
      } finally {
        setPageLoading(false);
      }
    };

    handleInviteToken();
  }, [setValue]);

  const onSubmit = async (data: SetupForm) => {
    setSubmitting(true);
    try {
      // Set the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
        data: { full_name: data.fullName },
      });

      if (updateError) throw updateError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session lost");

      const user = session.user;
      const meta = user.user_metadata || {};
      const orgId = meta.organization_id;

      // Check if profile already exists (trigger may have created one)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingProfile && orgId) {
        // Create profile linked to organization
        await supabase.from("profiles").insert({
          user_id: user.id,
          full_name: data.fullName,
          organization_id: orgId,
        });
      } else if (existingProfile) {
        // Update profile with org and name
        await supabase
          .from("profiles")
          .update({ full_name: data.fullName, organization_id: orgId })
          .eq("user_id", user.id);
      }

      // Check if employee role already exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: user.id,
          role: "employee" as any,
        });
      } else {
        // The trigger may have assigned hr_admin. We need to fix this for invited employees.
        // We can't update user_roles directly (no UPDATE policy), but the edge function handles this.
      }

      // Update employee record to active
      if (orgId) {
        await supabase
          .from("employees")
          .update({ user_id: user.id, status: "active", joined_at: new Date().toISOString() })
          .eq("email", user.email!)
          .eq("organization_id", orgId);
      }

      toast({
        title: "Account set up successfully!",
        description: "Welcome to Quali. Let's get started with your training.",
      });

      navigate("/employee");
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children} <span className="text-destructive">*</span>
    </label>
  );

  const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-sm text-destructive mt-1">{message}</p> : null;

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Processing your invitation...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-foreground">Invalid Invitation</h1>
          <p className="text-muted-foreground">
            This invitation link is invalid or has expired. Please contact your HR manager for a new invitation.
          </p>
        </div>
      </div>
    );
  }

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
            Welcome to your training platform
          </h2>
          <p className="text-primary-foreground/70">
            Set up your account to access your assigned courses, track your progress, and earn certificates.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <BookOpen className="h-7 w-7 text-accent" />
            <span className="text-xl font-bold text-primary">Quali</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">Welcome to Quali.ge</h1>
          {orgName ? (
            <p className="mb-8 text-muted-foreground">
              You have been invited by <span className="font-semibold text-foreground">{orgName}</span> to complete your training.
            </p>
          ) : (
            <p className="mb-8 text-muted-foreground">Set up your account to get started.</p>
          )}

          <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" value={userEmail} readOnly className="bg-muted" />
            </div>

            {/* Full Name */}
            <div data-error={!!errors.fullName}>
              <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
              <Input
                id="fullName"
                placeholder="Your full name"
                className={cn(errors.fullName && "border-destructive focus-visible:ring-destructive")}
                {...register("fullName")}
              />
              <FieldError message={errors.fullName?.message} />
            </div>

            {/* Password */}
            <div data-error={!!errors.password}>
              <FieldLabel htmlFor="password">Create Your Password</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className={cn(errors.password && "border-destructive focus-visible:ring-destructive")}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Up My Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
