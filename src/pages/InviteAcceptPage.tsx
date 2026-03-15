import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, Check, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation, Trans } from "react-i18next";
import { usePageTitle } from "@/hooks/use-page-title";

const InviteAcceptPage = () => {
  usePageTitle("Accept Invitation");
  const { t } = useTranslation();

  const passwordRequirements = [
    { label: t("auth.passwordRequirements.minLength"), test: (v: string) => v.length >= 8 },
    { label: t("auth.passwordRequirements.uppercase"), test: (v: string) => /[A-Z]/.test(v) },
    { label: t("auth.passwordRequirements.number"), test: (v: string) => /[0-9]/.test(v) },
    { label: t("auth.passwordRequirements.special"), test: (v: string) => /[!@#$%^&)*]/.test(v) },
  ];

  const setupSchema = z
    .object({
      fullName: z.string().trim().min(1, t("common.required")).max(200),
      password: z.string().min(1, t("common.required")).min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[!@#$%^&)*]/),
      confirmPassword: z.string().min(1, t("common.required")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

  type SetupForm = z.infer<typeof setupSchema>;

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: "", password: "", confirmPassword: "" },
  });

  const password = watch("password", "");
  const confirmPassword = watch("confirmPassword", "");

  useEffect(() => {
    const handleInviteToken = async () => {
      try {
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (tokenHash && (type === "invite" || type === "magiclink" || type === "email")) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === "invite" ? "invite" : type === "magiclink" ? "magiclink" : "email",
          });
          if (error) {
            setErrorMessage(error.message?.includes("expired") ? t("invite.inviteLinkExpired") : t("invite.inviteLinkInvalid"));
            setTokenValid(false);
            setPageLoading(false);
            return;
          }
          if (data?.session) { await setupFromSession(data.session); return; }
        }

        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) { setErrorMessage(t("invite.inviteLinkInvalid")); setTokenValid(false); setPageLoading(false); return; }
            if (data?.session) { window.history.replaceState(null, "", window.location.pathname + window.location.search); await setupFromSession(data.session); return; }
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) { await setupFromSession(session); return; }

        setErrorMessage(t("invite.inviteLinkInvalid"));
        setTokenValid(false);
      } catch (err) {
        setErrorMessage(t("invite.inviteLinkInvalid"));
        setTokenValid(false);
      } finally {
        setPageLoading(false);
      }
    };

    const setupFromSession = async (session: any) => {
      const user = session.user;
      setUserEmail(user.email || "");
      setTokenValid(true);
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || "";
      const orgId = meta.organization_id || "";
      setInviteFullName(fullName);
      if (fullName) setValue("fullName", fullName);
      if (orgId) {
        const { data: orgData } = await supabase.from("organizations").select("name").eq("id", orgId).single();
        if (orgData) setOrgName(orgData.name);
      }
    };

    handleInviteToken();
  }, [setValue, searchParams, t]);

  const onSubmit = async (data: SetupForm) => {
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: data.password, data: { full_name: data.fullName } });
      if (updateError) throw updateError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session lost");

      const user = session.user;
      const meta = user.user_metadata || {};
      const orgId = meta.organization_id;

      const { data: existingProfile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingProfile && orgId) {
        await supabase.from("profiles").insert({ user_id: user.id, full_name: data.fullName, organization_id: orgId });
      } else if (existingProfile) {
        await supabase.from("profiles").update({ full_name: data.fullName, organization_id: orgId }).eq("user_id", user.id);
      }

      const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingRole) { await supabase.from("user_roles").insert({ user_id: user.id, role: "employee" as any }); }

      if (orgId) {
        const { data: existingEmployee } = await supabase.from("employees").select("id").eq("email", user.email!).eq("organization_id", orgId).maybeSingle();
        if (existingEmployee) {
          await supabase.from("employees").update({ user_id: user.id, status: "active", joined_at: new Date().toISOString() }).eq("email", user.email!).eq("organization_id", orgId);
        } else {
          await supabase.from("employees").insert({ email: user.email!, full_name: data.fullName, organization_id: orgId, user_id: user.id, status: "active", joined_at: new Date().toISOString() });
        }
      }

      setSetupComplete(true);
      setTimeout(() => navigate("/employee"), 2000);
    } catch (error: any) {
      toast({ title: t("auth.registrationFailed"), description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor} className="text-[13px] font-medium leading-none text-foreground">
      {children} <span className="text-destructive">*</span>
    </label>
  );

  const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-[13px] text-destructive mt-1">{message}</p> : null;

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">{t("invite.processingInvitation")}</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-foreground">{t("invite.invalidInvitation")}</h1>
          <p className="text-sm text-muted-foreground">{errorMessage || t("invite.inviteLinkInvalid")}</p>
        </div>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))]">
            <CheckCircle2 className="h-6 w-6 text-[hsl(var(--status-success))]" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-foreground">{t("invite.accountCreated")}</h1>
          <p className="text-foreground mb-1">{t("invite.welcomeRedirect")}</p>
          <p className="text-sm text-muted-foreground">{t("invite.redirecting")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Quali</span>
        </div>

        <h1 className="mb-1 text-2xl font-semibold text-foreground">{t("invite.welcomeToQuali")}</h1>
        {orgName ? (
          <p className="mb-8 text-sm text-muted-foreground">
            <Trans i18nKey="invite.invitedBy" values={{ orgName }}>
              You have been invited by <strong>{{ orgName } as any}</strong> to complete your training.
            </Trans>
          </p>
        ) : (
          <p className="mb-8 text-sm text-muted-foreground">{t("invite.setUpAccount")}</p>
        )}

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
            <Input id="email" type="email" value={userEmail} readOnly className="bg-surface" />
          </div>

          <div data-error={!!errors.fullName} className="space-y-1.5">
            <FieldLabel htmlFor="fullName">{t("employees.fullName")}</FieldLabel>
            <Input id="fullName" placeholder={t("employees.fullName")} className={cn(errors.fullName && "border-destructive")} {...register("fullName")} />
            <FieldError message={errors.fullName?.message} />
          </div>

          <div data-error={!!errors.password} className="space-y-1.5">
            <FieldLabel htmlFor="password">{t("invite.createPassword")}</FieldLabel>
            <Input id="password" type="password" placeholder={t("auth.password")} className={cn(errors.password && "border-destructive")} {...register("password")} />
            <FieldError message={errors.password?.message} />
            <ul className="mt-2 space-y-1">
              {passwordRequirements.map((req) => {
                const met = req.test(password);
                return (
                  <li key={req.label} className={cn("flex items-center gap-2 text-xs", met ? "text-[hsl(var(--status-success))]" : "text-muted-foreground")}>
                    {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {req.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div data-error={!!errors.confirmPassword} className="space-y-1.5">
            <FieldLabel htmlFor="confirmPassword">{t("auth.confirmPassword")}</FieldLabel>
            <div className="relative">
              <Input id="confirmPassword" type="password" placeholder={t("auth.confirmPassword")} className={cn(errors.confirmPassword && "border-destructive", passwordsMatch && "border-[hsl(var(--status-success))]", "pr-10")} {...register("confirmPassword")} />
              {confirmPassword.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {passwordsMatch ? <Check className="h-4 w-4 text-[hsl(var(--status-success))]" /> : <X className="h-4 w-4 text-destructive" />}
                </span>
              )}
            </div>
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("invite.setupMyAccount")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
