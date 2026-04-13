import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// LTO configuration — must match config.js values
const LTO_START = "2026-04-12T12:00:00Z";
const LTO_DURATION_HOURS = 48;
const LTO_EXPIRY = new Date(
  new Date(LTO_START).getTime() + LTO_DURATION_HOURS * 60 * 60 * 1000
);

// Map of LTO price IDs to validate server-side
const LTO_PRICE_IDS = new Set([
  "price_LTO_buddy_1999",
  "price_LTO_buddy_plus_2999",
]);

// Standard price IDs
const STANDARD_PRICE_IDS = new Set([
  "price_1T7Vw5CoogKs3SGPv92mnQvk",
  "price_1T7VwjCoogKs3SGPL9GcM0FL",
  "price_1T7VxVCoogKs3SGPwcXrK0kI",
]);

function isLTOActiveServerSide(): boolean {
  const now = new Date();
  const start = new Date(LTO_START);
  return now >= start && now < LTO_EXPIRY;
}

function isLTOPriceAllowed(
  priceId: string,
  ltoInitiatedAt: string | null
): boolean {
  if (!LTO_PRICE_IDS.has(priceId)) return true; // not an LTO price, always OK

  // LTO price requested — check if offer is still active
  if (isLTOActiveServerSide()) return true;

  // Edge case: checkout was initiated during LTO but completed after expiry
  // Honor the LTO price if initiated within the offer window
  if (ltoInitiatedAt) {
    const initiated = new Date(ltoInitiatedAt);
    const start = new Date(LTO_START);
    if (initiated >= start && initiated < LTO_EXPIRY) return true;
  }

  return false;
}

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

    const {
      price_id,
      success_url,
      cancel_url,
      lto_initiated_at,
      lto_locked_rate,
    } = await req.json();

    // Validate price ID
    if (!STANDARD_PRICE_IDS.has(price_id) && !LTO_PRICE_IDS.has(price_id)) {
      return new Response(JSON.stringify({ error: "Invalid price ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side LTO validation — prevent client-side manipulation
    if (
      LTO_PRICE_IDS.has(price_id) &&
      !isLTOPriceAllowed(price_id, lto_initiated_at)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "This promotional price has expired. Please refresh for current pricing.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    // Build checkout session metadata
    const metadata: Record<string, string> = {
      supabase_auth_id: user.id,
    };
    if (lto_locked_rate && LTO_PRICE_IDS.has(price_id)) {
      metadata.lto_locked_rate = "true";
      metadata.lto_initiated_at = lto_initiated_at || new Date().toISOString();
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata,
      subscription_data: {
        metadata, // propagate LTO metadata to the subscription
      },
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
