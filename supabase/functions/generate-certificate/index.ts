import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateCertificateId(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `QUALI-${year}-${code}`;
}

function generateCertificateHTML(
  employeeName: string,
  courseTitle: string,
  organizationName: string,
  completionDate: string,
  certificateId: string,
  hrAdminName: string
): string {
  // Escape HTML to prevent XSS
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; }
  .cert { width: 842px; height: 595px; background: #fff; position: relative; overflow: hidden; }
  .border-frame { position: absolute; inset: 16px; border: 3px solid #1B3A6B; border-radius: 8px; }
  .border-inner { position: absolute; inset: 4px; border: 1px solid #C9A84C; border-radius: 6px; }
  .content { position: absolute; inset: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .logo { font-family: 'Playfair Display', serif; font-size: 28px; color: #1B3A6B; margin-bottom: 4px; }
  .logo-sub { font-size: 10px; color: #C9A84C; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 24px; }
  .title { font-family: 'Playfair Display', serif; font-size: 24px; color: #1B3A6B; margin-bottom: 20px; }
  .gold-line { width: 120px; height: 2px; background: #C9A84C; margin: 0 auto 20px; }
  .name { font-family: 'Playfair Display', serif; font-size: 32px; color: #1B3A6B; margin-bottom: 12px; }
  .desc { font-size: 13px; color: #555; margin-bottom: 6px; }
  .course { font-size: 18px; font-weight: 600; color: #1B3A6B; margin-bottom: 6px; }
  .org { font-size: 13px; color: #555; margin-bottom: 24px; }
  .footer { display: flex; justify-content: space-between; width: 100%; padding: 0 60px; }
  .footer-item { text-align: center; }
  .footer-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
  .footer-value { font-size: 12px; color: #333; margin-top: 4px; font-weight: 500; }
  .footer-line { width: 140px; height: 1px; background: #ddd; margin: 0 auto 6px; }
  .cert-id { position: absolute; bottom: 24px; right: 40px; font-size: 9px; color: #999; font-family: monospace; }
</style>
</head>
<body>
<div class="cert">
  <div class="border-frame"><div class="border-inner"></div></div>
  <div class="content">
    <div class="logo">Quali</div>
    <div class="logo-sub">Training Platform</div>
    <div class="title">Certificate of Completion</div>
    <div class="gold-line"></div>
    <div class="name">${esc(employeeName)}</div>
    <div class="desc">Has successfully completed the training course</div>
    <div class="course">${esc(courseTitle)}</div>
    <div class="org">at ${esc(organizationName)}</div>
    <div class="footer">
      <div class="footer-item">
        <div class="footer-line"></div>
        <div class="footer-value">${esc(completionDate)}</div>
        <div class="footer-label">Completion Date</div>
      </div>
      <div class="footer-item">
        <div class="footer-line"></div>
        <div class="footer-value">${esc(hrAdminName)}</div>
        <div class="footer-label">Authorized By</div>
      </div>
    </div>
  </div>
  <div class="cert-id">${esc(certificateId)}</div>
</div>
</body>
</html>`;
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

    const { courseId } = await req.json();

    // Input validation
    if (!courseId || typeof courseId !== "string" || !UUID_REGEX.test(courseId)) {
      return new Response(JSON.stringify({ error: "Invalid course ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!emp) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the course belongs to the employee's organization
    const { data: courseCheck } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("organization_id", emp.organization_id)
      .single();

    if (!courseCheck) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabaseAdmin
      .from("certificates")
      .select("id, certificate_id")
      .eq("course_id", courseId)
      .eq("employee_id", emp.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ certificate: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [courseRes, orgRes] = await Promise.all([
      supabaseAdmin.from("courses").select("title, created_by").eq("id", courseId).single(),
      supabaseAdmin.from("organizations").select("name").eq("id", emp.organization_id).single(),
    ]);

    let hrAdminName = "HR Administrator";
    if (courseRes.data?.created_by) {
      const { data: hrProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", courseRes.data.created_by)
        .single();
      if (hrProfile) hrAdminName = hrProfile.full_name;
    }

    const certId = generateCertificateId();
    const completionDate = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const certHtml = generateCertificateHTML(
      emp.full_name,
      courseRes.data?.title || "Course",
      orgRes.data?.name || "Organization",
      completionDate,
      certId,
      hrAdminName
    );

    const filePath = `${user.id}/${certId}.html`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("certificates")
      .upload(filePath, new Blob([certHtml], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    let pdfUrl = null;
    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage
        .from("certificates")
        .getPublicUrl(filePath);
      pdfUrl = urlData?.publicUrl || null;
    } else {
      console.error("Certificate upload error:", uploadError);
    }

    const { data: cert, error: certError } = await supabaseAdmin
      .from("certificates")
      .insert({
        course_id: courseId,
        employee_id: emp.id,
        organization_id: emp.organization_id,
        certificate_id: certId,
        pdf_url: pdfUrl,
      })
      .select()
      .single();

    if (certError) {
      console.error("Certificate insert error:", certError);
      return new Response(JSON.stringify({ error: "Failed to generate certificate. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ certificate: cert }), {
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