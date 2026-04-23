import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const EXTRACTION_PROMPT = `You are a veterinary medical record extraction assistant. You analyze veterinary medical records and extract structured clinical data.

Given a medical record for a {species} named {pet_name}, extract all relevant medical information and return ONLY valid JSON with this exact structure:

{
  "document_date": "YYYY-MM-DD or null if not found",
  "document_type": "one of: lab_results, exam_notes, vaccination_record, prescription, surgical_report, radiology, dental, discharge_summary, referral, other",
  "summary": "2-3 sentence plain-language summary of the document suitable for a pet owner",
  "diagnoses": ["array of diagnosis strings found in the document"],
  "medications": [{"name": "string", "dose": "string or null", "frequency": "string or null", "start_date": "YYYY-MM-DD or null"}],
  "vaccines": [{"name": "string", "administered_date": "YYYY-MM-DD or null", "due_date": "YYYY-MM-DD or null", "notes": "string or null"}],
  "vitals": {"weight": "number as string in lbs or null", "temperature": "number as string in F or null"},
  "recommendations": ["array of recommendation strings from the veterinarian"],
  "care_goals": ["array of actionable care goal strings derived from the record"],
  "pet_profile_additions": "string to append to the pet's medical profile summarizing new conditions, allergies, or key findings. Use plain language."
}

Rules:
- Return ONLY the JSON object, no markdown fences, no other text
- Use null for fields where information is not found
- Use empty arrays [] when a category has no entries
- Convert all dates to YYYY-MM-DD format
- Convert weights to lbs if given in kg (multiply by 2.205)
- Convert temperatures to Fahrenheit if given in Celsius
- For care_goals, translate clinical findings into owner-friendly action items
- For summary, use plain language a pet owner can understand
- Do NOT fabricate information not present in the document`;

const ACTIVITY_DIGEST_PROMPT = `You are a veterinary care-plan synthesis assistant. You read a chronological digest of case activity (messages, staff notes, timeline entries, appointments, escalations) for a {species} named {pet_name} and extract the information that should update the pet's Living Care Plan.

Return ONLY valid JSON with this exact structure (same shape as document extraction, so downstream code can merge identically):

{
  "document_date": "YYYY-MM-DD — today's date (the digest date)",
  "document_type": "activity_digest",
  "summary": "2-3 sentence plain-language summary of what's new and noteworthy for the pet owner since the care plan was last updated",
  "diagnoses": ["diagnoses explicitly mentioned by staff or a vet in the activity — do NOT infer from symptoms alone"],
  "medications": [{"name": "string", "dose": "string or null", "frequency": "string or null", "start_date": "YYYY-MM-DD or null"}],
  "vaccines": [{"name": "string", "administered_date": "YYYY-MM-DD or null", "due_date": "YYYY-MM-DD or null", "notes": "string or null"}],
  "vitals": {"weight": "number as string in lbs or null", "temperature": "number as string in F or null"},
  "recommendations": ["vet/staff recommendations captured in the activity"],
  "care_goals": ["actionable, owner-friendly care goals derived from the activity — e.g. new symptoms to monitor, follow-up actions, behavior/diet adjustments agreed on"],
  "pet_profile_additions": "string with new conditions, allergies, behavior notes, preferences, or key findings revealed in the activity that are worth appending to the pet's profile. Use plain language. Return an empty string if nothing new."
}

Rules:
- Return ONLY the JSON object, no markdown fences, no other text
- Use null for fields where information is not found
- Use empty arrays [] when a category has no entries
- Only extract what is explicitly stated in the activity — do NOT fabricate, guess, or infer clinical diagnoses from symptom descriptions
- Prefer signals from staff/vet entries (author role noted in each item) over client messages when they conflict
- Deduplicate — if the same medication or observation appears multiple times, include it once
- Skip items that clearly already appear in the existing care plan context
- For care_goals, translate discussion into concrete owner-facing action items`;

