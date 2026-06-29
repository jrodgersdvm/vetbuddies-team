// ============================================
// CONFIGURATION
// ============================================
// In production, these should be injected via environment variables
// at build time or served from a secure endpoint.
const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://utckzviqaeyktlfkhmtb.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2t6dmlxYWV5a3RsZmtobXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTEzOTEsImV4cCI6MjA4ODI2NzM5MX0.UXQrE22LxCkoLKS9zl4_2UdD81eH_Wa71_gsU0Xhtkc',
  VAPID_PUBLIC_KEY: 'BJJCTmZAXDO_VN6svOa-AqC0990KFAo2cqaZAWjJpKsnSm7se6JFwsITHbuAv4OLYr3bsV36m317tCAEdRDitAg',
  STRIPE_PLANS: {
    buddy: 'price_1TP9jhCoogKs3SGPxdI1Sckz',
  },
  STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/7sYdR86fag9dcD46Ho24004',
  BUDDY_PRICE_DISPLAY: '$9.99',
  BUDDY_PRICE_AMOUNT: 9.99,
  TRIAL_DURATION_DAYS: 30,
  // ── Calm Client experience (feature-flagged, allowlist-gated) ──
  // New 4-tab pet-owner UI (Today / Care / Visits / Buddy). Only client-role
  // users whose email is listed below (case-insensitive) see it; every other
  // user keeps the current client UI, and all other roles are untouched.
  // Personal testing override (your browser only): set localStorage 'vb_calm'
  // to '1' to force it on or '0' to force it off — beats the allowlist for you.
  // Rollout: add yourself first, then a few real clients, then flip ENABLED
  // for everyone once you're happy.
  CALM_CLIENT_ENABLED: true,
  CALM_CLIENT_ALLOWLIST: [
    'jrodgersdvm@gmail.com',
    'jsrodgers92@gmail.com',  // Percy's owner — client test account
  ],
});
