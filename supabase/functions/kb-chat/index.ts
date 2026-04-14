import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a friendly and knowledgeable veterinary care assistant for Vet Buddies, a pet care coordination service. You help pet owners with questions about their pet's health, the Vet Buddies service, billing, and using the portal.

Answer questions based on the knowledge base articles provided below. Be warm, concise, and helpful. If you don't know the answer or the question is outside your knowledge, say so honestly and suggest they message their Vet Buddy for personalized help.

Keep responses concise (2-4 sentences for simple questions, longer only when needed). Use plain language a pet owner can understand. Do not make up medical advice — always recommend consulting their vet or Vet Buddy for specific medical concerns.

KNOWLEDGE BASE ARTICLES:
{articles}`;

serve(async (req: Request) => {
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
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers }
      );
    }

    // Get internal user record
    const { data: profile } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers }
      );
    }

    const { message, conversation_id } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers }
      );
    }

    // Load FAQ articles for context
    const { data: articles } = await supabase
      .from("faq_articles")
      .select("title, content, category")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    const articlesText = (articles || [])
      .map((a: { title: string; content: string; category: string }) =>
        `## ${a.title} [${a.category}]\n${a.content}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = SYSTEM_PROMPT.replace("{articles}", articlesText);

    // Get or create conversation
    let convId = conversation_id;
    if (!convId) {
      // Create new conversation with first few words as title
      const title = message.trim().substring(0, 80) + (message.length > 80 ? "..." : "");
      const { data: conv, error: convErr } = await supabase
        .from("kb_conversations")
        .insert({ user_id: profile.id, title })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message
    await supabase.from("kb_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message.trim(),
    });

    // Load conversation history (last 20 messages for context)
    const { data: history } = await supabase
      .from("kb_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build Claude messages from history
    const claudeMessages = (history || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })
    );

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error("Claude API error:", errBody);
      throw new Error("AI service error");
    }

    const claudeData = await claudeResponse.json();
    const assistantContent =
      claudeData.content?.[0]?.text || "Sorry, I couldn't generate a response.";

    // Save assistant response
    await supabase.from("kb_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: assistantContent,
    });

    // Update conversation timestamp
    await supabase
      .from("kb_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    return new Response(
      JSON.stringify({
        conversation_id: convId,
        response: assistantContent,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("kb-chat error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers }
    );
  }
});
