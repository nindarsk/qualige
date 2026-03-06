import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DemoRequestPayload {
  type: "demo_request" | "plan_change";
  fullName: string;
  organizationName: string;
  email: string;
  phone?: string;
  message?: string;
  planName?: string;
  billingCycle?: string;
  currentPlan?: string;
  requestedAction?: string;
}

function sanitize(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" };
    return map[c] || c;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: DemoRequestPayload = await req.json();

    // Validate required fields
    if (!payload.fullName?.trim() || !payload.organizationName?.trim() || !payload.email?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Length limits
    if (payload.fullName.length > 200 || payload.organizationName.length > 200 || payload.email.length > 255) {
      return new Response(JSON.stringify({ error: "Field too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const founderEmail = Deno.env.get("FOUNDER_EMAIL");
    if (!founderEmail) {
      console.error("FOUNDER_EMAIL secret not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = new Date().toISOString();
    let subject: string;
    let body: string;

    if (payload.type === "demo_request") {
      subject = `New Demo Request — ${sanitize(payload.planName || "Unknown")} Plan — ${sanitize(payload.organizationName)} — Quali.ge`;
      body = `
        <h2>New Demo Request</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Plan</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.planName || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Billing Cycle</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.billingCycle || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Full Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.fullName)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Organization</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.organizationName)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Work Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.email)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.phone || "Not provided")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.message || "No message")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Timestamp</td><td style="padding:8px;">${timestamp}</td></tr>
        </table>
      `;
    } else {
      subject = `Plan Change Request — ${sanitize(payload.organizationName)} — ${sanitize(payload.requestedAction || "Unknown")} — Quali.ge`;
      body = `
        <h2>Plan Change Request</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Organization</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.organizationName)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Current Plan</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.currentPlan || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Requested Action</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.requestedAction || "N/A")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">HR Admin Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.fullName)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">HR Admin Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.email)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${sanitize(payload.message || "No additional notes")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Timestamp</td><td style="padding:8px;">${timestamp}</td></tr>
        </table>
      `;
    }

    // Use Supabase's built-in email or a simple SMTP approach via the Lovable API
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    // Send via Supabase Auth admin (workaround: log and store request)
    // For now, store the request in the database for the founder to review
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Insert into a demo_requests table
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/demo_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        type: payload.type,
        full_name: payload.fullName.trim().slice(0, 200),
        organization_name: payload.organizationName.trim().slice(0, 200),
        email: payload.email.trim().slice(0, 255),
        phone: payload.phone?.trim().slice(0, 50) || null,
        message: payload.message?.trim().slice(0, 2000) || null,
        plan_name: payload.planName || payload.currentPlan || null,
        billing_cycle: payload.billingCycle || null,
        requested_action: payload.requestedAction || null,
        metadata: { subject, timestamp },
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Failed to store demo request:", errText);
      return new Response(JSON.stringify({ error: "Failed to process request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing demo request:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
