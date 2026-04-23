#!/usr/bin/env node
// One-shot backfill: runs the "Refresh care plan from activity" flow
// against each case and writes the extraction directly to care_plans /
// pet_medications / pet_vaccines / pet_vitals / timeline_entries. This
// BYPASSES the in-app review modal — Claude's output lands in pet records
// with no human confirmation per-item. Defaults to --dry-run.
//
// Requires Node 18+ (uses native fetch).
//
// Required env:
//   SUPABASE_URL                project URL, e.g. https://utckzviqaeyktlfkhmtb.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   service role key — used for REST reads/writes (bypasses RLS)
//   SUPABASE_ANON_KEY           anon key — used as `apikey` header for edge function invoke
//   SUPABASE_BULK_JWT           a fresh user access_token for a DVM/admin user.
//                               Grab from the browser console while signed in:
//                                 (await window.sb.auth.getSession()).data.session.access_token
//
// Usage:
//   node scripts/bulk-care-plan-refresh.js                          # dry run, 5 newest cases
//   node scripts/bulk-care-plan-refresh.js --limit 20               # dry run, 20 cases
//   node scripts/bulk-care-plan-refresh.js --case-id <uuid>         # dry run, single case
//   node scripts/bulk-care-plan-refresh.js --commit --limit 5       # writes, 5 cases
//   node scripts/bulk-care-plan-refresh.js --commit --all           # writes, every case

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = args[i + 1];
  return (next && !next.startsWith('--')) ? next : fallback;
}

const DRY_RUN = !flag('commit');
const ALL = flag('all');
const LIMIT = Number(opt('limit', ALL ? 9999 : 5));
const CASE_ID = opt('case-id', null);
const SINCE_DAYS = Number(opt('since-days', 90));
const MIN_MESSAGES = Number(opt('min-messages', 1));
const DELAY_MS = Number(opt('delay-ms', 800));
const SKIP_RECENT_HOURS = Number(opt('skip-recent-hours', 1));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BULK_JWT = process.env.SUPABASE_BULK_JWT;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
if (!BULK_JWT) missing.push('SUPABASE_BULK_JWT');
if (missing.length) { console.error('Missing env: ' + missing.join(', ')); process.exit(1); }

const REST = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
const FN = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1';

