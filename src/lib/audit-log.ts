import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "USER_LOGIN"
  | "COURSE_CREATED"
  | "COURSE_PUBLISHED"
  | "COURSE_ASSIGNED"
  | "COURSE_STARTED"
  | "COURSE_COMPLETED"
  | "QUIZ_PASSED"
  | "QUIZ_FAILED"
  | "CERTIFICATE_DOWNLOADED"
  | "EMPLOYEE_INVITED"
  | "EMPLOYEE_ACTIVATED";

interface LogParams {
  action: AuditAction;
  details: string;
}

export async function logAuditEvent({ action, details }: LogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    await supabase.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      user_name: profile.full_name || user.email || "Unknown",
      user_role: roleData?.[0]?.role || "unknown",
      action,
      details,
    } as any);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