serve(async (req: Request) => {
  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers }
      );
    }

    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers }
      );
    }

    const body = await req.json();
    const { mode, document_url, mime_type, file_name, pet_name, pet_species, text_bundle, existing_plan_summary } = body;

    const isTextBundle = mode === "text_bundle";

    if (isTextBundle) {
      if (!text_bundle || typeof text_bundle !== "string" || text_bundle.trim().length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing text_bundle for activity digest" }),
          { status: 400, headers }
        );
      }
    } else {
      if (!document_url || !mime_type) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing document_url or mime_type" }),
          { status: 400, headers }
        );
      }
      if (!SUPPORTED_MIME_TYPES.has(mime_type)) {
        return new Response(
          JSON.stringify({ success: false, error: `Unsupported file type: ${mime_type}. AI extraction supports PDF, images, and text files.` }),
          { status: 400, headers }
        );
      }
    }

    // Build the prompt with pet context (chose template based on mode)
    const basePrompt = isTextBundle ? ACTIVITY_DIGEST_PROMPT : EXTRACTION_PROMPT;
    const systemPrompt = basePrompt
      .replace("{species}", pet_species || "pet")
      .replace("{pet_name}", pet_name || "the patient");

    // Build the content array
    const userContent: Array<Record<string, unknown>> = [];

    if (isTextBundle) {
      // Cap the bundle at ~120k chars (~30k tokens) to stay well under Claude's input window
      // and leave room for the system prompt + response.
      const MAX_BUNDLE_CHARS = 120_000;
      const trimmedBundle = text_bundle.length > MAX_BUNDLE_CHARS
        ? text_bundle.slice(-MAX_BUNDLE_CHARS)
        : text_bundle;
      const existingPlanBlock = existing_plan_summary
        ? `\n\n--- Existing care plan context (do not re-extract items already covered) ---\n${String(existing_plan_summary).slice(0, 8_000)}`
        : "";
      userContent.push({
        type: "text",
        text: `Here is the recent case activity for this patient, in chronological order. Synthesize new information that should update the Living Care Plan.${existingPlanBlock}\n\n--- Activity digest ---\n${trimmedBundle}`,
      });
    } else {
      // File-mode: fetch the document from Supabase Storage
      const fileResponse = await fetch(document_url);
      if (!fileResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch document from storage" }),
          { status: 500, headers }
        );
      }

      const fileBytes = await fileResponse.arrayBuffer();
      const fileBuffer = new Uint8Array(fileBytes);

      // Check file size (limit to 20MB for Claude)
      if (fileBuffer.length > 20 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ success: false, error: "File too large for AI analysis (max 20MB)" }),
          { status: 400, headers }
        );
      }

      if (mime_type === "text/plain" || mime_type === "text/csv") {
        // Text files: decode and send as text
        const textContent = new TextDecoder().decode(fileBuffer);
        userContent.push({
          type: "text",
          text: `Here is the medical record text from file "${file_name}":\n\n${textContent.substring(0, 100000)}`,
        });
      } else if (mime_type === "application/pdf") {
        // PDF: send as base64 document block
        const base64Data = btoa(String.fromCharCode(...fileBuffer));
        userContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data,
          },
        });
        userContent.push({
          type: "text",
          text: `Extract all medical information from this veterinary document ("${file_name}").`,
        });
      } else if (mime_type.startsWith("image/")) {
        // Images: send as base64 image block
        const base64Data = btoa(String.fromCharCode(...fileBuffer));
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mime_type,
            data: base64Data,
          },
        });
        userContent.push({
          type: "text",
          text: `Extract all medical information from this veterinary document image ("${file_name}").`,
        });
      }
    }

    // Call Claude API
    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed. Please try again." }),
        { status: 500, headers }
      );
    }

    const claudeResult = await claudeResponse.json();
    const assistantText = claudeResult.content?.[0]?.text || "";

    // Parse the JSON from Claude's response
    // Strip any markdown fences if present
    let jsonText = assistantText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let extraction;
    try {
      extraction = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse Claude response as JSON:", assistantText.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "AI could not extract structured data from this document." }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, extraction }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("extract-medical-record error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error during extraction" }),
      { status: 500, headers }
    );
  }
});
