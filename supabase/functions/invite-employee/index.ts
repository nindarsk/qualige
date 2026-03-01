import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the calling user
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

    // Verify HR admin role
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

    // Get organization info
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

    if (!fullName || !email) {
      return new Response(JSON.stringify({ error: "Name and email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check if employee already exists in this org
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

    // If resending for an existing employee, generate a new magic link and return
    if (existing && resend) {
      const orgName = org?.name || "your organization";
      
      // Try inviteUserByEmail first; if user already registered, use generateLink as fallback
      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          company_name: orgName,
          invited_by: user.id,
          organization_id: profile.organization_id,
          role: "employee",
        },
        redirectTo: `${req.headers.get("origin") || supabaseUrl}/invite/accept`,
      });

      if (resendError) {
        if (resendError.message?.includes("already been registered")) {
          // User already exists in auth — generate a magic link instead
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: {
              redirectTo: `${req.headers.get("origin") || supabaseUrl}/invite/accept`,
            },
          });

          if (linkError) {
            console.error("Generate link error:", linkError);
            return new Response(JSON.stringify({ error: "Failed to resend invitation: " + linkError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ employee: existing, message: "Invitation resent via magic link." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.error("Resend invite error:", resendError);
        return new Response(JSON.stringify({ error: "Failed to resend invitation: " + resendError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ employee: existing, message: "Invitation resent." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite via Supabase Auth
    const orgName = org?.name || "your organization";
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        company_name: orgName,
        invited_by: user.id,
        organization_id: profile.organization_id,
        role: "employee",
      },
      redirectTo: `${req.headers.get("origin") || supabaseUrl}/invite/accept`,
    });

    if (inviteError) {
      // If user already registered, still allow creating the employee record
      if (inviteError.message?.includes("already been registered")) {
        // Look up the existing auth user
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = usersData?.users?.find(u => u.email === email);
        
        if (existing) {
          // Resend case — just return success
          return new Response(JSON.stringify({ employee: existing, message: "User already exists, invitation noted." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Send a magic link so the user must re-authenticate
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: `${req.headers.get("origin") || supabaseUrl}/invite/accept`,
          },
        });

        // Create employee record as PENDING — they must click the link to activate
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
          return new Response(JSON.stringify({ error: empError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ employee }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("Invite error:", inviteError);
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create employee record
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .insert({
        organization_id: profile.organization_id,
        user_id: inviteData.user?.id || null,
        full_name: fullName,
        email,
        department: department || null,
        status: "pending",
      })
      .select()
      .single();

    if (empError) {
      console.error("Employee insert error:", empError);
      return new Response(JSON.stringify({ error: empError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ employee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
