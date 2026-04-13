// ============================================
// CONFIGURATION
// ============================================
// In production, these should be injected via environment variables
// at build time or served from a secure endpoint.
const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://utckzviqaeyktlfkhmtb.supabase.co',
  SUPABASE_KEY: 'sb_publishable_HXQagE7K9LgDha7z0BeYoQ_Q_Yz8Vrt',
  VAPID_PUBLIC_KEY: 'BJJCTmZAXDO_VN6svOa-AqC0990KFAo2cqaZAWjJpKsnSm7se6JFwsITHbuAv4OLYr3bsV36m317tCAEdRDitAg',
  STRIPE_PLANS: {
    buddy: 'price_1T7Vw5CoogKs3SGPv92mnQvk',
    buddy_plus: 'price_1T7VwjCoogKs3SGPL9GcM0FL',
    buddy_vip: 'price_1T7VxVCoogKs3SGPwcXrK0kI',
  },
  TRIAL_DURATION_DAYS: 30,

  // ── Limited Time Offer (48-hour LTO) ────────────────────
  // Set LTO_START to an ISO 8601 timestamp to activate the offer.
  // The offer expires exactly 48 hours after this timestamp.
  // Set to null to disable the LTO entirely.
  LTO_START: '2026-04-12T12:00:00Z',
  LTO_DURATION_HOURS: 48,
  LTO_PRICES: {
    buddy:      { amount: 19.99, display: '$19.99', priceId: 'price_LTO_buddy_1999' },
    buddy_plus: { amount: 29.99, display: '$29.99', priceId: 'price_LTO_buddy_plus_2999' },
    // Buddy VIP is not part of the LTO
  },
  LTO_REGULAR_PRICES: {
    buddy:      { amount: 99, display: '$99' },
    buddy_plus: { amount: 149, display: '$149' },
    buddy_vip:  { amount: 279, display: '$279' },
  },
});