const auditPath = path.join(__dirname, `bulk-care-plan-refresh.${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
const logAudit = (obj) => fs.appendFileSync(auditPath, JSON.stringify(obj) + '\n');

async function rest(method, pathAndQuery, body) {
  const url = REST + pathAndQuery;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : '',
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST ${method} ${pathAndQuery} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function invokeFn(body) {
  const res = await fetch(FN + '/extract-medical-record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + BULK_JWT,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new Error('Edge function 401 — SUPABASE_BULK_JWT is missing or expired. Grab a fresh one from the browser console and retry.');
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Edge fn ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function fetchCases() {
  if (CASE_ID) {
    return await rest('GET', `/cases?id=eq.${CASE_ID}&select=id,pet_id,status,pets(id,name,species)`);
  }
  return await rest('GET', `/cases?select=id,pet_id,status,pets(id,name,species)&order=created_at.desc&limit=${LIMIT}`);
}

async function buildTextBundle(caseId) {
  const sinceIso = new Date(Date.now() - SINCE_DAYS * 86400000).toISOString();
  const since = encodeURIComponent(sinceIso);
  const [messages, notes, timeline, appts, escs] = await Promise.all([
    rest('GET', `/messages?case_id=eq.${caseId}&created_at=gte.${since}&select=created_at,content,sender_role,thread_type,is_urgent,attachment_name&order=created_at.asc&limit=300`),
    rest('GET', `/case_notes?case_id=eq.${caseId}&created_at=gte.${since}&select=created_at,content,author:users!created_by(name,role)&order=created_at.asc&limit=100`),
    rest('GET', `/timeline_entries?case_id=eq.${caseId}&created_at=gte.${since}&select=created_at,type,content,author:users!author_id(name,role)&order=created_at.asc&limit=200`),
    rest('GET', `/appointments?case_id=eq.${caseId}&select=scheduled_at,title,type,notes,status&order=scheduled_at.asc&limit=50`),
    rest('GET', `/escalations?case_id=eq.${caseId}&created_at=gte.${since}&select=created_at,escalation_type,reason,incident_notes,status&order=created_at.asc&limit=30`),
  ]);

  const fmt = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') : '');
  const lines = [];

  if (messages.length) {
    lines.push(`=== Messages (${messages.length}) ===`);
    for (const m of messages) {
      if (!m.content) continue;
      const who = `${m.sender_role || '?'}${m.thread_type === 'staff' ? ' [staff-only]' : ''}${m.is_urgent ? ' [URGENT]' : ''}`;
      const att = m.attachment_name ? ` (attached: ${m.attachment_name})` : '';
      lines.push(`[${fmt(m.created_at)}] ${who}: ${m.content}${att}`);
    }
  }
  if (notes.length) {
    lines.push(`\n=== Internal case notes (${notes.length}) ===`);
    for (const n of notes) {
      const who = n.author ? `${n.author.name || 'staff'} (${n.author.role || ''})` : 'staff';
      lines.push(`[${fmt(n.created_at)}] ${who}: ${n.content}`);
    }
  }
  if (timeline.length) {
    lines.push(`\n=== Timeline entries (${timeline.length}) ===`);
    for (const t of timeline) {
      const who = t.author ? `${t.author.name || ''} (${t.author.role || ''})` : '';
      lines.push(`[${fmt(t.created_at)}] ${t.type || 'update'} — ${who}: ${t.content}`);
    }
  }
  if (appts.length) {
    lines.push(`\n=== Appointments (${appts.length}) ===`);
    for (const a of appts) {
      const parts = [a.type, a.title].filter(Boolean).join(' · ');
      const st = a.status ? ` [${a.status}]` : '';
      const np = a.notes ? ` — notes: ${a.notes}` : '';
      lines.push(`[${fmt(a.scheduled_at)}]${st} ${parts}${np}`);
    }
  }
  if (escs.length) {
    lines.push(`\n=== Escalations (${escs.length}) ===`);
    for (const e of escs) {
      const parts = [e.escalation_type, e.status].filter(Boolean).join(' · ');
      const np = e.incident_notes ? ` — ${e.incident_notes}` : '';
      const rp = e.reason ? ` — reason: ${e.reason}` : '';
      lines.push(`[${fmt(e.created_at)}] ${parts}${rp}${np}`);
    }
  }

  return { bundle: lines.join('\n'), messageCount: messages.length };
}

async function loadExistingCarePlan(caseId) {
  const rows = await rest('GET', `/care_plans?case_id=eq.${caseId}&select=id,content,pet_id,updated_at`);
  return rows[0] || null;
}

function parsePlanContent(contentStr) {
  if (!contentStr) return null;
  try {
    const p = JSON.parse(contentStr);
    if (p && typeof p === 'object' && 'pet_profile' in p) return p;
  } catch {}
  return null;
}

async function applyExtraction(caseRow, ext, existingCp) {
  const petId = caseRow.pet_id;
  const caseId = caseRow.id;
  const applied = [];

  for (const med of ext.medications || []) {
    if (!med?.name) continue;
    await rest('POST', '/pet_medications', {
      pet_id: petId, case_id: caseId, name: med.name,
      dose: med.dose || null, frequency: med.frequency || null,
      start_date: med.start_date || null,
    });
    applied.push('med:' + med.name);
  }
  for (const vax of ext.vaccines || []) {
    if (!vax?.name) continue;
    await rest('POST', '/pet_vaccines', {
      pet_id: petId, name: vax.name,
      administered_date: vax.administered_date || null,
      due_date: vax.due_date || null,
      notes: vax.notes || null,
    });
    applied.push('vax:' + vax.name);
  }
  if (ext.vitals?.weight || ext.vitals?.temperature) {
    await rest('POST', '/pet_vitals', {
      pet_id: petId,
      weight: ext.vitals.weight || null,
      temperature: ext.vitals.temperature || null,
      notes: 'AI-extracted from activity digest (bulk)',
    });
    applied.push('vitals');
  }

  const lp = parsePlanContent(existingCp?.content) || {
    pet_profile: '', care_team: [], active_care_goals: [], engagement_log: [], milestones_and_wins: [],
  };
  lp.pet_profile = lp.pet_profile || '';
  lp.care_team = lp.care_team || [];
  lp.active_care_goals = lp.active_care_goals || [];
  lp.engagement_log = lp.engagement_log || [];
  lp.milestones_and_wins = lp.milestones_and_wins || [];

  if (ext.pet_profile_additions) {
    const dateStr = ext.document_date || new Date().toISOString().slice(0, 10);
    lp.pet_profile = lp.pet_profile + `\n[${dateStr}] ${ext.pet_profile_additions}`;
    applied.push('profile');
  }
  for (const g of ext.care_goals || []) {
    if (!g) continue;
    lp.active_care_goals.push({
      goal_text: g, set_by_owner: false,
      created_at: new Date().toISOString(),
      status: 'active', dvm_reviewed: false,
    });
    applied.push('goal');
  }
  lp.engagement_log.push({
    entry_text: `AI activity-digest extraction: ${ext.summary || ''}`.slice(0, 600),
    created_by: 'AI Assistant (bulk)',
    created_at: new Date().toISOString(),
  });

  const payload = { content: JSON.stringify(lp), updated_at: new Date().toISOString() };
  if (existingCp?.id) {
    await rest('PATCH', `/care_plans?id=eq.${existingCp.id}`, payload);
  } else {
    await rest('POST', '/care_plans', { ...payload, case_id: caseId, pet_id: petId });
  }

  const tlSummary = [
    ext.summary,
    ext.diagnoses?.length ? 'Diagnoses: ' + ext.diagnoses.join(', ') : '',
    `Applied ${applied.length} items`,
  ].filter(Boolean).join(' | ');

  await rest('POST', '/timeline_entries', {
    case_id: caseId,
    type: 'update',
    content: `🤖 AI Activity Digest — ${tlSummary}`.slice(0, 2000),
    is_client_visible: false,
  });

  return applied;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'COMMIT (writing to database)'}`);
  console.log(`Filter: limit=${LIMIT} since_days=${SINCE_DAYS} min_messages=${MIN_MESSAGES} skip_recent_hours=${SKIP_RECENT_HOURS}`);
  console.log(`Audit log: ${auditPath}`);

  const cases = await fetchCases();
  console.log(`Cases to process: ${cases.length}`);
  if (!cases.length) return;

  let ok = 0, skipped = 0, failed = 0;
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const pet = c.pets?.name || 'unknown';
    const species = c.pets?.species || 'pet';
    const tag = c.id.slice(0, 8);
    console.log(`\n[${i + 1}/${cases.length}] ${tag} — ${pet} (${species}) — status=${c.status || '?'}`);
    try {
      const existingCp = await loadExistingCarePlan(c.id);
      if (existingCp?.updated_at) {
        const ageHrs = (Date.now() - new Date(existingCp.updated_at).getTime()) / 3600000;
        if (ageHrs < SKIP_RECENT_HOURS) {
          console.log(`  skipped (care_plan updated ${ageHrs.toFixed(1)}h ago, within skip_recent_hours=${SKIP_RECENT_HOURS})`);
          skipped++;
          logAudit({ case_id: c.id, status: 'skipped_recent', age_hours: ageHrs });
          continue;
        }
      }
      const { bundle, messageCount } = await buildTextBundle(c.id);
      if (messageCount < MIN_MESSAGES) {
        console.log(`  skipped (${messageCount} messages < min_messages=${MIN_MESSAGES})`);
        skipped++;
        logAudit({ case_id: c.id, status: 'skipped_low_activity', message_count: messageCount });
        continue;
      }
      const existingSummary = (() => {
        const lp = parsePlanContent(existingCp?.content);
        if (!lp) return '';
        const parts = [];
        if (lp.pet_profile) parts.push('Pet profile: ' + String(lp.pet_profile).slice(0, 1200));
        if (lp.active_care_goals?.length) {
          const open = lp.active_care_goals.filter((g) => g.status !== 'completed').map((g) => g.goal_text).filter(Boolean);
          if (open.length) parts.push('Active goals: ' + open.join(' | '));
        }
        return parts.join('\n');
      })();

      const result = await invokeFn({
        mode: 'text_bundle',
        text_bundle: bundle,
        existing_plan_summary: existingSummary,
        case_id: c.id,
        pet_name: pet,
        pet_species: species,
      });
      if (!result.success || !result.extraction) {
        console.log(`  extraction failed: ${result.error || 'unknown'}`);
        failed++;
        logAudit({ case_id: c.id, status: 'extract_failed', error: result.error });
        continue;
      }
      const ext = result.extraction;
      const counts = {
        diag: ext.diagnoses?.length || 0,
        meds: ext.medications?.length || 0,
        vax: ext.vaccines?.length || 0,
        vit: (ext.vitals?.weight || ext.vitals?.temperature) ? 1 : 0,
        goals: ext.care_goals?.length || 0,
        prof: ext.pet_profile_additions ? 1 : 0,
      };
      console.log(`  proposed: ${JSON.stringify(counts)}`);
      if (ext.summary) console.log(`  summary: ${ext.summary.slice(0, 200)}`);
      if (DRY_RUN) {
        logAudit({ case_id: c.id, status: 'dry_run', counts, extraction: ext });
      } else {
        const applied = await applyExtraction(c, ext, existingCp);
        console.log(`  applied: ${applied.length} items -> ${applied.slice(0, 8).join(', ')}${applied.length > 8 ? '…' : ''}`);
        logAudit({ case_id: c.id, status: 'committed', counts, applied });
      }
      ok++;
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
      logAudit({ case_id: c.id, status: 'error', error: err.message });
      if (/SUPABASE_BULK_JWT/.test(err.message)) {
        console.error('Aborting — fix the JWT and re-run.');
        break;
      }
    }
    if (i < cases.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone.  ok=${ok}  skipped=${skipped}  failed=${failed}  mode=${DRY_RUN ? 'DRY RUN' : 'COMMIT'}`);
  console.log(`Audit: ${auditPath}`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
