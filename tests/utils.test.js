/**
 * Unit tests for VetBuddies utility functions.
 * Run with: node tests/utils.test.js
 *
 * Lightweight test runner — no external dependencies required.
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ── Mock browser globals ──────────────────────────
globalThis.window = { supabase: { createClient: () => ({}) } };
globalThis.document = {
  createElement: () => ({ className: '', textContent: '', setAttribute: () => {}, remove: () => {} }),
  body: { appendChild: () => {} },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  hidden: false,
  documentElement: { setAttribute: () => {} },
};
globalThis.navigator = { serviceWorker: null };
globalThis.Notification = { permission: 'default' };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.setTimeout = (fn) => fn;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;
globalThis.CONFIG = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  VAPID_PUBLIC_KEY: 'test-vapid',
  STRIPE_PLANS: { buddy: 'price_test1' },
  STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/test',
  BUDDY_PRICE_DISPLAY: '$9.99',
  BUDDY_PRICE_AMOUNT: 9.99,
  TRIAL_DURATION_DAYS: 30,
};

// Load config.js — it uses `const CONFIG = ...` which in browser scope is global,
// but in Node/CJS it's module-scoped. We eval it to get the same behavior.
const fs = require('fs');
const configSource = fs.readFileSync(require('path').join(__dirname, '..', 'config.js'), 'utf8');
eval(configSource);

// We can't fully load app.js because it tries to init Supabase and attach DOM listeners.
// Instead, test the pure functions by extracting their logic here.

// ── Re-implement pure functions from app.js for testing ──

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const TIER_LEVELS = { 'Buddy': 1, 'buddy': 1, 'Buddy+': 2, 'buddy_plus': 2, 'Buddy VIP': 3, 'buddy_vip': 3, 'Trial': 1 };
const FEATURE_MIN_TIER = {
  'weekly_checkins': 2,
  'health_timeline': 2,
  'vitals_tracking': 2,
  'vaccine_tracker': 1,
  'medication_tracking': 1,
  'dvm_checkins': 3,
  'priority_messaging': 3,
  'referral_dashboard': 2,
  'document_uploads': 1,
  'care_plan': 1,
};

function getTierLevel(tierName) {
  return TIER_LEVELS[tierName] || 1;
}

const PAGE_SIZE = 10;
function paginate(items, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, totalPages, total: items.length };
}

function getTrialDaysRemaining(profile) {
  if (!profile?.trial_ends_at) return 0;
  const now = new Date();
  const end = new Date(profile.trial_ends_at);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function isTrialActive(profile) {
  return profile?.subscription_status === 'trialing' && getTrialDaysRemaining(profile) > 0;
}

function isTrialExpired(profile) {
  return profile?.subscription_status === 'trialing' && getTrialDaysRemaining(profile) <= 0;
}

function hasActiveAccess(profile) {
  return profile?.subscription_status === 'active' || isTrialActive(profile);
}

function hasWriteAccess(profile) {
  return profile?.subscription_status === 'active' || isTrialActive(profile);
}

function hasReadAccess(profile) {
  return !!profile?.subscription_status && profile.subscription_status !== 'none';
}

// ══════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════

describe('CONFIG', () => {
  assert(typeof CONFIG === 'object', 'CONFIG is defined');
  assert(typeof CONFIG.SUPABASE_URL === 'string', 'SUPABASE_URL is a string');
  assert(typeof CONFIG.SUPABASE_KEY === 'string', 'SUPABASE_KEY is a string');
  assert(typeof CONFIG.VAPID_PUBLIC_KEY === 'string', 'VAPID_PUBLIC_KEY is a string');
  // Object.freeze works in browser but not in eval'd CJS context — verify the source uses it
  const configSrc = fs.readFileSync(require('path').join(__dirname, '..', 'config.js'), 'utf8');
  assert(configSrc.includes('Object.freeze'), 'CONFIG source uses Object.freeze');
});

describe('esc() — HTML escaping', () => {
  assertEqual(esc(''), '', 'empty string returns empty');
  assertEqual(esc(null), '', 'null returns empty');
  assertEqual(esc(undefined), '', 'undefined returns empty');
  assertEqual(esc('hello'), 'hello', 'plain text unchanged');
  assertEqual(esc('<script>'), '&lt;script&gt;', 'angle brackets escaped');
  assertEqual(esc('"hello"'), '&quot;hello&quot;', 'double quotes escaped');
  assertEqual(esc("it's"), "it&#039;s", 'single quotes escaped');
  assertEqual(esc('a&b'), 'a&amp;b', 'ampersand escaped');
  assertEqual(esc('<img onerror="alert(1)">'), '&lt;img onerror=&quot;alert(1)&quot;&gt;', 'XSS payload escaped');
});

describe('getTierLevel()', () => {
  assertEqual(getTierLevel('Buddy'), 1, 'Buddy = level 1');
  assertEqual(getTierLevel('Buddy+'), 2, 'Buddy+ = level 2');
  assertEqual(getTierLevel('Buddy VIP'), 3, 'Buddy VIP = level 3');
  assertEqual(getTierLevel('buddy'), 1, 'lowercase buddy = level 1');
  assertEqual(getTierLevel('buddy_plus'), 2, 'buddy_plus = level 2');
  assertEqual(getTierLevel('buddy_vip'), 3, 'buddy_vip = level 3');
  assertEqual(getTierLevel('Trial'), 1, 'Trial = level 1');
  assertEqual(getTierLevel('unknown'), 1, 'unknown tier defaults to 1');
  assertEqual(getTierLevel(null), 1, 'null defaults to 1');
});

describe('FEATURE_MIN_TIER gating', () => {
  assert(FEATURE_MIN_TIER['weekly_checkins'] === 2, 'weekly_checkins requires Buddy+');
  assert(FEATURE_MIN_TIER['dvm_checkins'] === 3, 'dvm_checkins requires VIP');
  assert(FEATURE_MIN_TIER['care_plan'] === 1, 'care_plan available to all');
  assert(FEATURE_MIN_TIER['vitals_tracking'] === 2, 'vitals_tracking requires Buddy+');
});

describe('paginate()', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  const p1 = paginate(items, 1, 10);
  assertEqual(p1.items.length, 10, 'page 1 has 10 items');
  assertEqual(p1.page, 1, 'page number is 1');
  assertEqual(p1.totalPages, 3, 'total pages is 3');
  assertEqual(p1.total, 25, 'total is 25');
  assertEqual(p1.items[0], 0, 'first item on page 1 is 0');

  const p2 = paginate(items, 2, 10);
  assertEqual(p2.items[0], 10, 'first item on page 2 is 10');
  assertEqual(p2.items.length, 10, 'page 2 has 10 items');

  const p3 = paginate(items, 3, 10);
  assertEqual(p3.items.length, 5, 'last page has 5 items');
  assertEqual(p3.items[0], 20, 'first item on page 3 is 20');

  const pOver = paginate(items, 99, 10);
  assertEqual(pOver.page, 3, 'over-page clamps to last page');

  const pUnder = paginate(items, 0, 10);
  assertEqual(pUnder.page, 1, 'under-page clamps to 1');

  const pEmpty = paginate([], 1, 10);
  assertEqual(pEmpty.items.length, 0, 'empty array returns empty items');
  assertEqual(pEmpty.totalPages, 1, 'empty array has 1 total page');
});

describe('Trial helpers', () => {
  const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const activeTrialProfile = { subscription_status: 'trialing', trial_ends_at: future };
  const expiredTrialProfile = { subscription_status: 'trialing', trial_ends_at: past };
  const activeSubProfile = { subscription_status: 'active' };
  const noSubProfile = { subscription_status: 'none' };
  const nullProfile = null;

  assert(getTrialDaysRemaining(activeTrialProfile) > 0, 'active trial has days remaining');
  assertEqual(getTrialDaysRemaining(expiredTrialProfile), 0, 'expired trial has 0 days');
  assertEqual(getTrialDaysRemaining(nullProfile), 0, 'null profile returns 0');
  assertEqual(getTrialDaysRemaining({}), 0, 'no trial_ends_at returns 0');

  assert(isTrialActive(activeTrialProfile), 'active trial is active');
  assert(!isTrialActive(expiredTrialProfile), 'expired trial is not active');
  assert(!isTrialActive(activeSubProfile), 'active sub is not a trial');

  assert(!isTrialExpired(activeTrialProfile), 'active trial is not expired');
  assert(isTrialExpired(expiredTrialProfile), 'expired trial is expired');

  assert(hasActiveAccess(activeSubProfile), 'active sub has access');
  assert(hasActiveAccess(activeTrialProfile), 'active trial has access');
  assert(!hasActiveAccess(expiredTrialProfile), 'expired trial has no access');
  assert(!hasActiveAccess(noSubProfile), 'no sub has no access');
  assert(!hasActiveAccess(nullProfile), 'null profile has no access');

  assert(hasWriteAccess(activeSubProfile), 'active sub has write access');
  assert(hasWriteAccess(activeTrialProfile), 'active trial has write access');
  assert(!hasWriteAccess(expiredTrialProfile), 'expired trial has no write access');

  assert(hasReadAccess(activeSubProfile), 'active sub has read access');
  assert(hasReadAccess(activeTrialProfile), 'trialing has read access');
  assert(hasReadAccess(expiredTrialProfile), 'expired trial still has read access');
  assert(!hasReadAccess(noSubProfile), 'no sub has no read access');
});

// ── Summary ──
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
