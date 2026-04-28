/*!
 * VetBuddies — Escalations Module (Feature #5)
 * Self-contained, drop-in. Version 1.0.0.
 *
 * Usage:
 *   Include this file once in your index.html, before </body>:
 *     <script src="/escalations.js"></script>
 *
 *   OR paste this entire file inline inside a <script> tag.
 *
 * Requirements:
 *   - Supabase JS client available as window.sb, window.supabase, or
 *     the first supabase client created in the page. Auto-detected.
 *   - User authenticated (the module waits for auth up to 30s).
 *
 * Optional config (set before this script loads):
 *   window.VB_ESC_CONFIG = {
 *     getCurrentCaseId: () => "uuid-or-null",  // override case detection
 *     teamPortalUrl: "https://vetbuddies-team.netlify.app",  // for email links
 *   };
 *
 * What it adds:
 *   - For role = 'vet_buddy': a floating "Escalate" button in bottom-right.
 *     Click → modal with type/priority/note → creates escalation → fires
 *     push+email via send-escalation-notification edge function.
 *   - For role = 'admin': a floating bell icon (top-right) with a live
 *     open-count badge. Click → overlay queue. Click a row → detail view
 *     with the frozen context bundle, acknowledge + resolve actions.
 *
 * Zero dependencies on existing app.js. All CSS classes prefixed vbesc-.
 *
 * To uninstall: remove the script tag. No DB cleanup needed.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 0. Guard against double-load
  // ==========================================================================
  if (window.__VB_ESCALATIONS_LOADED__) {
    console.log('[vbesc] already loaded; skipping');
    return;
  }
  window.__VB_ESCALATIONS_LOADED__ = true;

  const VERSION = '1.0.0';
  const LOG = (...args) => console.log('[vbesc]', ...args);
  const WARN = (...args) => console.warn('[vbesc]', ...args);

  LOG(`loading v${VERSION}`);

  // ==========================================================================
  // 1. Configuration
  // ==========================================================================
  const USER_CONFIG = window.VB_ESC_CONFIG || {};
  const CONFIG = {
    teamPortalUrl: USER_CONFIG.teamPortalUrl || 'https://vetbuddies-team.netlify.app',
    // Default case-id detector: try hash patterns like #case/uuid, #cases/uuid, #c/uuid
    getCurrentCaseId: USER_CONFIG.getCurrentCaseId || (() => {
      const hash = window.location.hash || '';
      // Common patterns
      let m = hash.match(/[#/]cases?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (m) return m[1];
      m = hash.match(/[?&]case(?:_id|Id)?=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (m) return m[1];
      // Global fallback
      return window.currentCaseId || window.VB_currentCaseId || null;
    }),
  };

  // ==========================================================================
  // 2. State
  // ==========================================================================
  const state = {
    sb: null,
    user: null,
    userId: null,
    role: null,
    name: null,
    supabaseUrl: null,
    realtimeChannel: null,
    openCount: 0,
  };

  // ==========================================================================
  // 3. DOM helpers
  // ==========================================================================
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else if (v !== false && v != null) el.setAttribute(k, v);
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatAgo(iso) {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const TYPE_LABELS = {
    clinical_concern: 'Clinical concern',
    owner_distress: 'Owner distress',
    owner_vet_conflict: 'Owner ↔ vet',
    out_of_scope: 'Out of scope',
    safety_concern: 'Safety concern',
    unsure: 'Another set of eyes',
  };
  function formatType(t) { return TYPE_LABELS[t] || 'Concern'; }

  // ==========================================================================
  // 4. Supabase client detection
  // ==========================================================================
  function findSupabaseClient() {
    // Common globals to try
    const candidates = [
      window.sb, window.supabase, window.supabaseClient,
      window.supa, window.SB, window.client,
    ];
    for (const c of candidates) {
      if (c && typeof c.from === 'function' && typeof c.rpc === 'function' && c.auth) {
        return c;
      }
    }
    return null;
  }

  function extractSupabaseUrl(sb) {
    // Derive from internal properties — varies by Supabase client version.
    // Try the most common shapes.
    try {
      if (sb.supabaseUrl) return sb.supabaseUrl;
      if (sb.rest && sb.rest.url) return sb.rest.url.replace(/\/rest\/v1\/?$/, '');
      if (sb.restUrl) return sb.restUrl.replace(/\/rest\/v1\/?$/, '');
    } catch (e) { /* ignore */ }
    return null;
  }

  // ==========================================================================
  // 5. Data access
  // ==========================================================================
  async function raiseEscalation({ caseId, type, priority, reason }) {
    const { data: bundle, error: bundleErr } = await state.sb.rpc(
      'build_escalation_context', { p_case_id: caseId }
    );
    if (bundleErr) throw new Error(`Context capture failed: ${bundleErr.message}`);

    const { data: esc, error: insErr } = await state.sb
      .from('escalations')
      .insert({
        case_id: caseId,
        raised_by: state.userId,
        reason,
        escalation_type: type,
        priority,
        context_bundle: bundle,
        status: 'Open',
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message || 'Insert failed');

    // Fire notifications, fire-and-forget
    (async () => {
      try {
        const session = (await state.sb.auth.getSession()).data.session;
        if (!session || !state.supabaseUrl) return;
        await fetch(`${state.supabaseUrl}/functions/v1/send-escalation-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ escalation_id: esc.id }),
        });
      } catch (e) {
        WARN('notification call failed (non-fatal)', e);
      }
    })();

    return esc;
  }

  async function loadMyCases() {
    // For vet_buddy: cases assigned to me
    const { data, error } = await state.sb
      .from('cases')
      .select('id, status, pets(name, species)')
      .eq('assigned_buddy_id', state.userId)
      .eq('status', 'Active')
      .order('updated_at', { ascending: false });
    if (error) { WARN('loadMyCases error', error); return []; }
    return data || [];
  }

  async function loadOpenEscalationCount() {
    const { count, error } = await state.sb
      .from('escalations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Open');
    if (error) { WARN('loadOpenEscalationCount error', error); return 0; }
    return count || 0;
  }

  async function loadAdminQueue() {
    const { data, error } = await state.sb
      .from('escalations')
      .select(`
        id, priority, escalation_type, reason, status, created_at, acknowledged_at, case_id, raised_by,
        raiser:users!escalations_raised_by_fkey(name),
        case:cases!inner(pet_id, pets(name))
      `)
      .in('status', ['Open', 'Acknowledged'])
      .order('created_at', { ascending: false });
    if (error) { WARN('loadAdminQueue error', error); return []; }
    const rows = data || [];
    const order = { urgent: 0, normal: 1, fyi: 2 };
    rows.sort((a, b) => (order[a.priority] - order[b.priority])
      || (new Date(a.created_at) - new Date(b.created_at)));
    return rows;
  }

  async function loadEscalationDetail(id) {
    const { data, error } = await state.sb
      .from('escalations')
      .select(`
        *,
        raiser:users!escalations_raised_by_fkey(name, email),
        case:cases(pet_id, pets(name, species, breed))
      `)
      .eq('id', id)
      .single();
    if (error) { WARN('loadEscalationDetail error', error); return null; }
    return data;
  }

  async function acknowledgeEscalation(id) {
    const { error } = await state.sb
      .from('escalations')
      .update({
        status: 'Acknowledged',
        acknowledged_by: state.userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  }

  async function resolveEscalation(id, dvmResponse) {
    const { error } = await state.sb
      .from('escalations')
      .update({
        status: 'Resolved',
        dvm_response: dvmResponse || null,
        resolved_by: state.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  }

  // ==========================================================================
  // 6. Styles — all namespaced vbesc-
  // ==========================================================================
  const STYLES = `
    .vbesc-fab-buddy {
      position: fixed; bottom: 20px; right: 20px; z-index: 9000;
      background: #fff; color: #b33a3a; border: 1.5px solid #d9534f;
      padding: 12px 18px; border-radius: 999px; font-weight: 600;
      font-size: 14px; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: background 0.15s, color 0.15s, transform 0.1s;
    }
    .vbesc-fab-buddy:hover { background: #d9534f; color: #fff; }
    .vbesc-fab-buddy:active { transform: scale(0.97); }

    .vbesc-fab-admin {
      position: fixed; bottom: 20px; right: 20px; z-index: 9000;
      background: #fff; border: 1px solid #ddd; border-radius: 999px;
      padding: 8px 14px 8px 10px; cursor: pointer; display: flex;
      align-items: center; gap: 8px; font-family: -apple-system, sans-serif;
      font-size: 13px; font-weight: 500; color: #333;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .vbesc-fab-admin:hover { border-color: #aaa; }
    .vbesc-fab-admin-badge {
      display: inline-block; min-width: 20px; height: 20px;
      padding: 0 6px; background: #d9534f; color: #fff;
      border-radius: 10px; font-size: 11px; font-weight: 700;
      line-height: 20px; text-align: center;
    }
    .vbesc-fab-admin-badge.vbesc-hidden { display: none; }

    .vbesc-overlay {
      position: fixed; inset: 0; z-index: 9500;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 40px 16px; overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .vbesc-card {
      background: #fff; border-radius: 10px; max-width: 680px; width: 100%;
      padding: 28px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      max-height: calc(100vh - 80px); overflow-y: auto;
    }
    .vbesc-card.vbesc-card-wide { max-width: 980px; }
    .vbesc-card h1, .vbesc-card h2, .vbesc-card h3 {
      margin: 0 0 12px 0; font-family: inherit; color: #111;
    }
    .vbesc-card h1 { font-size: 22px; }
    .vbesc-card h2 { font-size: 18px; }
    .vbesc-card h3 { font-size: 14px; text-transform: uppercase;
                     letter-spacing: 0.04em; color: #666; margin-top: 20px; }
    .vbesc-card p { line-height: 1.5; color: #333; margin: 8px 0; }
    .vbesc-close {
      float: right; background: none; border: none; font-size: 22px;
      line-height: 1; cursor: pointer; color: #888; padding: 0 4px;
    }
    .vbesc-close:hover { color: #333; }

    .vbesc-field { margin-bottom: 16px; }
    .vbesc-field label { display: block; font-weight: 600; font-size: 13px;
                         margin-bottom: 6px; color: #222; }
    .vbesc-field .vbesc-hint { color: #888; font-weight: normal; font-size: 12px; }
    .vbesc-radio-stack label {
      display: block; padding: 8px 10px; border: 1px solid #eee;
      border-radius: 6px; margin-bottom: 6px; cursor: pointer;
      font-weight: 400; font-size: 14px; color: #333;
      transition: background 0.1s, border-color 0.1s;
    }
    .vbesc-radio-stack label:hover { background: #fafafa; }
    .vbesc-radio-stack input[type="radio"]:checked + span { font-weight: 600; }
    .vbesc-radio-stack label:has(input:checked) {
      background: #fff4f3; border-color: #d9534f;
    }
    .vbesc-textarea {
      width: 100%; min-height: 100px; border: 1px solid #ccc;
      border-radius: 6px; padding: 10px; font-family: inherit;
      font-size: 14px; line-height: 1.4; resize: vertical; box-sizing: border-box;
    }
    .vbesc-textarea:focus { outline: none; border-color: #d9534f; }
    .vbesc-char-count { text-align: right; color: #999; font-size: 11px; margin-top: 4px; }

    .vbesc-disclose {
      background: #fafafa; border-left: 3px solid #ddd;
      padding: 10px 14px; margin: 16px 0; font-size: 13px; color: #555;
      border-radius: 0 6px 6px 0;
    }
    .vbesc-disclose summary { cursor: pointer; font-weight: 500; color: #333; }

    .vbesc-actions {
      display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
    }
    .vbesc-btn {
      padding: 10px 18px; border-radius: 6px; font-weight: 500;
      font-size: 14px; cursor: pointer; border: 1px solid transparent;
      font-family: inherit;
    }
    .vbesc-btn-primary { background: #d9534f; color: #fff; border-color: #d9534f; }
    .vbesc-btn-primary:hover { background: #c9302c; }
    .vbesc-btn-primary:disabled { background: #d9534f99; cursor: wait; }
    .vbesc-btn-secondary { background: #fff; color: #333; border-color: #ccc; }
    .vbesc-btn-secondary:hover { background: #f5f5f5; }
    .vbesc-btn-ack { background: #5bc0de; color: #fff; border-color: #5bc0de; }
    .vbesc-btn-ack:hover { background: #46b8da; }

    .vbesc-badge {
      display: inline-block; padding: 3px 9px; border-radius: 999px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .vbesc-badge-urgent { background: #d9534f; color: #fff; }
    .vbesc-badge-normal { background: #f0ad4e; color: #fff; }
    .vbesc-badge-fyi { background: #e0e0e0; color: #555; }
    .vbesc-status { display: inline-block; padding: 2px 8px; border-radius: 4px;
                    font-size: 11px; background: #eee; color: #555; margin-left: 6px; }

    .vbesc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .vbesc-table th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #eee;
                      font-weight: 600; color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .vbesc-table td { padding: 12px 8px; border-bottom: 1px solid #f4f4f4; }
    .vbesc-table tr.vbesc-clickable { cursor: pointer; }
    .vbesc-table tr.vbesc-clickable:hover { background: #fafafa; }
    .vbesc-muted { color: #999; font-style: italic; }
    .vbesc-empty { padding: 32px; text-align: center; color: #888; }

    .vbesc-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    @media (max-width: 720px) { .vbesc-detail-grid { grid-template-columns: 1fr; gap: 20px; } }
    .vbesc-reason-block {
      margin: 12px 0; padding: 14px 16px; border-left: 3px solid #d9534f;
      background: #fff8f7; font-size: 15px; line-height: 1.5; border-radius: 0 6px 6px 0;
    }
    .vbesc-snapshot-section { margin-bottom: 14px; font-size: 13px; }
    .vbesc-snapshot-section strong { color: #333; }
    .vbesc-snapshot-section ul { margin: 4px 0; padding-left: 18px; color: #555; }
    .vbesc-tp-item {
      padding: 10px 12px; background: #fafafa; border-radius: 6px;
      margin-bottom: 8px; font-size: 13px; color: #444;
    }
    .vbesc-tp-item strong { color: #222; font-weight: 600; }

    .vbesc-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #333; color: #fff; padding: 12px 22px; border-radius: 6px;
      z-index: 10000; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      font-family: -apple-system, sans-serif;
    }
  `;

  function injectStyles() {
    const el = h('style', { id: 'vbesc-styles' });
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  // ==========================================================================
  // 7. Shared UI helpers
  // ==========================================================================
  function showToast(msg, ms = 3500) {
    const t = h('div', { class: 'vbesc-toast' }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function closeOverlay() {
    document.querySelectorAll('.vbesc-overlay').forEach((el) => el.remove());
  }

  function openOverlay(cardNode, wide = false) {
    closeOverlay();
    const overlay = h('div', {
      class: 'vbesc-overlay',
      onClick: (e) => { if (e.target === overlay) closeOverlay(); },
    });
    if (wide) cardNode.classList.add('vbesc-card-wide');
    overlay.appendChild(cardNode);
    document.body.appendChild(overlay);

    // Escape key closes
    const onKey = (e) => { if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  // ==========================================================================
  // 8. Buddy UI — floating escalate button + modal
  // ==========================================================================
  function mountBuddyUI() {
    const fab = h('button', {
      class: 'vbesc-fab-buddy',
      'aria-label': 'Escalate to Dr. Rodgers',
      onClick: () => openBuddyModal(),
    }, 'Escalate to Dr. Rodgers ↗');
    document.body.appendChild(fab);
    LOG('Buddy FAB mounted');
  }

  async function openBuddyModal() {
    // Resolve which case this is about
    let caseId = CONFIG.getCurrentCaseId();
    let cases = null;
    if (!caseId) {
      cases = await loadMyCases();
      if (cases.length === 0) {
        showToast('No active cases found. Escalations are raised from a specific case.');
        return;
      }
      if (cases.length === 1) caseId = cases[0].id;
    }

    const card = h('div', { class: 'vbesc-card' });

    const close = h('button', { class: 'vbesc-close', onClick: closeOverlay }, '×');
    const title = h('h1', {}, 'Escalate to Dr. Rodgers');

    // Case selector if no case detected
    let caseSelector = null;
    if (!caseId && cases) {
      caseSelector = h('div', { class: 'vbesc-field' },
        h('label', {}, 'Which case?'),
        h('div', { class: 'vbesc-radio-stack', id: 'vbesc-case-picker' },
          ...cases.map((c, i) => h('label', {},
            h('input', { type: 'radio', name: 'esc-case', value: c.id, ...(i === 0 ? { checked: true } : {}) }),
            ' ',
            h('span', {}, `${c.pets?.name || 'Unknown pet'} (${c.pets?.species || '—'})`),
          )),
        ),
      );
    }

    const typeField = h('div', { class: 'vbesc-field' },
      h('label', {}, 'What kind of concern?'),
      h('div', { class: 'vbesc-radio-stack' },
        ...[
          ['clinical_concern', 'Something I noticed clinically'],
          ['owner_distress', 'Owner is in distress'],
          ['owner_vet_conflict', 'Owner is frustrated with their vet'],
          ['out_of_scope', 'Owner asked me something out of scope'],
          ['safety_concern', 'Potential safety concern'],
          ['unsure', "Not sure — I just want another set of eyes"],
        ].map(([val, label], i) => h('label', {},
          h('input', { type: 'radio', name: 'esc-type', value: val, ...(val === 'unsure' ? { checked: true } : {}) }),
          ' ',
          h('span', {}, label),
        )),
      ),
    );

    const priorityField = h('div', { class: 'vbesc-field' },
      h('label', {}, 'How urgent?'),
      h('div', { class: 'vbesc-radio-stack' },
        ...[
          ['urgent', 'Urgent — need a response today'],
          ['normal', 'Normal — within a few days'],
          ['fyi', 'FYI — no response needed'],
        ].map(([val, label]) => h('label', {},
          h('input', { type: 'radio', name: 'esc-priority', value: val, ...(val === 'normal' ? { checked: true } : {}) }),
          ' ',
          h('span', {}, label),
        )),
      ),
    );

    const reason = h('textarea', {
      class: 'vbesc-textarea', maxlength: 2000, rows: 4,
      placeholder: "Just describe it in your own words — no formatting needed.",
    });
    const charCount = h('div', { class: 'vbesc-char-count' }, '0 / 2000');
    reason.addEventListener('input', () => { charCount.textContent = `${reason.value.length} / 2000`; });

    const reasonField = h('div', { class: 'vbesc-field' },
      h('label', {},
        "What's going on? ",
        h('span', { class: 'vbesc-hint' }, "(the owner won't see this)"),
      ),
      reason, charCount,
    );

    const disclose = h('details', { class: 'vbesc-disclose' },
      h('summary', {}, 'Dr. Rodgers will see…'),
      h('p', {}, 'The current care plan snapshot, the last 5 touchpoints and messages, and this note. None of it is shared with the owner.'),
    );

    const submitBtn = h('button', { class: 'vbesc-btn vbesc-btn-primary' }, 'Send to Dr. Rodgers');
    const cancelBtn = h('button', { class: 'vbesc-btn vbesc-btn-secondary', onClick: closeOverlay }, 'Cancel');
    const actions = h('div', { class: 'vbesc-actions' }, cancelBtn, submitBtn);

    submitBtn.addEventListener('click', async () => {
      const type = card.querySelector('input[name="esc-type"]:checked')?.value;
      const priority = card.querySelector('input[name="esc-priority"]:checked')?.value;
      const text = reason.value.trim();
      let selectedCaseId = caseId;
      if (!selectedCaseId) {
        selectedCaseId = card.querySelector('input[name="esc-case"]:checked')?.value;
      }
      if (!text) {
        alert('Please add a quick note so Dr. Rodgers knows what you are seeing.');
        reason.focus();
        return;
      }
      if (!selectedCaseId) { alert('Please select a case.'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      try {
        await raiseEscalation({ caseId: selectedCaseId, type, priority, reason: text });
        closeOverlay();
        showToast('Sent to Dr. Rodgers. You will see a response here when it arrives.');
      } catch (e) {
        alert(`Could not send: ${e.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send to Dr. Rodgers';
      }
    });

    card.appendChild(close);
    card.appendChild(title);
    if (caseSelector) card.appendChild(caseSelector);
    card.appendChild(typeField);
    card.appendChild(priorityField);
    card.appendChild(reasonField);
    card.appendChild(disclose);
    card.appendChild(actions);
    openOverlay(card);
  }

  // ==========================================================================
  // 9. Admin UI — bell + badge + queue + detail
  // ==========================================================================
  function mountAdminUI() {
    const badge = h('span', { class: 'vbesc-fab-admin-badge vbesc-hidden', id: 'vbesc-admin-badge' }, '0');
    const fab = h('button', {
      class: 'vbesc-fab-admin',
      'aria-label': 'View escalations',
      onClick: () => openAdminQueue(),
    },
      h('span', {}, '🔔'),
      h('span', {}, 'Escalations'),
      badge,
    );
    document.body.appendChild(fab);
    LOG('Admin FAB mounted');

    refreshAdminBadge();
    setInterval(refreshAdminBadge, 60_000);

    // Realtime subscription for live badge
    try {
      state.realtimeChannel = state.sb
        .channel('vbesc-admin-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, () => {
          refreshAdminBadge();
        })
        .subscribe();
      LOG('realtime subscribed');
    } catch (e) { WARN('realtime subscribe failed', e); }

    // Deep-link routing on load
    maybeHandleDeepLink();
    window.addEventListener('hashchange', maybeHandleDeepLink);
  }

  function maybeHandleDeepLink() {
    const hash = window.location.hash || '';
    // #escalations → queue; #escalations/{id} → detail
    if (hash === '#escalations' || hash === '#escalations/') {
      openAdminQueue();
    } else if (hash.startsWith('#escalations/')) {
      const id = hash.split('/')[1];
      if (id) openAdminDetail(id);
    }
  }

  async function refreshAdminBadge() {
    const count = await loadOpenEscalationCount();
    state.openCount = count;
    const badge = document.getElementById('vbesc-admin-badge');
    if (!badge) return;
    if (count > 0) { badge.textContent = String(count); badge.classList.remove('vbesc-hidden'); }
    else { badge.classList.add('vbesc-hidden'); }
  }

  async function openAdminQueue() {
    const card = h('div', { class: 'vbesc-card' });
    const close = h('button', { class: 'vbesc-close', onClick: closeOverlay }, '×');
    card.appendChild(close);
    card.appendChild(h('h1', {}, 'Escalations'));
    card.appendChild(h('p', { class: 'vbesc-muted' }, 'Open and acknowledged. Urgent items float to the top.'));

    const list = h('div', {}, h('div', { class: 'vbesc-empty' }, 'Loading…'));
    card.appendChild(list);

    openOverlay(card, true);

    const rows = await loadAdminQueue();
    list.innerHTML = '';
    if (rows.length === 0) {
      list.appendChild(h('div', { class: 'vbesc-empty' }, 'No open escalations. Nice.'));
      return;
    }

    const table = h('table', { class: 'vbesc-table' });
    const thead = h('thead', {}, h('tr', {},
      h('th', {}, ''), h('th', {}, 'Pet'), h('th', {}, 'Buddy'),
      h('th', {}, 'Type'), h('th', {}, 'Raised'), h('th', {}, 'Status'),
    ));
    table.appendChild(thead);
    const tbody = h('tbody');
    for (const r of rows) {
      const tr = h('tr', {
        class: 'vbesc-clickable',
        onClick: () => openAdminDetail(r.id),
      },
        h('td', {}, h('span', { class: `vbesc-badge vbesc-badge-${r.priority}` }, r.priority)),
        h('td', {}, r.case?.pets?.name || '—'),
        h('td', {}, r.raiser?.name || '—'),
        h('td', {}, formatType(r.escalation_type)),
        h('td', {}, formatAgo(r.created_at)),
        h('td', {}, r.status),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    list.appendChild(table);
  }

  async function openAdminDetail(id) {
    const card = h('div', { class: 'vbesc-card' });
    const close = h('button', { class: 'vbesc-close', onClick: closeOverlay }, '×');
    card.appendChild(close);
    card.appendChild(h('div', { class: 'vbesc-empty' }, 'Loading…'));
    openOverlay(card, true);

    const esc = await loadEscalationDetail(id);
    card.innerHTML = '';
    card.appendChild(h('button', { class: 'vbesc-close', onClick: closeOverlay }, '×'));

    if (!esc) {
      card.appendChild(h('div', { class: 'vbesc-empty' }, 'Escalation not found.'));
      return;
    }

    const bundle = esc.context_bundle || {};
    const cp = bundle.care_plan_snapshot || {};
    const pet = bundle.pet || {};
    const petName = pet.name || esc.case?.pets?.name || 'the pet';
    const recentTouchpoints = bundle.recent_touchpoints || [];
    const recentMessages = bundle.recent_messages || [];

    // Back link
    const back = h('a', {
      href: '#escalations',
      onClick: (e) => { e.preventDefault(); openAdminQueue(); },
      style: { color: '#666', fontSize: '13px', textDecoration: 'none' },
    }, '← Queue');
    card.appendChild(back);

    card.appendChild(h('h1', {}, `${petName} — ${formatType(esc.escalation_type)}`));

    const grid = h('div', { class: 'vbesc-detail-grid' });

    // Left: the escalation itself
    const left = h('div');
    left.appendChild(h('div', { style: { marginBottom: '12px' } },
      h('span', { class: `vbesc-badge vbesc-badge-${esc.priority}` }, esc.priority),
      h('span', { class: 'vbesc-status' }, esc.status),
      h('span', { class: 'vbesc-status' }, formatAgo(esc.created_at)),
    ));
    left.appendChild(h('h3', {}, `From ${esc.raiser?.name || 'a Buddy'}`));
    left.appendChild(h('div', { class: 'vbesc-reason-block' }, esc.reason || '(no note)'));

    if (esc.status === 'Open') {
      const ackBtn = h('button', { class: 'vbesc-btn vbesc-btn-ack' }, 'Acknowledge');
      ackBtn.addEventListener('click', async () => {
        ackBtn.disabled = true;
        try { await acknowledgeEscalation(id); await openAdminDetail(id); refreshAdminBadge(); }
        catch (e) { alert(`Could not acknowledge: ${e.message}`); ackBtn.disabled = false; }
      });
      left.appendChild(ackBtn);
    }

    if (esc.status !== 'Resolved') {
      left.appendChild(h('h3', {}, 'Your response (visible to the Buddy)'));
      const ta = h('textarea', { class: 'vbesc-textarea' }, esc.dvm_response || '');
      left.appendChild(ta);
      const resolveBtn = h('button', {
        class: 'vbesc-btn vbesc-btn-primary',
        style: { marginTop: '10px' },
      }, 'Resolve');
      resolveBtn.addEventListener('click', async () => {
        resolveBtn.disabled = true;
        resolveBtn.textContent = 'Resolving…';
        try { await resolveEscalation(id, ta.value.trim()); await openAdminDetail(id); refreshAdminBadge(); }
        catch (e) { alert(`Could not resolve: ${e.message}`); resolveBtn.disabled = false; resolveBtn.textContent = 'Resolve'; }
      });
      left.appendChild(resolveBtn);
    } else {
      left.appendChild(h('h3', {}, 'Your response'));
      left.appendChild(h('div', { class: 'vbesc-reason-block', style: { borderColor: '#5cb85c', background: '#f6fbf6' } },
        esc.dvm_response || '(no response)'));
      left.appendChild(h('p', { class: 'vbesc-muted', style: { fontSize: '12px' } },
        `Resolved ${formatAgo(esc.resolved_at)}`));
    }

    grid.appendChild(left);

    // Right: frozen context bundle
    const right = h('div');
    right.appendChild(h('h3', {}, `Care plan snapshot (at escalation)`));

    const snapshot = h('div', { class: 'vbesc-snapshot-section' });
    snapshot.appendChild(h('p', {}, `Completeness: ${cp.completeness_score ?? '—'}/100`));
    snapshot.appendChild(renderListSection('Diagnoses', cp.active_diagnoses, 'condition_name'));
    snapshot.appendChild(renderListSection('Medications', cp.active_medications, 'name'));
    snapshot.appendChild(renderListSection('Goals', cp.active_goals, 'goal_text'));
    snapshot.appendChild(renderListSection('Open questions', cp.open_questions, 'question'));
    if (cp.owner_context_excerpt) {
      snapshot.appendChild(h('p', { style: { color: '#666', fontStyle: 'italic', fontSize: '13px' } },
        cp.owner_context_excerpt));
    }
    right.appendChild(snapshot);

    right.appendChild(h('h3', {}, 'Recent touchpoints'));
    if (recentTouchpoints.length === 0) {
      right.appendChild(h('p', { class: 'vbesc-muted' }, 'None'));
    } else {
      for (const tp of recentTouchpoints) {
        right.appendChild(h('div', { class: 'vbesc-tp-item' },
          h('strong', {}, formatAgo(tp.created_at)),
          ' · ',
          h('span', {}, tp.summary || '(empty)'),
        ));
      }
    }

    right.appendChild(h('h3', {}, 'Recent messages'));
    if (recentMessages.length === 0) {
      right.appendChild(h('p', { class: 'vbesc-muted' }, 'None'));
    } else {
      for (const m of recentMessages) {
        right.appendChild(h('div', { class: 'vbesc-tp-item' },
          h('strong', {}, `${m.sender_role} · ${formatAgo(m.created_at)}`),
          ': ',
          h('span', {}, m.content_excerpt || '(empty)'),
        ));
      }
    }

    grid.appendChild(right);
    card.appendChild(grid);
  }

  function renderListSection(label, arr, key) {
    const wrap = h('div', { style: { marginBottom: '8px' } });
    wrap.appendChild(h('strong', {}, label + ': '));
    if (!arr || arr.length === 0) {
      wrap.appendChild(h('span', { class: 'vbesc-muted' }, 'none'));
    } else {
      const ul = h('ul');
      for (const item of arr) {
        ul.appendChild(h('li', {}, item[key] || ''));
      }
      wrap.appendChild(ul);
    }
    return wrap;
  }

  // ==========================================================================
  // 10. Initialization
  // ==========================================================================
  async function waitFor(fn, timeoutMs, intervalMs = 150) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = fn();
      if (result) return result;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  }

  async function init() {
    // 1. Find Supabase client
    const sb = await waitFor(findSupabaseClient, 30_000);
    if (!sb) {
      WARN('Supabase client not found on window after 30s. Aborting mount.');
      return;
    }
    state.sb = sb;
    state.supabaseUrl = extractSupabaseUrl(sb);
    LOG('Supabase client detected', state.supabaseUrl ? `(url=${state.supabaseUrl})` : '');

    // 2. Wait for auth
    const userResult = await waitFor(async () => {
      try {
        const { data: { user } } = await sb.auth.getUser();
        return user || null;
      } catch (e) { return null; }
    }, 30_000);

    if (!userResult) {
      LOG('No authenticated user after 30s. Will retry on next auth change.');
      sb.auth.onAuthStateChange((event, session) => {
        if (session?.user && !state.user) {
          LOG('auth ready via onAuthStateChange');
          init();
        }
      });
      return;
    }
    state.user = userResult;

    // 3. Resolve role + user row
    const { data: userRow, error: userErr } = await sb
      .from('users')
      .select('id, role, name')
      .eq('auth_id', userResult.id)
      .single();

    if (userErr || !userRow) {
      WARN('Could not resolve users row', userErr);
      return;
    }
    state.userId = userRow.id;
    state.role = userRow.role;
    state.name = userRow.name;
    LOG(`Authenticated as ${state.name} (role=${state.role})`);

    // 4. Mount styles once
    if (!document.getElementById('vbesc-styles')) injectStyles();

    // 5. Role-specific mounts
    if (state.role === 'vet_buddy') {
      mountBuddyUI();
    } else if (state.role === 'admin') {
      mountAdminUI();
    } else {
      LOG(`role="${state.role}" has no escalation UI; mounting nothing`);
    }
  }

  // ==========================================================================
  // 11. Kick off
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a small API on window for debugging and manual invocation
  window.VB_ESC = {
    version: VERSION,
    state,
    raiseEscalation,
    openAdminQueue: () => state.role === 'admin' ? openAdminQueue() : WARN('not admin'),
    openBuddyModal: () => state.role === 'vet_buddy' ? openBuddyModal() : WARN('not vet_buddy'),
    refreshBadge: refreshAdminBadge,
  };
})();
