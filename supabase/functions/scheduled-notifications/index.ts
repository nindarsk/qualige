import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET authorization
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const founderEmail = Deno.env.get("FOUNDER_EMAIL");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const threeDayStr = threeDays.toISOString().split("T")[0];

  const oneDay = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
  const oneDayStr = oneDay.toISOString().split("T")[0];

  const results = { reminders3day: 0, reminders1day: 0, overdue: 0, errors: 0 };

  async function sendNotification(to: string, subject: string, html: string) {
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html_body: html },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Email send error:", err);
      results.errors++;
    }
  }

  function buildReminderHtml(name: string, title: string, dueDate: string, urgency: string) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B3A6B; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Quali.ge</h1>
          <div style="height: 3px; background: #C9A84C; margin-top: 12px;"></div>
        </div>
        <div style="padding: 32px; background: white;">
          <h2 style="color: #1B3A6B;">Training Reminder</h2>
          <p>Hi ${name},</p>
          <p>Your training course <strong>${title}</strong> is due in <strong>${urgency}</strong>.</p>
          <p>Due date: <strong>${dueDate}</strong></p>
          <a href="https://qualige.lovable.app/employee" style="display: inline-block; background: #1B3A6B; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Go to Training</a>
        </div>
        <div style="background: #1B3A6B; padding: 16px; text-align: center;">
          <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Quali.ge — AI-powered LMS</p>
        </div>
      </div>`;
  }

  try {
    // 3-day reminders
    const { data: threeDayAssignments } = await supabase
      .from("course_assignments")
      .select("id, due_date, employee_id, course_id")
      .in("status", ["assigned", "in_progress"])
      .eq("reminder_3day_sent", false)
      .gte("due_date", `${threeDayStr}T00:00:00`)
      .lte("due_date", `${threeDayStr}T23:59:59`);

    for (const a of threeDayAssignments || []) {
      const [{ data: emp }, { data: course }] = await Promise.all([
        supabase.from("employees").select("email, full_name").eq("id", a.employee_id).single(),
        supabase.from("courses").select("title").eq("id", a.course_id).single(),
      ]);
      if (emp && course) {
        const dueStr = new Date(a.due_date).toLocaleDateString("en-GB");
        await sendNotification(emp.email, `Reminder — Training due in 3 days: ${course.title}`, buildReminderHtml(emp.full_name, course.title, dueStr, "3 days"));
        await supabase.from("course_assignments").update({ reminder_3day_sent: true } as any).eq("id", a.id);
        results.reminders3day++;
      }
    }

    // 1-day reminders
    const { data: oneDayAssignments } = await supabase
      .from("course_assignments")
      .select("id, due_date, employee_id, course_id")
      .in("status", ["assigned", "in_progress"])
      .eq("reminder_1day_sent", false)
      .gte("due_date", `${oneDayStr}T00:00:00`)
      .lte("due_date", `${oneDayStr}T23:59:59`);

    for (const a of oneDayAssignments || []) {
      const [{ data: emp }, { data: course }] = await Promise.all([
        supabase.from("employees").select("email, full_name").eq("id", a.employee_id).single(),
        supabase.from("courses").select("title").eq("id", a.course_id).single(),
      ]);
      if (emp && course) {
        const dueStr = new Date(a.due_date).toLocaleDateString("en-GB");
        await sendNotification(emp.email, `Action Required — Training due tomorrow: ${course.title}`, buildReminderHtml(emp.full_name, course.title, dueStr, "1 day"));
        await supabase.from("course_assignments").update({ reminder_1day_sent: true } as any).eq("id", a.id);
        results.reminders1day++;
      }
    }

    // Overdue
    const { data: overdueAssignments } = await supabase
      .from("course_assignments")
      .select("id, due_date, employee_id, course_id, organization_id")
      .in("status", ["assigned", "in_progress"])
      .eq("overdue_notified", false)
      .lt("due_date", `${todayStr}T00:00:00`)
      .not("due_date", "is", null);

    for (const a of overdueAssignments || []) {
      const [{ data: emp }, { data: course }] = await Promise.all([
        supabase.from("employees").select("email, full_name").eq("id", a.employee_id).single(),
        supabase.from("courses").select("title").eq("id", a.course_id).single(),
      ]);
      if (emp && course) {
        const dueStr = new Date(a.due_date).toLocaleDateString("en-GB");
        // Notify employee
        await sendNotification(emp.email, `Your training is overdue: ${course.title}`, buildReminderHtml(emp.full_name, course.title, dueStr, "OVERDUE"));

        // Notify HR admin(s) via founder email
        if (founderEmail) {
          await sendNotification(
            founderEmail,
            `${emp.full_name} has not completed required training — ${course.title}`,
            `<p>${emp.full_name} (${emp.email}) has not completed <strong>${course.title}</strong>. Due date was ${dueStr}.</p>`
          );
        }

        await supabase.from("course_assignments").update({ overdue_notified: true } as any).eq("id", a.id);
        results.overdue++;
      }
    }
  } catch (err) {
    console.error("Scheduled notifications error:", err);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
