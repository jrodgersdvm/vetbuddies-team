// ============================================
// UTILITY FUNCTIONS
// ============================================
// Pure utility functions with no dependency on app state.
// Loaded before app.js via <script> tag.

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function renderBadge(role) {
  const badges = {
    client: '<span class="badge badge-client">Client</span>',
    vet_buddy: '<span class="badge badge-buddy">Vet Buddy</span>',
    admin: '<span class="badge badge-admin">Supervising DVM</span>',
    external_vet: '<span class="badge badge-external">External Vet</span>',
  };
  return badges[role] || '';
}

function renderAvatar(initials, color, size = '') {
  const sizeClass = size ? ` ${size}` : '';
  return `<div class="avatar${sizeClass}" style="background: ${esc(color)};">${esc(initials)}</div>`;
}

function renderStatusDot(status) {
  const classes = {
    'Active':          'status-dot active',
    'Needs Attention': 'status-dot needs-attention',
    'Inactive':        'status-dot inactive',
  };
  return `<span class="${classes[status] || 'status-dot'}"></span>`;
}

function renderProgressBar(current, max, color = 'var(--primary)') {
  const percent = max > 0 ? (current / max) * 100 : 0;
  return `<div class="progress-bar"><div class="progress-bar-fill" style="width: ${percent}%; background: ${color};"></div></div>`;
}

// Compress image to a max dimension and JPEG quality to keep uploads small
function compressImage(file, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Compression failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
}

// ── Pagination ──────────────────────────────────────────
const PAGE_SIZE = 10;

function paginate(items, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, totalPages, total: items.length };
}

function renderPagination(key, page, totalPages, total) {
  if (totalPages <= 1) return '';
  let html = `<div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:16px 0;" role="navigation" aria-label="Pagination">`;
  html += `<button class="btn btn-secondary btn-small" data-action="paginate" data-key="${key}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">&laquo; Prev</button>`;
  html += `<span style="font-size:13px;color:var(--text-secondary);">Page ${page} of ${totalPages} (${total} items)</span>`;
  html += `<button class="btn btn-secondary btn-small" data-action="paginate" data-key="${key}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">Next &raquo;</button>`;
  html += '</div>';
  return html;
}

// ── Tier-based feature gating ──────────────────────────
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
  // Community features
  'care_requests_post': 2,
  'care_requests_claim': 2,
  'community_score': 2,
  'community_impact': 2,
  'community_badges': 2,
  'invite_helpers': 2,
  'profile_customization': 3,
  'private_care_circle': 3,
  'vip_badge': 3,
  'community_pillar_badge': 3,
  'care_village_badge': 3,
};

const TIER_XP_MULTIPLIER = { 1: 1, 2: 1.25, 3: 1.5 };
const TIER_HELPER_CAP = { 1: 0, 2: 2, 3: Infinity };

const TIER_UPGRADE_COPY = {
  'care_requests_post': { desc: 'Post care requests and tap into your local pet care community', tier: 'Buddy+', price: '$29.99/mo' },
  'care_requests_claim': { desc: 'Claim care requests and help pets in your community', tier: 'Buddy+', price: '$29.99/mo' },
  'community_score': { desc: 'Track your community impact and earn recognition badges', tier: 'Buddy+', price: '$29.99/mo' },
  'community_impact': { desc: 'See your full community impact dashboard', tier: 'Buddy+', price: '$29.99/mo' },
  'invite_helpers': { desc: 'Invite friends and family to your pet\'s care team', tier: 'Buddy+', price: '$29.99/mo' },
  'profile_customization': { desc: 'Unlock exclusive profile frames and your private care circle', tier: 'Buddy VIP', price: '$279/mo' },
  'private_care_circle': { desc: 'Create a private, invite-only care circle for your pet', tier: 'Buddy VIP', price: '$279/mo' },
};

function getTierLevel(tierName) {
  return TIER_LEVELS[tierName] || 1;
}

// ── Free Trial Helpers ─────────────────────────────────
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

// ── Quiet Hours Helper ───────────────────────────────────
function isQuietHoursActive() {
  const settings = (typeof state !== 'undefined' && state.notificationSettings) || {};
  const start = settings.quiet_hours_start;
  const end = settings.quiet_hours_end;
  if (!start || !end) return false;
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    // Same-day range (e.g. 09:00–17:00)
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight range (e.g. 22:00–07:00)
  return currentMins >= startMins || currentMins < endMins;
}

// ── Limited Time Offer (LTO) Helpers ─────────────────────
function getLTOExpiry() {
  if (!CONFIG.LTO_START) return null;
  const start = new Date(CONFIG.LTO_START);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() + CONFIG.LTO_DURATION_HOURS * 60 * 60 * 1000);
}

function isLTOActive() {
  const expiry = getLTOExpiry();
  if (!expiry) return false;
  const now = new Date();
  const start = new Date(CONFIG.LTO_START);
  return now >= start && now < expiry;
}

function getLTOTimeRemaining() {
  const expiry = getLTOExpiry();
  if (!expiry) return null;
  const diff = expiry.getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, totalMs: diff };
}

function getActivePricing(planKey) {
  const ltoEntry = CONFIG.LTO_PRICES[planKey];
  const regular = CONFIG.LTO_REGULAR_PRICES[planKey];
  if (!regular) return null;
  if (isLTOActive() && ltoEntry) {
    return {
      isLTO: true,
      price: ltoEntry.display,
      amount: ltoEntry.amount,
      priceId: ltoEntry.priceId,
      regularPrice: regular.display,
      regularAmount: regular.amount,
    };
  }
  return {
    isLTO: false,
    price: regular.display,
    amount: regular.amount,
    priceId: CONFIG.STRIPE_PLANS[planKey],
    regularPrice: regular.display,
    regularAmount: regular.amount,
  };
}

function formatLTOCountdown(remaining) {
  if (!remaining) return '';
  const parts = [];
  if (remaining.days > 0) parts.push(`${remaining.days}d`);
  parts.push(`${String(remaining.hours).padStart(2, '0')}h`);
  parts.push(`${String(remaining.minutes).padStart(2, '0')}m`);
  parts.push(`${String(remaining.seconds).padStart(2, '0')}s`);
  return parts.join(' ');
}
