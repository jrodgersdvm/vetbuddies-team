import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed price IDs. The new $9.99/mo Buddy price ID is loaded from the
// STRIPE_BUDDY_PRICE_ID env var (set in Supabase Edge Function secrets).
// Legacy price IDs remain allowed so existing subscribers can still be
// served by historical flows (manage billing, etc.).
const NEW_BUDDY_PRICE_ID = Deno.env.get("STRIPE_BUDDY_PRICE_ID") || "";

const LEGACY_PRICE_IDS = new Set([
  "price_1TLxfzCoogKs3SGPIctkgMhW",  // Buddy $99/mo (legacy)
  "price_1TLxg0CoogKs3SGPAdQBsb8d",  // Buddy+ $149/mo (legacy)
  "price_1T7VxVCoogKs3SGPwcXrK0kI",  // Buddy VIP $279/mo (legacy)
]);

const ALLOWED_PRICE_IDS = new Set([
  ...(NEW_BUDDY_PRICE_ID ? [NEW_BUDDY_PRICE_ID] : []),
  ...LEGACY_PRICE_IDS,
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user from JWT
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { price_id, success_url, cancel_url } = await req.json();

    if (!ALLOWED_PRICE_IDS.has(price_id)) {
      return new Response(JSON.stringify({ error: "Invalid price ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up or create Stripe customer
    const { data: profile } = await supabase
      .from("users")
      .select("stripe_customer_id, email, name")
      .eq("auth_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.name || undefined,
        metadata: { supabase_auth_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("auth_id", user.id);
    }

    const metadata: Record<string, string> = {
      supabase_auth_id: user.id,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata,
      subscription_data: { metadata },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
