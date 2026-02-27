import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Auth client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { filePath, youtubeUrl, category, language } = await req.json();

    let textContent = "";

    if (filePath) {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("course-materials")
        .download(filePath);
      if (downloadError) throw new Error(`File download failed: ${downloadError.message}`);

      const fileName = filePath.toLowerCase();
      if (fileName.endsWith(".txt")) {
        textContent = await fileData.text();
      } else if (fileName.endsWith(".pdf") || fileName.endsWith(".docx") || fileName.endsWith(".pptx")) {
        // For binary files, extract text as best we can
        // PDF: try to extract text content
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        // Simple text extraction - decode as UTF-8 and filter readable content
        const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        // Extract readable strings (min 4 chars)
        const readableChunks: string[] = [];
        let current = "";
        for (const char of rawText) {
          if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) < 127) {
            current += char;
          } else {
            if (current.length >= 4) readableChunks.push(current);
            current = "";
          }
        }
        if (current.length >= 4) readableChunks.push(current);
        textContent = readableChunks.join(" ").slice(0, 50000);
        
        if (textContent.length < 100) {
          textContent = `[Document uploaded: ${filePath}]. The document appears to be a binary format. Please generate a comprehensive training course about ${category || "professional development"} based on typical content for this topic in the banking/financial services industry.`;
        }
      } else {
        textContent = await fileData.text();
      }
    } else if (youtubeUrl) {
      textContent = `Please generate a comprehensive training course based on the content that would typically be covered in a video at this URL: ${youtubeUrl}. Focus on ${category || "professional development"} topics relevant to banking professionals.`;
    } else {
      throw new Error("No file or YouTube URL provided");
    }

    // Get organization_id
    const { data: orgData } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!orgData?.organization_id) throw new Error("User has no organization");

    // Call AI to generate course
    const systemPrompt = `You are an expert instructional designer specializing in financial services training for banking professionals. Your task is to analyze the provided document and create a structured professional training course. Always maintain a formal, professional tone appropriate for banking employees.

You must respond with valid JSON matching this exact structure:
{
  "course_title": "string",
  "course_description": "string (2-3 sentences)",
  "estimated_duration_minutes": number,
  "learning_objectives": ["string", "string", "string"],
  "modules": [
    {
      "module_number": number,
      "module_title": "string",
      "content": "string (detailed lesson content minimum 200 words)",
      "key_points": ["string", "string", "string"]
    }
  ],
  "quiz": [
    {
      "question_number": number,
      "question": "string",
      "options": ["A. string", "B. string", "C. string", "D. string"],
      "correct_answer": "A or B or C or D",
      "explanation": "string explaining why this answer is correct"
    }
  ]
}

Generate minimum 3 modules and maximum 8 modules based on content length.
Generate minimum 5 quiz questions and maximum 15 based on content complexity.
The course language should be: ${language || "English"}.
The course category is: ${category || "General"}.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the training material to analyze:\n\n${textContent.slice(0, 30000)}` },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from AI");

    // Parse JSON from response (handle markdown code blocks)
    let courseData;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      courseData = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Insert course
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .insert({
        organization_id: orgData.organization_id,
        title: courseData.course_title,
        description: courseData.course_description,
        category: category || "Other",
        language: language || "English",
        duration_minutes: courseData.estimated_duration_minutes,
        learning_objectives: courseData.learning_objectives,
        status: "draft",
        source_file_path: filePath || null,
        source_youtube_url: youtubeUrl || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (courseError) throw new Error(`Failed to save course: ${courseError.message}`);

    // Insert modules
    if (courseData.modules?.length) {
      const modules = courseData.modules.map((m: any) => ({
        course_id: course.id,
        module_number: m.module_number,
        title: m.module_title,
        content: m.content,
        key_points: m.key_points || [],
      }));
      const { error: modError } = await supabaseAdmin.from("course_modules").insert(modules);
      if (modError) console.error("Module insert error:", modError);
    }

    // Insert quiz questions
    if (courseData.quiz?.length) {
      const questions = courseData.quiz.map((q: any) => ({
        course_id: course.id,
        question_number: q.question_number,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
      }));
      const { error: quizError } = await supabaseAdmin.from("quiz_questions").insert(questions);
      if (quizError) console.error("Quiz insert error:", quizError);
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-course error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
