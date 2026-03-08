import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  console.log("1. send-email function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (user) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["hr_admin", "super_admin"]);

      if (!roleData || roleData.length === 0) {
        return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    console.log("2. RESEND_API_KEY exists:", !!resendKey);

    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, html_body } = await req.json();
    console.log("3. Sending to:", to);
    console.log("4. Subject:", subject);

    if (!to || !subject || !html_body) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use onboarding@resend.dev as default until custom domain is verified in Resend
    const fromAddress = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";

    // Resend sandbox mode: can only send to the account owner's email
    const sandboxEmail = "nindarsk@gmail.com";
    const isVerifiedDomain = fromAddress !== "onboarding@resend.dev";
    const actualTo = isVerifiedDomain ? to : sandboxEmail;
    if (!isVerifiedDomain && to !== sandboxEmail) {
      console.log(`Resend sandbox mode: redirecting email from ${to} to ${sandboxEmail}`);
    }
    console.log("5. From address:", fromAddress);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [actualTo],
        subject: isVerifiedDomain ? subject : `[To: ${to}] ${subject}`,
        html: html_body,
      }),
    });

    const resendResponse = await res.json();
    console.log("6. Resend API response:", JSON.stringify(resendResponse));

    if (!res.ok) {
      console.error("Resend error:", resendResponse);
      return new Response(JSON.stringify({ error: resendResponse.message || "Email send failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("7. Email sent successfully, id:", resendResponse.id);

    return new Response(JSON.stringify({ success: true, id: resendResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send email error:", err);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
