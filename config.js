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
});
