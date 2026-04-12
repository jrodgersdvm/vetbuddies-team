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
});
