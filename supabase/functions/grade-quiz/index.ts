import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { courseId, answers } = await req.json();

    // Validate courseId
    if (!courseId || typeof courseId !== "string" || !UUID_REGEX.test(courseId)) {
      return new Response(JSON.stringify({ error: "Invalid course ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate answers is a record of questionId -> selected option
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: "Invalid answers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get employee
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!emp) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify course belongs to employee's org
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, title")
      .eq("id", courseId)
      .eq("organization_id", emp.organization_id)
      .single();

    if (!course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get questions with correct answers (server-side only)
    const { data: questions } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, question_number, question, options, correct_answer, explanation")
      .eq("course_id", courseId)
      .order("question_number");

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No quiz questions found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grade answers server-side
    const normalize = (answer: string) => answer?.toString().trim().charAt(0).toUpperCase();
    let correct = 0;
    const answerDetails = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const isCorrect = normalize(userAnswer) === normalize(q.correct_answer);
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        question: q.question,
        user_answer: userAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const passed = score >= 70;

    // Save attempt
    const { error: insertError } = await supabaseAdmin.from("quiz_attempts").insert({
      course_id: courseId,
      employee_id: emp.id,
      score,
      passed,
      answers: answerDetails,
    });

    if (insertError) {
      console.error("Quiz attempt insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save quiz results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If passed, update assignment status and send completion email
    if (passed) {
      const { data: assign } = await supabaseAdmin
        .from("course_assignments")
        .select("id")
        .eq("course_id", courseId)
        .eq("employee_id", emp.id)
        .single();

      if (assign) {
        await supabaseAdmin
          .from("course_assignments")
          .update({ status: "completed" })
          .eq("id", assign.id);

        await supabaseAdmin
          .from("course_progress")
          .update({ completed_at: new Date().toISOString() })
          .eq("assignment_id", assign.id);
      }

      // Send completion email directly (server-side, no need for send-email function)
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const { data: empData } = await supabaseAdmin
            .from("employees")
            .select("email, full_name")
            .eq("id", emp.id)
            .single();

          if (empData) {
            const resend = new Resend(resendKey);
            const fromAddress = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";
            await resend.emails.send({
              from: fromAddress,
              to: empData.email,
              subject: `Congratulations! You completed ${course.title}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1B3A6B; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Quali.ge</h1>
                    <div style="height: 3px; background: #C9A84C; margin-top: 12px;"></div>
                  </div>
                  <div style="padding: 32px; background: white;">
                    <h2 style="color: #1B3A6B;">Congratulations, ${empData.full_name}! 🎓</h2>
                    <p>You have successfully completed the training course:</p>
                    <p style="font-size: 18px; font-weight: bold; color: #1B3A6B;">${course.title}</p>
                    <p>Your score: <strong>${Math.round(score)}%</strong></p>
                    <p>Log in to Quali.ge to download your certificate.</p>
                    <a href="https://qualige.lovable.app/employee/certificates" style="display: inline-block; background: #1B3A6B; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Download Certificate</a>
                  </div>
                  <div style="background: #1B3A6B; padding: 16px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">Quali.ge — AI-powered Learning Management System</p>
                  </div>
                </div>`,
            }).catch((err: unknown) => console.error("Completion email error:", err));
          }
        }
      } catch (emailErr) {
        console.error("Completion email error:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        score,
        passed,
        correct,
        total: questions.length,
        answers: answerDetails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
