import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map Stripe price IDs to plan names
// Reads from STRIPE_PRICE_MAP env var if set (JSON: {"price_id":"Plan Name",...})
// Falls back to hardcoded defaults
const DEFAULT_PRICE_MAP: Record<string, string> = {
  // Current price IDs
  price_1TLxfzCoogKs3SGPIctkgMhW: "Buddy",
  price_1TLxg0CoogKs3SGPAdQBsb8d: "Buddy+",
  price_1T7VxVCoogKs3SGPwcXrK0kI: "Buddy VIP",
  // Legacy price IDs (for existing subscribers)
  price_1T7Vw5CoogKs3SGPv92mnQvk: "Buddy",
  price_1T7VwjCoogKs3SGPL9GcM0FL: "Buddy+",
  // LTO prices map to the same plan names
  price_LTO_buddy_1999: "Buddy",
  price_LTO_buddy_plus_2999: "Buddy+",
};
const envPriceMap = Deno.env.get("STRIPE_PRICE_MAP");
const PRICE_TO_PLAN: Record<string, string> = envPriceMap
  ? { ...DEFAULT_PRICE_MAP, ...JSON.parse(envPriceMap) }
  : DEFAULT_PRICE_MAP;

// LTO price IDs — subscriptions with these get a locked promotional rate
const LTO_PRICE_IDS: Record<string, number> = {
  price_LTO_buddy_1999: 19.99,
  price_LTO_buddy_plus_2999: 29.99,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const authId = session.metadata?.supabase_auth_id;
      if (!authId || session.mode !== "subscription") break;

      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      const planName = PRICE_TO_PLAN[priceId] || "Buddy";

      // Build user update
      const userUpdate: Record<string, unknown> = {
        subscription_status: "active",
        subscription_tier_stripe: priceId,
        stripe_subscription_id: subscriptionId,
      };

      // Lock in LTO rate if applicable
      const isLTOSubscription =
        session.metadata?.lto_locked_rate === "true" ||
        (priceId && priceId in LTO_PRICE_IDS);

      if (isLTOSubscription && priceId && priceId in LTO_PRICE_IDS) {
        userUpdate.promotional_price = LTO_PRICE_IDS[priceId];
        userUpdate.promotional_label = "Founding Rate - Locked In";
        userUpdate.promotional_locked_at = new Date().toISOString();
      }

      await supabase
        .from("users")
        .update(userUpdate)
        .eq("auth_id", authId);

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const authId = subscription.metadata?.supabase_auth_id;
      if (!authId) break;

      const statusMap: Record<string, string> = {
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
        trialing: "trialing",
      };

      const mappedStatus = statusMap[subscription.status] || subscription.status;
      await supabase
        .from("users")
        .update({ subscription_status: mappedStatus })
        .eq("auth_id", authId);

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const authId = subscription.metadata?.supabase_auth_id;
      if (!authId) break;

      await supabase
        .from("users")
        .update({
          subscription_status: "canceled",
          // Keep promotional_price so if they re-subscribe they can see their old rate
        })
        .eq("auth_id", authId);

      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
