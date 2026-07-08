// Mock @supabase/supabase-js UMD build for local UI verification.
(function () {
  const AUTH_USER = { id: 'auth-1', email: 'jrodgersdvm@gmail.com' };
  const SESSION = { user: AUTH_USER, access_token: 'fake' };
  const PROFILE = {
    id: 'u1', auth_id: 'auth-1', role: 'client', name: 'Jake Rodgers',
    email: 'jrodgersdvm@gmail.com', subscription_status: 'trialing',
    trial_ends_at: new Date(Date.now() + 10 * 864e5).toISOString(),
    dark_mode: false, avatar_initials: 'JR', avatar_color: '#689562',
  };
  const BUDDY = { id: 'b1', name: 'Maya Chen', avatar_initials: 'MC', avatar_color: '#336026', bio: 'Here to help you carry the weight.', response_time: null };
  const PETS = [
    { id: 'p1', name: 'Percy', species: 'dog', breed: 'Corgi', dob: '2019-04-01', photo_url: null, owner_id: 'u1', care_story: null, legacy_mode: false, owner: { id: 'u1', name: 'Jake Rodgers' } },
    { id: 'p2', name: 'Willow', species: 'cat', breed: 'Tabby', dob: '2021-08-15', photo_url: null, owner_id: 'u1', care_story: null, legacy_mode: false, owner: { id: 'u1', name: 'Jake Rodgers' } },
  ];
  const CASES = [
    { id: 'c1', pet_id: 'p1', assigned_buddy_id: 'b1', status: 'active', subscription_tier: 'Buddy', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), pets: PETS[0], assigned_buddy: BUDDY },
    { id: 'c2', pet_id: 'p2', assigned_buddy_id: 'b1', status: 'active', subscription_tier: 'Buddy', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), pets: PETS[1], assigned_buddy: BUDDY },
  ];
  const MEDS = {
    p1: [{ id: 'm1', pet_id: 'p1', name: 'Gabapentin', dose: '100 mg', frequency: 'With breakfast', is_active: true }],
    p2: [],
  };
  const APPTS = [
    // Stable timestamp (day-aligned) so reloads see the same appointment,
    // like a real backend would.
    { id: 'a1', case_id: 'c1', title: 'Recheck', scheduled_at: new Date((Math.floor(Date.now() / 864e5) + 10) * 864e5).toISOString() },
  ];
  const dayISO = (offset) => new Date((Math.floor(Date.now() / 864e5) + offset) * 864e5).toISOString().slice(0, 10);
  const OPEN_QUESTIONS = [
    { id: 'q1', care_plan_id: 'cp1', question: 'Is it ok to give Percy salmon as a treat?', context: 'I already do — am I causing issues?', status: 'open' },
    { id: 'q2', care_plan_id: 'cp1', question: "Is Percy's weight where it should be?", status: 'open' },
  ];
  const DIAGNOSES = [
    { id: 'd1', care_plan_id: 'cp1', condition_name: 'Early arthritis', diagnosed_on: dayISO(-120) },
  ];
  const VACCINES = [
    { id: 'v1', pet_id: 'p1', name: 'Rabies Vaccination', administered_date: dayISO(-425), due_date: dayISO(-60) },
    { id: 'v2', pet_id: 'p1', name: 'DA2PP Vaccination', administered_date: dayISO(-351), due_date: dayISO(14) },
    { id: 'v3', pet_id: 'p1', name: 'Bordetella Vaccination', administered_date: dayISO(-125), due_date: dayISO(240) },
  ];
  const VITALS = [
    { id: 'w1', pet_id: 'p1', weight: '28 lb', recorded_at: dayISO(-20) },
  ];
  let insertSeq = 0;
  const insertedRows = {}; // table -> rows written this session, so inserts read back

  function resultFor(q) {
    const t = q._table;
    if (q._insert) {
      const row = Object.assign({ id: 'ins-' + (++insertSeq) }, Array.isArray(q._insert) ? q._insert[0] : q._insert);
      (insertedRows[t] = insertedRows[t] || []).push(row);
      return q._single ? { data: row, error: null } : { data: [row], error: null };
    }
    let rows = [];
    if (t === 'users') rows = [PROFILE];
    else if (t === 'care_plans') rows = q._eqs['case_id'] === 'c1'
      ? [{ id: 'cp1', case_id: 'c1', summary: 'Managing early arthritis', diet_notes: 'Joint-support kibble', pet_profile: 'Sweet corgi, food-motivated' }]
      : [];
    else if (t === 'cases') rows = q._eqs['id'] ? CASES.filter(c => c.id === q._eqs['id']) : CASES;
    else if (t === 'pet_medications') rows = MEDS[q._eqs['pet_id']] || [];
    else if (t === 'appointments') rows = APPTS.filter(a => !q._eqs['case_id'] || a.case_id === q._eqs['case_id']);
    else if (t === 'care_plan_open_questions') rows = OPEN_QUESTIONS.filter(r => r.care_plan_id === q._eqs['care_plan_id']);
    else if (t === 'care_plan_diagnoses') rows = DIAGNOSES.filter(r => r.care_plan_id === q._eqs['care_plan_id']);
    else if (t === 'pet_vaccines') rows = VACCINES.filter(r => r.pet_id === q._eqs['pet_id']);
    else if (t === 'pet_vitals') rows = VITALS.filter(r => r.pet_id === q._eqs['pet_id']);
    // everything else: rows inserted this session (matching any eq filters), else empty
    if (!rows.length && insertedRows[t]) {
      rows = insertedRows[t].filter(r => Object.entries(q._eqs).every(([k, v]) => r[k] === v));
    }
    if (q._single === 'single') return { data: rows[0] || null, error: rows[0] ? null : { message: 'Row not found', code: 'PGRST116' } };
    if (q._single === 'maybe') return { data: rows[0] || null, error: null };
    return { data: rows, error: null, count: rows.length };
  }

  function makeBuilder(table) {
    const q = { _table: table, _eqs: {}, _single: false };
    const chain = ['select', 'order', 'limit', 'gte', 'lte', 'lt', 'gt', 'in', 'is', 'or', 'not', 'neq', 'ilike', 'like', 'range', 'match', 'contains', 'overlaps', 'filter', 'update', 'upsert', 'delete'];
    chain.forEach(m => { q[m] = () => q; });
    q.insert = (row) => { q._insert = row; return q; };
    q.eq = (k, v) => { q._eqs[k] = v; return q; };
    q.single = () => { q._single = 'single'; return q; };
    q.maybeSingle = () => { q._single = 'maybe'; return q; };
    q.then = (res, rej) => Promise.resolve(resultFor(q)).then(res, rej);
    q.catch = (rej) => Promise.resolve(resultFor(q)).catch(rej);
    return q;
  }

  function makeClient() {
    return {
      auth: {
        onAuthStateChange(cb) {
          setTimeout(() => cb('INITIAL_SESSION', SESSION), 30);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        getSession: async () => ({ data: { session: SESSION }, error: null }),
        getUser: async () => ({ data: { user: AUTH_USER }, error: null }),
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ data: {}, error: null }),
        signInWithPassword: async () => ({ data: { session: SESSION }, error: null }),
        resetPasswordForEmail: async () => ({ data: {}, error: null }),
      },
      from: makeBuilder,
      rpc: (name) => Promise.resolve({ data: name === 'current_user_has_password' ? true : (name === 'get_care_team_directory' ? [] : null), error: null }),
      channel: () => { const ch = {}; ch.on = () => ch; ch.subscribe = () => ch; ch.unsubscribe = () => {}; ch.send = () => {}; return ch; },
      removeChannel() {}, removeAllChannels() {},
      storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      functions: { invoke: async () => ({ data: null, error: null }) },
    };
  }

  window.supabase = { createClient: makeClient };
})();
