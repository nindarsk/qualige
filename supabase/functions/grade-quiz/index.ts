import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // If passed, update assignment status
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
