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
    buddy: 'price_1TLxfzCoogKs3SGPIctkgMhW',
    buddy_plus: 'price_1TLxg0CoogKs3SGPAdQBsb8d',
    buddy_vip: 'price_1T7VxVCoogKs3SGPwcXrK0kI',
  },
  TRIAL_DURATION_DAYS: 30,

  // ── Limited Time Offer (48-hour LTO) ────────────────────
  // Set LTO_START to an ISO 8601 timestamp to activate the offer.
  // The offer expires exactly 48 hours after this timestamp.
  // Set to null to disable the LTO entirely.
  LTO_START: null,
  LTO_DURATION_HOURS: 48,
  LTO_PRICES: {
    buddy:      { amount: 19.99, display: '$19.99', priceId: 'price_LTO_buddy_1999' },
    buddy_plus: { amount: 29.99, display: '$29.99', priceId: 'price_LTO_buddy_plus_2999' },
    // Buddy VIP is not part of the LTO
  },
  LTO_REGULAR_PRICES: {
    buddy:      { amount: 19.99, display: '$19.99' },
    buddy_plus: { amount: 29.99, display: '$29.99' },
    buddy_vip:  { amount: 279, display: '$279' },
  },
});
