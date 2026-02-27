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

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function cleanTranscript(xml: string): string {
  // Remove XML tags, decode entities, clean noise
  let text = xml.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  text = text.replace(/\[Music\]/gi, "").replace(/\[Applause\]/gi, "").replace(/\[Laughter\]/gi, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Try direct timedtext endpoints first
  const endpoints = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
    `https://video.google.com/timedtext?lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?v=${videoId}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) { console.log(`Timedtext ${url} returned ${resp.status}`); continue; }
      const xml = await resp.text();
      if (!xml || xml.trim().length < 50) { console.log(`Timedtext ${url} returned short/empty response`); continue; }
      const cleaned = cleanTranscript(xml);
      if (cleaned.length > 50) return cleaned;
    } catch (e) {
      console.log(`Timedtext fetch error for ${url}:`, e);
      continue;
    }
  }

  // Fallback: fetch the watch page and extract captionTracks baseUrl
  const pageUrls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://m.youtube.com/watch?v=${videoId}`,
  ];

  for (const pageUrl of pageUrls) {
    try {
      console.log(`Fetching page: ${pageUrl}`);
      const pageResp = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!pageResp.ok) { console.log(`Page fetch returned ${pageResp.status}`); continue; }
      const html = await pageResp.text();
      console.log(`Page HTML length: ${html.length}`);

      // Try multiple patterns to find caption URLs
      const patterns = [
        /"captionTracks":\s*\[(.*?)\]/s,
        /\"captionTracks\":\[(\{.*?\}(?:,\{.*?\})*)\]/s,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (!match) continue;

        // Extract all baseUrl values
        const baseUrlMatches = match[0].matchAll(/"baseUrl"\s*:\s*"(.*?)"/g);
        for (const urlMatch of baseUrlMatches) {
          try {
            const captionUrl = urlMatch[1]
              .replace(/\\u0026/g, "&")
              .replace(/\\"/g, '"');
            console.log(`Found caption URL, fetching transcript...`);
            const captionResp = await fetch(captionUrl);
            if (!captionResp.ok) { await captionResp.text(); continue; }
            const xml = await captionResp.text();
            const cleaned = cleanTranscript(xml);
            if (cleaned.length > 50) return cleaned;
          } catch (e) {
            console.log("Caption URL fetch error:", e);
            continue;
          }
        }
      }

      // Alternative: look for timedtext in playerCaptionsTracklistRenderer
      const timedtextMatch = html.match(/https?:\\\/\\\/www\.youtube\.com\\\/api\\\/timedtext[^"']*/);
      if (timedtextMatch) {
        const ttUrl = timedtextMatch[0].replace(/\\\//g, "/").replace(/\\u0026/g, "&");
        console.log(`Found timedtext URL from page, fetching...`);
        const ttResp = await fetch(ttUrl);
        if (ttResp.ok) {
          const xml = await ttResp.text();
          const cleaned = cleanTranscript(xml);
          if (cleaned.length > 50) return cleaned;
        }
      }
    } catch (e) {
      console.log(`Page scraping error for ${pageUrl}:`, e);
      continue;
    }
  }

  console.log("All transcript extraction methods failed for video:", videoId);
  return "";
}

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
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: "Invalid YouTube URL. Please provide a valid YouTube video link." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Extracting transcript for video:", videoId);
      textContent = await fetchYouTubeTranscript(videoId);

      if (!textContent || textContent.length < 100) {
        return new Response(
          JSON.stringify({ error: "Could not extract transcript from this YouTube video. The video may not have captions enabled. Please try a different video or upload a document instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("YouTube transcript (first 500 chars):", textContent.substring(0, 500));

      const words = textContent.split(/\s+/);
      if (words.length > 12000) {
        console.warn(`Transcript has ${words.length} words, truncating to 12000.`);
        textContent = words.slice(0, 12000).join(" ");
      }
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
