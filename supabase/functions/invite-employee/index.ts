import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInput(body: { fullName?: string; email?: string; department?: string }) {
  if (!body.fullName || typeof body.fullName !== "string" || body.fullName.trim().length === 0) {
    throw new Error("Name is required");
  }
  if (body.fullName.length > 100) throw new Error("Name must be less than 100 characters");
  if (!body.email || typeof body.email !== "string") throw new Error("Email is required");
  if (!EMAIL_REGEX.test(body.email)) throw new Error("Invalid email format");
  if (body.email.length > 255) throw new Error("Email must be less than 255 characters");
  if (body.department && typeof body.department === "string" && body.department.length > 100) {
    throw new Error("Department must be less than 100 characters");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "hr_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single();

    const body = await req.json();
    const { fullName, email, department, resend } = body;

    // Input validation
    validateInput({ fullName, email, department });

    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("email", email)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (existing && !resend) {
      return new Response(JSON.stringify({ error: "Employee with this email already exists" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing && resend) {
      const orgName = org?.name || "your organization";
      
      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          company_name: orgName,
          invited_by: user.id,
          organization_id: profile.organization_id,
          role: "employee",
        },
        redirectTo: "https://qualige.lovable.app/invite/accept",
      });

      if (resendError) {
        if (resendError.message?.includes("already been registered")) {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuthUser = usersData?.users?.find(u => u.email === email);
          
          if (existingAuthUser) {
            await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
          }

          const { error: reInviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
              full_name: fullName,
              company_name: orgName,
              invited_by: user.id,
              organization_id: profile.organization_id,
              role: "employee",
            },
            redirectTo: "https://qualige.lovable.app/invite/accept",
          });

          if (reInviteError) {
            console.error("Re-invite error:", reInviteError);
            return new Response(JSON.stringify({ error: "Failed to resend invitation. Please try again." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          await supabaseAdmin
            .from("employees")
            .update({ user_id: null, status: "pending", joined_at: null })
            .eq("id", existing.id);

          return new Response(JSON.stringify({ employee: existing, message: "Invitation resent." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.error("Resend invite error:", resendError);
        return new Response(JSON.stringify({ error: "Failed to resend invitation. Please try again." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ employee: existing, message: "Invitation resent." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgName = org?.name || "your organization";
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .insert({
        organization_id: profile.organization_id,
        user_id: null,
        full_name: fullName,
        email,
        department: department || null,
        status: "pending",
      })
      .select()
      .single();

    if (empError) {
      console.error("Employee insert error:", empError);
      return new Response(JSON.stringify({ error: "Failed to create employee record. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        company_name: orgName,
        invited_by: user.id,
        organization_id: profile.organization_id,
        role: "employee",
      },
      redirectTo: "https://qualige.lovable.app/invite/accept",
    });

    if (inviteError) {
      if (inviteError.message?.includes("already been registered")) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = usersData?.users?.find(u => u.email === email);
        
        if (existingAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
        }

        const { error: reInviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            full_name: fullName,
            company_name: orgName,
            invited_by: user.id,
            organization_id: profile.organization_id,
            role: "employee",
          },
          redirectTo: "https://qualige.lovable.app/invite/accept",
        });

        if (reInviteError) {
          console.error("Re-invite error:", reInviteError);
          await supabaseAdmin.from("employees").delete().eq("id", employee.id);
          return new Response(JSON.stringify({ error: "Failed to send invitation. Please try again." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ employee }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("Invite error:", inviteError);
      await supabaseAdmin.from("employees").delete().eq("id", employee.id);
      return new Response(JSON.stringify({ error: "Failed to send invitation. Please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ employee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});