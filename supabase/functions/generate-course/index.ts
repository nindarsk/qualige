import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdf from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.8.0";
import officeparser from "npm:officeparser@4.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const arrayBuffer = await fileData.arrayBuffer();

  if (ext === "txt") {
    return new TextDecoder("utf-8").decode(arrayBuffer);
  }

  if (ext === "pdf") {
    const buffer = new Uint8Array(arrayBuffer);
    const result = await pdf(buffer);
    return result.text;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (ext === "pptx") {
    const buffer = new Uint8Array(arrayBuffer);
    const text = await officeparser.parseOfficeAsync(buffer);
    return text;
  }

  // Fallback
  return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
}

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

    const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { filePath, youtubeUrl, category, language } = await req.json();

    let textContent = "";

    if (filePath) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("course-materials")
        .download(filePath);
      if (downloadError) throw new Error(`File download failed: ${downloadError.message}`);

      try {
        textContent = await extractText(fileData, filePath);
      } catch (extractErr) {
        console.error("Text extraction error:", extractErr);
        return new Response(
          JSON.stringify({ error: "Could not read document content. Please ensure the file is not password protected and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleaned = textContent.replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length < 100) {
        return new Response(
          JSON.stringify({ error: "Could not read document content. Please ensure the file is not password protected and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Extracted text (first 500 chars):", cleaned.substring(0, 500));

      // Truncate to ~12000 words if needed
      const words = textContent.split(/\s+/);
      if (words.length > 12000) {
        console.warn(`Text has ${words.length} words, truncating to 12000.`);
        textContent = words.slice(0, 12000).join(" ");
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

    const systemPrompt = `You are an expert instructional designer. Your ONLY job is to create a training course based EXCLUSIVELY on the document content provided below. Do NOT use any external knowledge. Do NOT add information that is not present in the document. Every module, every quiz question, and every learning objective must be directly derived from the provided text. If the document is about office safety, the course must be about office safety. If the document is about AML compliance, the course must be about AML compliance. Stay strictly within the boundaries of the provided content.

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

    const userMessage = `Here is the complete document content to base the course on:\n\n${textContent}\n\nCreate a training course based EXCLUSIVELY on this content. Do not deviate from the topics covered in this document.`;

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
          { role: "user", content: userMessage },
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

    let courseData;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      courseData = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

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
