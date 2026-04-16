    // ============================================
    // CONSTANTS & SUPABASE INIT
    // ============================================
    const { createClient } = window.supabase;
    const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    const VAPID_PUBLIC_KEY = CONFIG.VAPID_PUBLIC_KEY;

    // Pagination, paginate(), renderPagination() are in utils.js
    const pagination = { cases: 1, messages: 1, auditLog: 1, inbox: 1 };

    const COLORS = ['#689562', '#336026', '#3498db', '#9b59b6', '#e67e22', '#e74c3c'];
    const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇', other: '🐾' };
    const TIER_DISPLAY = { 'Buddy': 'Buddy', 'Buddy+': 'Buddy+', 'Buddy VIP': 'Buddy VIP', buddy: 'Buddy', buddy_plus: 'Buddy+', buddy_vip: 'Buddy VIP', 'Trial': '🎉 Free Trial' };

    // ── Lazy script loader (Chart.js, jsPDF loaded on demand) ──
    const _loadedScripts = {};
    function loadScript(url) {
      if (_loadedScripts[url]) return _loadedScripts[url];
      _loadedScripts[url] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return _loadedScripts[url];
    }
    function ensureChartJS() { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'); }
    function ensureJsPDF() { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }

    // ============================================
    // STATE
    // ============================================
    const state = {
      user: null,
      profile: null,
      view: 'login',
      caseId: null,
      caseTab: 'careplan',
      sidebarOpen: false,
      unreadCount: 0,
      clientUnreadCount: 0,
      cases: [],
      currentCase: null,
      geneticInsights: [],
      geneticCaseTab: 'overview',
      carePlan: null,
      messages: [],
      realtimeChannel: null,
      timelineEntries: [],
      showAddAppt: false,
      editingApptId: null,
      showAddTimeline: false,
      showRaiseEscalation: false,
      showEditPet: false,
      showCreateCase: false,
      showNotifications: false,
      showInviteVet: false,
      showAddCareTeam: false,
      showAddGoal: false,
      showAddLogEntry: false,
      showAddMilestone: false,
      urgencyToggle: false,
      showTransitionPanel: false,
      transitionBuddyId: null,
      transitionBuddyName: '',
      activePetIndex: 0,
      notifications: [],
      allClients: [],
      resources: [],
      documents: [],
      showBroadcast: false,
      touchpoints: [],
      appointments: [],
      escalations: [],
      teamMembers: [],
      inboxMessages: [],
      // New state for 30 features
      petVitals: [],
      petMedications: [],
      petVaccines: [],
      caseNotes: [],
      cannedResponses: [],
      touchpointTemplates: [],
      buddyAvailability: [],
      showCannedResponses: false,
      showTemplates: false,
      showAvailability: false,
      showHandoff: false,
      showAddMed: false,
      showAddVitals: false,
      showAddVaccine: false,
      showAddNote: false,
      showReferral: false,
      messageThread: 'client', // 'client' | 'staff'
      analyticsData: null,
      pwaInstallPrompt: null,
      broadcastFilters: { tier: '', species: '', buddyId: '' },
      caseTags: [],
      darkMode: false,
      showLightbox: false, lightboxUrl: '', lightboxTitle: '',
      showSurvey: false, surveyRating: 0, surveyTarget: null, surveys: [],
      faqArticles: [], faqSearch: '', faqCategory: 'All', expandedFaq: null,
      kbMessages: [], kbConversationId: null, kbConversations: [], kbLoading: false, kbViewingConvId: null,
      auditLog: [], auditLogs: [], auditActionFilter: 'All', auditEntityFilter: 'All',
      handoffNotes: [], showHandoffForm: false,
      referralStats: { total: 0, converted: 0, pending: 0 },
      showPricingModal: false, healthTimelineEntries: [],
      showNotifSettings: false, show2FA: false,
      notificationSettings: { email_messages: true, email_escalations: true, weekly_digest: false, push_enabled: false },
      notificationPermission: 'default',
      globalNotifChannel: null,
      notifiedMessageIds: new Set(),
      petCoOwners: [], coOwnerInviteEmail: '', pendingCoOwnerInvites: [],
      showAddResource: false,
      availableBuddies: [], selectedBuddyId: null, referredByBuddyId: null,
      // AI Medical Record Extraction
      aiExtractionInProgress: false,
      aiExtractionResult: null,
      aiExtractionDocId: null,
      aiExtractionDocName: '',
      showAiReviewModal: false,
      aiCheckedItems: {},
      // Typing indicators
      typingUsers: {},
      _typingTimeout: null,
      // Push notification prompt
      showPushPromptBanner: false,
      showPushPromptInPanel: false,
    };

    // ── HTML escape utility (prevents XSS in user-generated content) ──
    // esc() is defined in utils.js

    function navigate(view, params = {}) {
      if (state.view === 'knowledge-base' && view !== 'knowledge-base') state._kbLoaded = false;
      // Clean up realtime subscription when leaving a case view
      const caseViews = ['client-case', 'buddy-case', 'external-case', 'geneticist-case'];
      if (caseViews.includes(state.view) && !caseViews.includes(view) && state.realtimeChannel) {
        sb.removeChannel(state.realtimeChannel);
        state.realtimeChannel = null;
        state.typingUsers = {};
      }
      state.view = view;
      if (params.caseId) state.caseId = params.caseId;
      if (params.caseTab) state.caseTab = params.caseTab;
      render();
    }

    // ============================================
    // UI HELPERS (renderBadge, renderAvatar, etc. in utils.js)
    // ============================================

    // ── Pet Photo Helpers ─────────────────────────────────────────────────
    function renderPetPhoto(pet, size = 'hero', showChangeBtn = false) {
      const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';
      const imgSrc = pet?.photo_url || null;
      const changeBtn = showChangeBtn ? `<button class="pet-photo-change-btn" data-action="change-pet-photo" data-pet-id="${pet?.id}">📷 Change Photo</button>` : '';

      if (size === 'hero') {
        if (imgSrc) {
          return `<div style="position:relative; display:inline-block; text-align:center;">
            <img src="${esc(imgSrc)}" alt="${esc(pet?.name)}" class="pet-photo-hero">
            ${changeBtn}
          </div>`;
        }
        return `<div style="position:relative; display:inline-block; text-align:center;">
          <div class="pet-photo-hero-placeholder">${emoji}</div>
          ${changeBtn}
        </div>`;
      }

      if (size === 'card') {
        if (imgSrc) return `<img src="${esc(imgSrc)}" alt="${esc(pet?.name)}" class="pet-photo-card" loading="lazy">`;
        return `<div class="pet-photo-card-placeholder">${emoji}</div>`;
      }

      if (size === 'thumb') {
        if (imgSrc) return `<img src="${esc(imgSrc)}" alt="${esc(pet?.name)}" class="pet-photo-thumb" loading="lazy">`;
        return `<div class="pet-photo-thumb-placeholder">${emoji}</div>`;
      }

      return '';
    }

    // compressImage() is defined in utils.js

    async function uploadPetPhoto(file, petId) {
      if (!file || !petId) return null;
      // Compress large images before uploading
      let uploadFile = file;
      try {
        uploadFile = await compressImage(file);
      } catch (compErr) {
        console.warn('Image compression failed, uploading original:', compErr);
      }
      const path = `pets/${petId}/photo.jpg`;
      const { error: uploadErr } = await sb.storage.from('pet-photos').upload(path, uploadFile, {
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (uploadErr) throw uploadErr;
      const { data: urlData, error: urlErr } = await sb.storage.from('pet-photos').createSignedUrl(path, 60 * 60 * 24 * 7); // 7-day signed URL
      if (urlErr) throw urlErr;
      const photoUrl = urlData.signedUrl + '&t=' + Date.now();
      const { error: updateErr } = await sb.from('pets').update({ photo_url: photoUrl }).eq('id', petId);
      if (updateErr) throw updateErr;
      return photoUrl;
    }

    // ── Care Gamification: XP & Badges ──────────────────────────────────
    const XP_MAP = {
      medication_logged: 10,
      vaccine_recorded: 20,
      touchpoint_completed: 15,
      care_plan_updated: 10,
      appointment_logged: 25,
      vital_recorded: 10,
      message_sent: 5,
      team_member_invited: 15,
      care_request_posted: 5,
      care_checkin: 10,
    };

    const COMMUNITY_XP_MAP = {
      team_invite_accepted: 10,
      joined_as_helper: 10,
      care_request_claimed: 15,
      care_request_completed: 20,
      assisted_another_pet: 10,
    };

    const LEVEL_THRESHOLDS = [
      { level: 1, xp: 0, label: 'Newcomer' },
      { level: 2, xp: 50, label: 'Engaged' },
      { level: 3, xp: 150, label: 'Committed' },
      { level: 4, xp: 300, label: 'Champion' },
      { level: 5, xp: 500, label: 'Guardian' },
    ];

    const BADGE_DEFINITIONS = {
      streak_7:          { emoji: '🔥', label: '7-Day Streak', order: 1 },
      vaccines_current:  { emoji: '🛡', label: 'Vaccines Current', order: 2 },
      engaged_owner:     { emoji: '💬', label: 'Engaged Owner', order: 3 },
      goal_setter:       { emoji: '🎯', label: 'Goal Setter', order: 4 },
      first_visit:       { emoji: '🏥', label: 'First Visit', order: 5 },
      fifth_visit:       { emoji: '⭐', label: 'Dedicated', order: 6 },
      health_tracker:    { emoji: '📊', label: 'Health Tracker', order: 7 },
    };

    const COMMUNITY_BADGE_DEFINITIONS = {
      first_helper:      { emoji: '🤝', label: 'First Helper', unlock: 'Join a care team as a helper' },
      care_ally:         { emoji: '🌟', label: 'Care Ally', unlock: 'Claim 3 care requests' },
      team_builder:      { emoji: '👥', label: 'Team Builder', unlock: 'Build 3 care teams' },
      neighbor_care:     { emoji: '🏘', label: 'Neighbor Care', unlock: 'Complete 5 care requests' },
      community_pillar:  { emoji: '🌱', label: 'Community Pillar', unlock: 'Reach 100 community score' },
      care_village:      { emoji: '🏡', label: 'Care Village', unlock: 'Help 5+ distinct pets' },
    };

    function getLevelForXP(xp) {
      let result = LEVEL_THRESHOLDS[0];
      for (const t of LEVEL_THRESHOLDS) {
        if (xp >= t.xp) result = t;
      }
      return result;
    }

    function getNextLevelThreshold(currentLevel) {
      const next = LEVEL_THRESHOLDS.find(t => t.level === currentLevel + 1);
      return next || null;
    }

    // ── Pet-level badge helpers ──
    async function awardBadge(petId, badgeType) {
      const def = BADGE_DEFINITIONS[badgeType];
      if (!def) return;
      const { data: existing } = await sb.from('pet_badges').select('id').eq('pet_id', petId).eq('badge_type', badgeType).maybeSingle();
      if (existing) return;
      await sb.from('pet_badges').insert({
        pet_id: petId,
        badge_type: badgeType,
        badge_label: def.label,
        display_order: def.order,
      });
    }

    async function checkBadgeTriggers(petId, actionType) {
      if (actionType === 'medication_logged') {
        const { data: cl } = await sb.from('pet_care_level').select('streak_days').eq('pet_id', petId).maybeSingle();
        if (cl && cl.streak_days >= 7) await awardBadge(petId, 'streak_7');
      }
      if (actionType === 'vaccine_recorded') {
        const { data: vaccines } = await sb.from('pet_vaccines').select('due_date').eq('pet_id', petId);
        if (vaccines && vaccines.length > 0) {
          const allCurrent = vaccines.every(v => !v.due_date || new Date(v.due_date) > new Date());
          if (allCurrent) await awardBadge(petId, 'vaccines_current');
        }
      }
      if (actionType === 'touchpoint_completed') {
        const { count } = await sb.from('touchpoints').select('id', { count: 'exact', head: true }).eq('case_id', state.caseId);
        if (count >= 5) await awardBadge(petId, 'engaged_owner');
      }
      if (actionType === 'care_plan_updated') {
        await awardBadge(petId, 'goal_setter');
      }
      if (actionType === 'appointment_logged') {
        const { count } = await sb.from('appointments').select('id', { count: 'exact', head: true }).eq('case_id', state.caseId);
        if (count === 1) await awardBadge(petId, 'first_visit');
        if (count >= 5) await awardBadge(petId, 'fifth_visit');
      }
      if (actionType === 'vital_recorded') {
        const { count } = await sb.from('pet_vitals').select('id', { count: 'exact', head: true }).eq('pet_id', petId);
        if (count >= 3) await awardBadge(petId, 'health_tracker');
      }
    }

    // ── Pet-level XP ──
    async function awardCareXP(petId, actionType) {
      if (!petId || !actionType) return;
      const baseXP = XP_MAP[actionType];
      if (!baseXP) return;
      const multiplier = getXPMultiplier();
      const xp = Math.round(baseXP * multiplier);

      try {
        const { data: existing } = await sb.from('pet_care_level').select('*').eq('pet_id', petId).maybeSingle();
        const now = new Date().toISOString();

        let newXP, newStreak;
        if (existing) {
          newXP = (existing.xp_total || 0) + xp;
          const lastDate = existing.last_activity_at ? new Date(existing.last_activity_at).toDateString() : null;
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          if (lastDate === today) {
            newStreak = existing.streak_days || 1;
          } else if (lastDate === yesterday) {
            newStreak = (existing.streak_days || 0) + 1;
          } else {
            newStreak = 1;
          }
          const newLevel = getLevelForXP(newXP).level;
          await sb.from('pet_care_level').update({
            xp_total: newXP, level: newLevel, streak_days: newStreak,
            last_activity_at: now, updated_at: now,
          }).eq('pet_id', petId);
        } else {
          newXP = xp;
          newStreak = 1;
          const newLevel = getLevelForXP(newXP).level;
          await sb.from('pet_care_level').insert({
            pet_id: petId, xp_total: newXP, level: newLevel,
            streak_days: newStreak, last_activity_at: now,
          });
        }
        await checkBadgeTriggers(petId, actionType);
      } catch (err) {
        console.warn('awardCareXP failed (non-blocking):', err);
      }
    }

    // ── Care team activity logging ──
    // When a care team member (caregiver) performs a care action,
    // log it to the timeline, award bonus XP, and increment assists_given.
    async function logCareTeamActivity(petId, actionDescription) {
      if (!petId || !state.profile?.id) return;
      try {
        // Check if current user is a caregiver for this pet's case
        const caseId = state.cases?.find(c => c.pets?.id === petId)?.id || state.currentCase?.id;
        if (!caseId) return;
        const careTeam = state._careTeamMembers || [];
        const isCareTeamMember = careTeam.some(m => m.user_id === state.profile.id && !['buddy', 'dvm', 'admin'].includes(m.role));
        if (!isCareTeamMember) return;

        const userName = state.profile.name || 'A care team member';

        // 1. Insert timeline entry
        await sb.from('timeline_entries').insert({
          case_id: caseId,
          author_id: state.profile.id,
          type: 'care_team_action',
          content: userName + ' ' + actionDescription,
          is_client_visible: true,
        });

        // 2. Award bonus XP for care team check-in (10 XP)
        try { await awardCareXP(petId, 'care_checkin'); } catch(_) {}

        // 3. Increment assists_given for this care team member
        try { await sb.rpc('increment_assists_given', { uid: state.profile.id }); } catch(_) {}
      } catch (err) {
        console.warn('logCareTeamActivity failed (non-blocking):', err);
      }
    }

    // ── User-level community badge helpers ──
    async function awardUserBadge(userId, badgeType) {
      const def = COMMUNITY_BADGE_DEFINITIONS[badgeType];
      if (!def) return;
      try {
        const { data: existing } = await sb.from('user_badges').select('id').eq('user_id', userId).eq('badge_type', badgeType).maybeSingle();
        if (existing) return;
        await sb.from('user_badges').insert({ user_id: userId, badge_type: badgeType, badge_label: def.label });
      } catch (err) {
        console.warn('awardUserBadge failed:', err);
      }
    }

    async function checkCommunityBadgeTriggers(userId, actionType) {
      try {
        const { data: stats } = await sb.from('user_care_stats').select('*').eq('user_id', userId).maybeSingle();
        if (!stats) return;

        if (actionType === 'joined_as_helper') {
          await awardUserBadge(userId, 'first_helper');
        }
        if (actionType === 'care_request_claimed' && stats.assists_given >= 3) {
          await awardUserBadge(userId, 'care_ally');
        }
        if (actionType === 'team_invite_accepted' && stats.teams_built >= 3) {
          await awardUserBadge(userId, 'team_builder');
        }
        if (actionType === 'care_request_completed' && stats.assists_given >= 5) {
          await awardUserBadge(userId, 'neighbor_care');
        }
        if (stats.community_score >= 100) {
          await awardUserBadge(userId, 'community_pillar');
        }
        // care_village: helped 5+ distinct pets
        const { data: claimedRequests } = await sb.from('care_requests')
          .select('pet_id')
          .eq('claimed_by', userId).neq('status', 'cancelled');
        const distinctPetIds = new Set((claimedRequests || []).map(r => r.pet_id));
        if (distinctPetIds.size >= 5) {
          await awardUserBadge(userId, 'care_village');
        }
      } catch (err) {
        console.warn('checkCommunityBadgeTriggers failed:', err);
      }
    }

    // ── Community score recalculation ──
    async function recalculateCommunityScore(userId) {
      if (!userId) return;
      try {
        const { data: stats } = await sb.from('user_care_stats').select('*').eq('user_id', userId).maybeSingle();
        if (!stats) return;
        const score = (stats.assists_given * 2) + (stats.teams_joined * 5) + (stats.teams_built * 10);
        await sb.from('user_care_stats').update({ community_score: score, updated_at: new Date().toISOString() }).eq('user_id', userId);
      } catch (err) {
        console.warn('recalculateCommunityScore failed:', err);
      }
    }

    // ── Community XP (user-level) ──
    async function awardCommunityXP(userId, actionType) {
      if (!userId || !actionType) return;
      const delta = COMMUNITY_XP_MAP[actionType];
      if (!delta) return;

      try {
        // Upsert user_care_stats
        const { data: existing } = await sb.from('user_care_stats').select('*').eq('user_id', userId).maybeSingle();
        const now = new Date().toISOString();

        const statUpdates = {};
        if (actionType === 'care_request_claimed' || actionType === 'care_request_completed' || actionType === 'assisted_another_pet') {
          statUpdates.assists_given = (existing?.assists_given || 0) + 1;
        }
        if (actionType === 'joined_as_helper') {
          statUpdates.teams_joined = (existing?.teams_joined || 0) + 1;
        }
        if (actionType === 'team_invite_accepted') {
          statUpdates.teams_built = (existing?.teams_built || 0) + 1;
        }

        if (existing) {
          await sb.from('user_care_stats').update({
            ...statUpdates,
            updated_at: now,
          }).eq('user_id', userId);
        } else {
          await sb.from('user_care_stats').insert({
            user_id: userId,
            ...statUpdates,
            community_score: 0,
          });
        }

        await recalculateCommunityScore(userId);
        await checkCommunityBadgeTriggers(userId, actionType);
      } catch (err) {
        console.warn('awardCommunityXP failed (non-blocking):', err);
      }
    }

    // Helper to get petId from current case context
    function getCurrentPetId() {
      return state.currentCase?.pets?.id || null;
    }

    // ── Tier helpers for gamification ──
    function getUserTier(caseId) {
      // Returns normalized tier: 'buddy', 'buddy_plus', or 'buddy_vip'
      const c = caseId ? state.cases?.find(cs => cs.id === caseId) : (state.cases?.[state.activePetIndex] || state.currentCase);
      const raw = c?.subscription_tier || 'Buddy';
      const normalized = raw.toLowerCase().replace(/\+/, '_plus').replace(/\s+/g, '_');
      if (normalized === 'buddy_vip') return 'buddy_vip';
      if (normalized === 'buddy_plus' || normalized === 'buddy+') return 'buddy_plus';
      return 'buddy';
    }

    function getUserTierLevel(caseId) {
      const t = getUserTier(caseId);
      return t === 'buddy_vip' ? 3 : t === 'buddy_plus' ? 2 : 1;
    }

    function canAccessFeature(feature, caseId) {
      if (state.profile?.role !== 'client') return true;
      const level = getUserTierLevel(caseId);
      return level >= (FEATURE_MIN_TIER[feature] || 1);
    }

    function getXPMultiplier(caseId) {
      const level = getUserTierLevel(caseId);
      return TIER_XP_MULTIPLIER[level] || 1;
    }

    function getHelperCap(caseId) {
      const level = getUserTierLevel(caseId);
      return TIER_HELPER_CAP[level];
    }

    function renderTierUpgradePrompt(feature) {
      const copy = TIER_UPGRADE_COPY[feature];
      if (!copy) return '';
      return `<div class="tier-upgrade-prompt">
        <div class="tier-upgrade-icon">✨</div>
        <div class="tier-upgrade-body">
          <div class="tier-upgrade-text">${copy.desc} — available on <strong>${copy.tier}</strong> (${copy.price}).</div>
          <div class="tier-upgrade-actions">
            <a href="https://rodgersvetbuddies.com" target="_blank" class="tier-upgrade-link">Learn more</a>
          </div>
        </div>
      </div>`;
    }

    // ── AI Medical Record Extraction ─────────────────────────
    const AI_SUPPORTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'text/csv'];

    async function triggerAiExtraction(doc, caseId) {
      const petName = state.currentCase?.pets?.name || 'Pet';
      const petSpecies = state.currentCase?.pets?.species || 'unknown';

      const result = await callEdgeFunction('extract-medical-record', {
        document_url: doc.url,
        mime_type: doc.mime_type,
        file_name: doc.name,
        case_id: caseId,
        pet_name: petName,
        pet_species: petSpecies,
      });

      if (result.success && result.extraction) {
        state.aiExtractionResult = result.extraction;
        state.aiExtractionDocId = doc.id;
        state.aiExtractionDocName = doc.name;
        state.aiExtractionInProgress = false;
        // Pre-check all items
        const checked = {};
        const ext = result.extraction;
        (ext.diagnoses || []).forEach((_, i) => { checked['diag_' + i] = true; });
        (ext.medications || []).forEach((_, i) => { checked['med_' + i] = true; });
        (ext.vaccines || []).forEach((_, i) => { checked['vax_' + i] = true; });
        if (ext.vitals?.weight || ext.vitals?.temperature) checked['vitals'] = true;
        (ext.care_goals || []).forEach((_, i) => { checked['goal_' + i] = true; });
        if (ext.pet_profile_additions) checked['profile'] = true;
        state.aiCheckedItems = checked;
        state.showAiReviewModal = true;
        render();
      } else {
        state.aiExtractionInProgress = false;
        render();
        throw new Error(result.error || 'AI extraction failed');
      }
    }

    async function applyAiExtraction() {
      const ext = state.aiExtractionResult;
      const checked = state.aiCheckedItems;
      if (!ext || !state.caseId) return;

      const petId = state.currentCase?.pets?.id;
      const appliedItems = [];

      try {
        // 1. Insert medications
        for (let i = 0; i < (ext.medications || []).length; i++) {
          if (!checked['med_' + i]) continue;
          const med = ext.medications[i];
          await sb.from('pet_medications').insert({
            pet_id: petId,
            case_id: state.caseId,
            name: med.name,
            dose: med.dose || null,
            frequency: med.frequency || null,
            start_date: med.start_date || null,
            added_by: state.profile.id,
          });
          appliedItems.push('Medication: ' + med.name);
        }

        // 2. Insert vaccines
        for (let i = 0; i < (ext.vaccines || []).length; i++) {
          if (!checked['vax_' + i]) continue;
          const vax = ext.vaccines[i];
          await sb.from('pet_vaccines').insert({
            pet_id: petId,
            name: vax.name,
            administered_date: vax.administered_date || null,
            due_date: vax.due_date || null,
            notes: vax.notes || null,
            added_by: state.profile.id,
          });
          appliedItems.push('Vaccine: ' + vax.name);
        }

        // 3. Insert vitals
        if (checked['vitals'] && (ext.vitals?.weight || ext.vitals?.temperature)) {
          await sb.from('pet_vitals').insert({
            pet_id: petId,
            weight: ext.vitals.weight || null,
            temperature: ext.vitals.temperature || null,
            notes: 'AI-extracted from ' + state.aiExtractionDocName,
            recorded_by: state.profile.id,
          });
          appliedItems.push('Vitals recorded');
        }

        // 4. Update care plan
        await loadCarePlan(state.caseId);
        const lp = state.carePlan?.living_plan || { pet_profile: '', care_team: [], active_care_goals: [], engagement_log: [], milestones_and_wins: [] };

        // Append to pet profile
        if (checked['profile'] && ext.pet_profile_additions) {
          const dateStr = ext.document_date || new Date().toISOString().split('T')[0];
          const addition = `\n[${dateStr}] ${ext.pet_profile_additions}`;
          lp.pet_profile = (lp.pet_profile || '') + addition;
          appliedItems.push('Pet profile updated');
        }

        // Add care goals
        for (let i = 0; i < (ext.care_goals || []).length; i++) {
          if (!checked['goal_' + i]) continue;
          lp.active_care_goals.push({
            goal_text: ext.care_goals[i],
            set_by_owner: false,
            created_at: new Date().toISOString(),
            status: 'active',
            dvm_reviewed: false,
          });
          appliedItems.push('Goal: ' + ext.care_goals[i]);
        }

        // Add engagement log entry
        const logSummary = ext.summary || 'Medical record analyzed by AI';
        lp.engagement_log.push({
          entry_text: `AI extracted from "${state.aiExtractionDocName}": ${logSummary}`,
          created_by: 'AI Assistant',
          created_at: new Date().toISOString(),
        });

        // Save care plan
        if (state.carePlan?.id) {
          await sb.from('care_plans').update({
            content: JSON.stringify(lp),
            updated_by: state.profile.id,
            updated_at: new Date().toISOString(),
          }).eq('id', state.carePlan.id);
        } else {
          await sb.from('care_plans').insert({
            case_id: state.caseId,
            content: JSON.stringify(lp),
            updated_by: state.profile.id,
            updated_at: new Date().toISOString(),
          });
        }

        // 5. Create timeline entry
        const timelineSummary = [
          ext.summary,
          ext.diagnoses?.length ? 'Diagnoses: ' + ext.diagnoses.join(', ') : '',
          appliedItems.length ? 'Applied: ' + appliedItems.length + ' items' : '',
        ].filter(Boolean).join(' | ');

        await sb.from('timeline_entries').insert({
          case_id: state.caseId,
          author_id: state.profile.id,
          type: 'update',
          content: `📄 AI Medical Record Analysis — "${state.aiExtractionDocName}"\n${timelineSummary}`,
          is_client_visible: true,
          created_at: new Date().toISOString(),
        });

        // 6. Reload all affected data
        await Promise.all([
          loadCarePlan(state.caseId),
          loadPetMedications(petId),
          loadPetVaccines(petId),
          loadPetVitals(petId),
          loadTimeline(state.caseId),
          loadDocuments(state.caseId),
        ]);

        // Close modal and notify
        state.showAiReviewModal = false;
        state.aiExtractionResult = null;
        state.aiExtractionDocId = null;
        state.aiCheckedItems = {};
        showToast(`AI extraction applied — ${appliedItems.length} items added to care plan!`, 'success');
        render();
      } catch (err) {
        console.error('Apply AI extraction error:', err);
        showToast('Failed to apply some extracted data: ' + (err.message || 'Error'), 'error');
      }
    }

    // renderStatusDot, renderProgressBar, formatDate, formatDateTime, showToast are in utils.js

    // RESOURCE_DOCUMENTS is in resource-documents.js
    // (Legacy reference — the const is loaded from resource-documents.js)
    // ── Resource Documents ──────────────────────────────────────────────
    // const RESOURCE_DOCUMENTS loaded from resource-documents.js

    function showResourceDocument(title, icon) {
      const content = RESOURCE_DOCUMENTS[title];
      if (!content) {
        showToast('Resource not found', 'error');
        return;
      }
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-card resource-doc">
          <div class="modal-title">${icon || '📄'} ${title}</div>
          <div class="modal-body">${content}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          </div>
        </div>
      `;
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) closeModal();
      });
      document.body.appendChild(backdrop);
      document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', handler); }
      });
    }

    function showModal(title, bodyHTML, actionsHTML = '') {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-card">
          <div class="modal-title">${esc(title)}</div>
          <div class="modal-body">${bodyHTML}</div>
          <div class="modal-actions">${actionsHTML}</div>
        </div>
      `;
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) closeModal();
      });
      document.body.appendChild(backdrop);
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
      });
    }

    function closeModal() {
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    }

    function getFirstInitials(name) {
      if (!name) return '??';
      return name.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function getRandomColor() {
      return COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    // ============================================
    // AUTH FUNCTIONS
    // ============================================
    async function handleSignUp(e) {
      e.preventDefault();
      const name = document.querySelector('[data-field="signup-name"]').value.trim();
      const email = document.querySelector('[data-field="signup-email"]').value.trim();
      const password = document.querySelector('[data-field="signup-password"]').value;
      const role = 'client'; // All public signups are clients; staff accounts created by admin in Supabase

      if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
      }

      if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }

      try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;

        // Check if admin pre-created a user record for this email (staff/specialist accounts)
        const { data: existingUser } = await sb.from('users').select('id, role, name').eq('email', email).maybeSingle();
        if (existingUser) {
          // Link the new auth account to the pre-existing user record
          const { error: linkError } = await sb.from('users').update({
            auth_id: data.user.id,
          }).eq('email', email);
          if (linkError) throw linkError;
        } else {
          const initials = getFirstInitials(name);
          const color = getRandomColor();
          const { error: insertError } = await sb.from('users').insert({
            auth_id: data.user.id,
            name,
            email,
            role,
            avatar_initials: initials,
            avatar_color: color,
          });
          if (insertError) throw insertError;
        }

        // Auto-sign-in: if session was returned (email confirm disabled), go straight to onboarding
        if (data.session) {
          state.user = data.user;
          showToast(`Welcome to Vet Buddies, ${name}! 🐾`, 'success');
          await loadProfile();
          // Accept care team invite if present
          if (state._careTeamInviteToken && state.profile?.id) {
            try {
              await sb.rpc('handle_care_team_invite_accepted', { invite_token: state._careTeamInviteToken, new_user_id: state.profile.id });
              state._careTeamInviteToken = null;
              state._careTeamInviteData = null;
              window.history.replaceState({}, '', window.location.pathname);
              showToast('You have joined the care team!', 'success');
            } catch(e) { console.warn('Invite acceptance failed:', e); }
          }
          render();
        } else {
          // Fallback: if email confirmation is still required
          showToast('Account created! Check your email to confirm, then sign in.', 'success');
          navigate('login');
        }
      } catch (err) {
        console.error(err);
        // "User already registered" means they have an account — redirect to login
        if (err.message && err.message.toLowerCase().includes('already registered')) {
          showToast('An account with this email already exists. Please sign in.', 'error');
          navigate('login');
        } else {
          showToast(err.message || 'Sign up failed', 'error');
        }
      }
    }

    async function handleSignIn(e) {
      e.preventDefault();
      const email = document.querySelector('[data-field="signin-email"]').value.trim();
      const password = document.querySelector('[data-field="signin-password"]').value;

      if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
      }

      try {
        // After signInWithPassword resolves, the Supabase auth lock is fully released.
        // We call loadProfile() HERE — not inside onAuthStateChange — to avoid the
        // lock deadlock that occurs when sb.from() is called inside the SIGNED_IN event.
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.user = data.user;
        await loadProfile();
        // Accept care team invite if present
        if (state._careTeamInviteToken && state.profile?.id) {
          try {
            await sb.rpc('handle_care_team_invite_accepted', { invite_token: state._careTeamInviteToken, new_user_id: state.profile.id });
            state._careTeamInviteToken = null;
            state._careTeamInviteData = null;
            window.history.replaceState({}, '', window.location.pathname);
            showToast('You\'ve joined the care team!', 'success');
          } catch(e) { console.warn('Invite acceptance failed:', e); }
        }
        render();
      } catch (err) {
        console.error(err);
        if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
          showToast('Please confirm your email before signing in. Check your inbox.', 'error');
        } else {
          showToast(err.message || 'Sign in failed', 'error');
        }
      }
    }

    async function handleSignOut() {
      try {
        if (state.realtimeChannel) {
          sb.removeChannel(state.realtimeChannel);
          state.realtimeChannel = null;
        }
        if (state.globalNotifChannel) {
          sb.removeChannel(state.globalNotifChannel);
          state.globalNotifChannel = null;
        }
        await unsubscribeFromPush();
        await sb.auth.signOut({ scope: 'local' });
        state.user = null;
        state.profile = null;
        state.cases = [];
        state.currentCase = null;
        state.carePlan = null;
        state.messages = [];
        state.inboxMessages = [];
        state.timelineEntries = [];
        state.touchpoints = [];
        state.appointments = [];
        state.escalations = [];
        state.teamMembers = [];
        state.caseId = null;
        navigate('login');
      } catch (err) {
        console.error(err);
        showToast('Sign out failed', 'error');
        state.user = null;
        state.profile = null;
        navigate('login');
        render();
      }
    }

    // onAuthStateChange is registered inside initApp() below

    // ============================================
    // DATA LOADING FUNCTIONS
    // ============================================
    async function loadProfile() {
      if (!state.user) return;
      const userId = state.user.id; // capture before any async gap
      try {
        const { data, error } = await sb.from('users').select('*').eq('auth_id', userId).single();
        if (error) throw error;
        if (!state.user) return; // user was cleared (e.g. by initApp) while query ran — bail out
        state.profile = data;
        if (data.dark_mode) { state.darkMode = true; document.documentElement.setAttribute('data-theme', 'dark'); }

        // Route by role
        // Load notification preferences + check permission state for all roles
        await loadNotificationSettings();
        if ('Notification' in window) {
          state.notificationPermission = Notification.permission;
          // Auto-subscribe to push if permission already granted
          if (Notification.permission === 'granted') subscribeToPush();
        }

        if (data.role === 'client') {
          // Auto-link any pending co-owner invites to this user
          await autoLinkCoOwnerInvites();
          // Check if new user with no subscription → onboarding
          await loadCases();
          if ((!data.subscription_status || data.subscription_status === 'none') && state.cases.length === 0) {
            state.onboardingStep = 1;
            navigate('onboarding');
          } else if ((data.subscription_status === 'trialing' || data.subscription_status === 'active') && state.cases.length === 0) {
            // Trial or paid user who hasn't added a pet yet — resume onboarding at step 2
            await loadAvailableBuddies();
            state.onboardingStep = 2;
            navigate('onboarding');
          } else {
            // Pre-load care plan + appointments for first case so dashboard has data immediately
            const firstCase = state.cases[state.activePetIndex || 0] || state.cases[0];
            if (firstCase) {
              await Promise.all([
                loadCarePlan(firstCase.id),
                loadAppointments(firstCase.id),
                loadPetCareProfile(firstCase.pets?.id),
                loadTimeline(firstCase.id),
              ]);
            }
            navigate('client-dashboard');
          }
          // Load client unread count + start global notifications + appointment reminders
          loadClientUnreadCount().then(() => render());
          subscribeToGlobalNotifications();
          startAppointmentReminders();
          render();
        } else if (data.role === 'admin' || data.role === 'practice_manager') {
          navigate('admin-dashboard');
          Promise.all([loadCases(), loadTeamMembers(), loadEscalations()]).then(async () => {
            await Promise.all([loadUnreadCount(), loadAllUnreadMessages()]);
            subscribeToGlobalNotifications();
            render();
          });
        } else if (data.role === 'vet_buddy' || data.role === 'external_vet' || data.role === 'geneticist') {
          navigate(data.role === 'vet_buddy' ? 'buddy-dashboard' : data.role === 'geneticist' ? 'geneticist-dashboard' : 'external-dashboard');
          const caseLoader = data.role === 'geneticist' ? loadGeneticistCases() : loadCases();
          caseLoader.then(async () => {
            await Promise.all([loadUnreadCount(), loadAllUnreadMessages()]);
            subscribeToGlobalNotifications();
            render();
          });
        } else {
          navigate('login');
        }
      } catch (err) {
        console.error(err);
        // Clear stale session and return to login rather than showing a blank page
        await sb.auth.signOut({ scope: 'local' });
        state.user = null;
        state.profile = null;
        navigate('login');
      }
    }

    async function loadCases() {
      if (!state.profile) return;
      try {
        let query;
        const selectFields = `
            id, pet_id, assigned_buddy_id, status, subscription_tier, updated_at, created_at, last_client_message_at,
            pets (id, name, species, photo_url, owner_id, owner:users!owner_id (id, name)),
            assigned_buddy:users!assigned_buddy_id (id, name, avatar_initials, avatar_color, bio, response_time)
        `;

        if (state.profile.role === 'client') {
          // 1) Owned cases
          const { data: ownedData, error: ownedErr } = await sb.from('cases').select(`
            id, pet_id, assigned_buddy_id, status, subscription_tier, updated_at,
            pets!inner (id, name, species, breed, dob, photo_url, owner_id, care_story, legacy_mode, owner:users!owner_id (id, name)),
            assigned_buddy:users!assigned_buddy_id (id, name, avatar_initials, avatar_color, bio, response_time)
          `).eq('pets.owner_id', state.profile.id);
          if (ownedErr) throw ownedErr;

          // 2) Co-owned cases — get pet_ids from pet_co_owners where user is accepted
          const { data: coOwnerRows } = await sb.from('pet_co_owners')
            .select('pet_id')
            .eq('user_id', state.profile.id)
            .eq('status', 'accepted');

          let coOwnedData = [];
          if (coOwnerRows && coOwnerRows.length > 0) {
            const coPetIds = coOwnerRows.map(r => r.pet_id);
            const { data: coData, error: coErr } = await sb.from('cases').select(selectFields)
              .in('pet_id', coPetIds);
            if (coErr) throw coErr;
            coOwnedData = coData || [];
          }

          // Merge, deduplicate by case id
          const allCases = [...(ownedData || [])];
          const ownedIds = new Set(allCases.map(c => c.id));
          for (const c of coOwnedData) {
            if (!ownedIds.has(c.id)) { allCases.push(c); c._coOwned = true; }
          }
          state.cases = allCases;

          // Also load pending invites for this user's email
          await loadPendingCoOwnerInvites();
        } else {
          // Admin, vet_buddy, external_vet — use regular (outer) join
          query = sb.from('cases').select(selectFields);
          if (state.profile.role === 'vet_buddy') {
            query = query.eq('assigned_buddy_id', state.profile.id);
          }
          const { data, error } = await query;
          if (error) throw error;
          state.cases = data || [];
        }
      } catch (err) {
        console.error('loadCases error:', err);
        showToast('Could not load cases. Please refresh.', 'error');
      }
    }

    async function loadPetCareProfile(petId) {
      if (!petId) return;
      try {
        const userId = state.profile?.id;
        const caseId = state.cases?.find(c => c.pets?.id === petId)?.id;
        const fetches = [
          sb.from('pet_care_level').select('*').eq('pet_id', petId).maybeSingle(),
          sb.from('pet_badges').select('*').eq('pet_id', petId).order('display_order'),
          userId ? sb.from('user_care_stats').select('*').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
          userId ? sb.from('user_badges').select('*').eq('user_id', userId) : Promise.resolve({ data: [] }),
          caseId ? sb.from('case_access').select('*').eq('case_id', caseId) : Promise.resolve({ data: [] }),
          userId ? sb.from('care_requests').select('*, pets(name, species, photo_url)').eq('status', 'open').neq('owner_id', userId).limit(10) : Promise.resolve({ data: [] }),
          userId ? sb.from('care_requests').select('*, pets(name, species, photo_url)').eq('claimed_by', userId).in('status', ['claimed','completed']) : Promise.resolve({ data: [] }),
          caseId ? sb.from('pending_invites').select('*').eq('case_id', caseId).eq('invite_source', 'care_team').is('used_at', null) : Promise.resolve({ data: [] }),
          userId ? sb.from('referrals').select('*').eq('referrer_id', userId) : Promise.resolve({ data: [] }),
        ];
        const [clRes, badgesRes, statsRes, uBadgesRes, teamRes, openReqRes, myClaimedRes, pendingCTRes, referralsRes] = await Promise.all(fetches);
        state._petCareLevel = clRes.data || {};
        state._petBadges = badgesRes.data || [];
        state._userCareStats = statsRes.data || {};
        state._userBadges = uBadgesRes.data || [];
        state._careTeamMembers = teamRes.data || [];
        state._openCareRequests = openReqRes.data || [];
        state._myClaimedRequests = myClaimedRes.data || [];
        state._pendingCareTeamInvites = pendingCTRes.data || [];
        state._referrals = referralsRes.data || [];
      } catch (err) {
        console.warn('loadPetCareProfile failed:', err);
        state._petCareLevel = {};
        state._petBadges = [];
        state._userCareStats = {};
        state._userBadges = [];
        state._careTeamMembers = [];
        state._openCareRequests = [];
        state._myClaimedRequests = [];
        state._pendingCareTeamInvites = [];
        state._referrals = [];
      }
    }

    async function loadCase(caseId) {
      try {
        // Primary query with full joins
        const { data, error } = await sb.from('cases').select(`
          id, pet_id, assigned_buddy_id, status, subscription_tier, updated_at,
          pets (id, name, species, breed, dob, weight, notes, photo_url, owner_id, care_story, legacy_mode, owner:users!owner_id (id, name)),
          assigned_buddy:users!assigned_buddy_id (id, name, avatar_initials, avatar_color, bio, response_time)
        `).eq('id', caseId).single();
        if (!error && data) {
          state.currentCase = data;
          return;
        }
        // Fallback: simpler query without named FK aliases
        console.warn('loadCase primary query failed, trying fallback:', error);
        const { data: d2, error: e2 } = await sb.from('cases').select(`
          id, pet_id, assigned_buddy_id, status, subscription_tier, updated_at,
          pets (id, name, species, breed, dob, weight, notes, photo_url, owner_id, care_story, legacy_mode),
          assigned_buddy:users!assigned_buddy_id (id, name, avatar_initials, avatar_color, bio, response_time)
        `).eq('id', caseId).single();
        if (!e2 && d2) {
          // Manually attach owner from the case list cache if available
          const cached = (state.cases || []).find(c => c.id === caseId);
          if (cached?.pets?.owner) d2.pets.owner = cached.pets.owner;
          state.currentCase = d2;
          return;
        }
        // Last resort: use cached case from the list
        const cached = (state.cases || []).find(c => c.id === caseId);
        if (cached) {
          state.currentCase = cached;
          return;
        }
        throw e2 || error;
      } catch (err) {
        console.error('loadCase error:', err);
        showToast('Could not load case details.', 'error');
      }
    }

    // ── Load Available Buddies (for onboarding picker) ──────
    async function loadAvailableBuddies() {
      try {
        const { data: buddies, error } = await sb.from('users')
          .select('id, name, bio, response_time, avatar_initials, avatar_color')
          .eq('role', 'vet_buddy');
        if (error) throw error;
        // Get active case counts for each buddy
        const { data: cases } = await sb.from('cases').select('assigned_buddy_id').eq('status', 'Active');
        const countMap = {};
        (cases || []).forEach(c => { if (c.assigned_buddy_id) countMap[c.assigned_buddy_id] = (countMap[c.assigned_buddy_id] || 0) + 1; });
        state.availableBuddies = (buddies || []).map(b => ({ ...b, activeCases: countMap[b.id] || 0 }));
      } catch (err) { console.error('loadAvailableBuddies error:', err); }
    }

    // ── Co-Owner Functions ──────────────────────────────────
    async function loadPetCoOwners(petId) {
      try {
        const { data, error } = await sb.from('pet_co_owners')
          .select('id, pet_id, user_id, invited_by, invited_email, status, created_at, accepted_at, user:users!user_id (id, name, email)')
          .eq('pet_id', petId);
        if (error) throw error;
        state.petCoOwners = data || [];
      } catch (err) { console.error(err); }
    }

    async function loadPendingCoOwnerInvites() {
      if (!state.user) return;
      try {
        const email = state.user.email;
        const { data, error } = await sb.from('pet_co_owners')
          .select('id, pet_id, invited_email, status, created_at, inviter:users!invited_by (id, name), pet:pets!pet_id (id, name, species)')
          .eq('invited_email', email)
          .eq('status', 'pending');
        if (error) throw error;
        state.pendingCoOwnerInvites = data || [];
      } catch (err) { console.error(err); }
    }

    async function inviteCoOwner(petId, email) {
      try {
        // Check if user already exists
        const { data: existingUser } = await sb.from('users').select('id, email').eq('email', email).maybeSingle();
        const userId = existingUser ? existingUser.id : null;

        // Check for duplicate invite
        if (userId) {
          const { data: existing } = await sb.from('pet_co_owners')
            .select('id').eq('pet_id', petId).eq('user_id', userId).maybeSingle();
          if (existing) { showToast('This person is already a co-owner or has a pending invite.', 'error'); return; }
        } else {
          const { data: existing } = await sb.from('pet_co_owners')
            .select('id').eq('pet_id', petId).eq('invited_email', email).maybeSingle();
          if (existing) { showToast('An invite has already been sent to this email.', 'error'); return; }
        }

        const insertData = {
          pet_id: petId,
          user_id: userId || state.profile.id, // placeholder if user doesn't exist yet
          invited_by: state.profile.id,
          invited_email: email,
          status: 'pending',
        };

        // If user exists, set user_id properly; if not, we'll match on email when they sign up
        if (userId) {
          insertData.user_id = userId;
        } else {
          // For users that don't exist yet, we store with invited_by as user_id placeholder
          // and match on email when they register
          insertData.user_id = state.profile.id; // temp — will be updated on signup
        }

        const { error } = await sb.from('pet_co_owners').insert(insertData);
        if (error) throw error;

        // If user already exists and has an account, auto-accept
        if (userId) {
          showToast('Invite sent! ' + email + ' will see this pet on their dashboard.', 'success');
        } else {
          showToast('Invite sent! When ' + email + ' creates an account, they will see this pet.', 'success');
        }
        await loadPetCoOwners(petId);
      } catch (err) {
        console.error(err);
        showToast('Error sending invite: ' + err.message, 'error');
      }
    }

    async function acceptCoOwnerInvite(inviteId) {
      try {
        const { error } = await sb.from('pet_co_owners')
          .update({ user_id: state.profile.id, status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', inviteId);
        if (error) throw error;
        await loadPendingCoOwnerInvites();
        await loadCases();
        render();
      } catch (err) { console.error(err); showToast('Error accepting invite: ' + err.message, 'error'); }
    }

    async function declineCoOwnerInvite(inviteId) {
      try {
        const { error } = await sb.from('pet_co_owners')
          .update({ status: 'declined' })
          .eq('id', inviteId);
        if (error) throw error;
        await loadPendingCoOwnerInvites();
        render();
      } catch (err) { console.error(err); showToast('Error declining invite', 'error'); }
    }

    async function removeCoOwner(coOwnerId) {
      try {
        const { error } = await sb.from('pet_co_owners').delete().eq('id', coOwnerId);
        if (error) throw error;
        if (state.currentCase) await loadPetCoOwners(state.currentCase.pet_id);
        render();
        showToast('Co-owner removed', 'success');
      } catch (err) { console.error(err); showToast('Error removing co-owner', 'error'); }
    }

    // Auto-link pending invites on login (matches email to newly registered user)
    async function autoLinkCoOwnerInvites() {
      if (!state.user || !state.profile) return;
      try {
        const { data: pendingInvites } = await sb.from('pet_co_owners')
          .select('id')
          .eq('invited_email', state.user.email)
          .neq('user_id', state.profile.id);
        if (pendingInvites && pendingInvites.length > 0) {
          for (const inv of pendingInvites) {
            await sb.from('pet_co_owners')
              .update({ user_id: state.profile.id })
              .eq('id', inv.id);
          }
        }
      } catch (err) { console.error(err); }
    }

    // Default empty Living Care Plan JSON structure
    function emptyLivingCarePlan() {
      return {
        pet_profile: '',
        care_team: [],
        active_care_goals: [],
        engagement_log: [],
        milestones_and_wins: []
      };
    }

    // Parse care plan data — supports both legacy flat fields and new JSON structure
    function parseLivingCarePlan(data) {
      if (!data) return emptyLivingCarePlan();
      // If the existing content field holds JSON, parse it
      const contentField = data.content || data.notes || null;
      if (contentField && typeof contentField === 'string') {
        try {
          const parsed = JSON.parse(contentField);
          if (parsed.pet_profile !== undefined) return { ...emptyLivingCarePlan(), ...parsed };
        } catch(e) { /* not JSON — legacy plain text, migrate below */ }
      }
      // Fallback: migrate legacy flat fields into new structure
      const legacyGoals = data.goals || '';
      const legacyDiagnoses = data.diagnoses || '';
      const legacyAllergies = data.allergies || '';
      const legacyNotes = data.internal_notes || '';
      const petProfileParts = [];
      if (legacyDiagnoses) petProfileParts.push('Conditions: ' + legacyDiagnoses);
      if (legacyAllergies) petProfileParts.push('Allergies/Sensitivities: ' + legacyAllergies);
      if (data.handling_behavior) petProfileParts.push('Behavior notes: ' + data.handling_behavior);
      if (data.handling_medical) petProfileParts.push('Medical handling: ' + data.handling_medical);
      const goals = legacyGoals ? [{ goal_text: legacyGoals, set_by_owner: false, created_at: new Date().toISOString(), reviewed_at: null, status: 'active' }] : [];
      const logEntries = [];
      if (data.last_appointment_summary) logEntries.push({ entry_text: 'Last appointment: ' + data.last_appointment_summary, created_by: 'system', created_at: new Date().toISOString() });
      if (data.next_steps) logEntries.push({ entry_text: 'Next steps: ' + data.next_steps, created_by: 'system', created_at: new Date().toISOString() });
      return {
        pet_profile: petProfileParts.join('\n') || '',
        care_team: [],
        active_care_goals: goals,
        engagement_log: logEntries,
        milestones_and_wins: []
      };
    }

    async function loadCarePlan(caseId) {
      try {
        const { data, error } = await sb.from('care_plans').select('*').eq('case_id', caseId).single();
        if (error && error.code !== 'PGRST116') throw error;
        // Preserve the raw record for id/case_id/timestamps, attach parsed living plan
        const raw = data || { case_id: caseId };
        raw.living_plan = parseLivingCarePlan(data);
        // Preserve legacy fields for backward compat
        if (!raw.diagnoses) raw.diagnoses = '';
        if (!raw.medications) raw.medications = [];
        if (!raw.goals) raw.goals = '';
        if (!raw.next_steps) raw.next_steps = '';
        if (!raw.allergies) raw.allergies = '';
        if (!raw.handling_behavior) raw.handling_behavior = '';
        if (!raw.handling_medical) raw.handling_medical = '';
        if (!raw.last_appointment_summary) raw.last_appointment_summary = '';
        if (!raw.internal_notes) raw.internal_notes = '';
        state.carePlan = raw;
      } catch (err) {
        console.error('loadCarePlan error:', err);
        showToast('Could not load care plan.', 'error');
      }
    }

    async function loadMessages(caseId) {
      try {
        const { data, error } = await sb.from('messages').select(`
          id, case_id, sender_id, content, sender_role, is_read_by_staff, is_read_by_buddy, is_read_by_client,
          thread_type, message_type, read_at, created_at,
          attachment_url, attachment_name, is_urgent,
          sender:users!sender_id (id, name, role, avatar_initials, avatar_color)
        `).eq('case_id', caseId).order('created_at', { ascending: true });
        if (error) throw error;
        state.messages = data || [];

        // Only auto-mark as read for clients viewing staff messages.
        // Staff messages stay unread until responded to — viewing alone does not mark read.
        if (state.profile?.role === 'client') {
          // Client: mark staff messages as read
          const unreadIds = state.messages.filter(m => !m.is_read_by_client && m.sender_role !== 'client').map(m => m.id);
          if (unreadIds.length > 0) {
            await sb.from('messages').update({ is_read_by_client: true }).in('id', unreadIds);
            state.clientUnreadCount = Math.max(0, state.clientUnreadCount - unreadIds.length);
            state.unreadCount = state.clientUnreadCount;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadTimeline(caseId) {
      try {
        let query = sb.from('timeline_entries').select(`
          id, case_id, author_id, type, content, is_client_visible, created_at,
          author:users!author_id (id, name, role, avatar_initials, avatar_color)
        `).eq('case_id', caseId);

        if (state.profile && state.profile.role === 'client') {
          query = query.eq('is_client_visible', true);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        state.timelineEntries = data || [];
      } catch (err) {
        console.error(err);
      }
    }

    async function loadTouchpoints(caseId) {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const { data, error } = await sb.from('touchpoints').select('*, completed_by_user:users!completed_by(name)').eq('case_id', caseId).gte('completed_at', startOfMonth.toISOString());
        if (error) throw error;
        state.touchpoints = data || [];
      } catch (err) {
        console.error(err);
      }
    }

    async function loadAppointments(caseId) {
      try {
        const { data, error } = await sb.from('appointments').select('*').eq('case_id', caseId).order('scheduled_at', { ascending: true });
        if (error) throw error;
        state.appointments = data || [];
      } catch (err) {
        console.error(err);
      }
    }

    async function loadDocuments(caseId) {
      try {
        const { data, error } = await sb.from('case_documents').select('*, uploaded_by_user:users!uploaded_by(name)').eq('case_id', caseId).order('created_at', { ascending: false });
        if (error) throw error;
        state.documents = data || [];
      } catch (err) {
        console.error(err);
        state.documents = [];
      }
    }

    async function loadPetVitals(petId) {
      try {
        const { data, error } = await sb.from('pet_vitals').select('*, recorded_by_user:users!recorded_by(name)').eq('pet_id', petId).order('recorded_at', { ascending: false }).limit(30);
        if (error) throw error;
        state.petVitals = data || [];
      } catch (err) { console.error(err); state.petVitals = []; }
    }

    async function loadPetMedications(petId) {
      try {
        const { data, error } = await sb.from('pet_medications').select('*, added_by_user:users!added_by(name)').eq('pet_id', petId).order('created_at', { ascending: false });
        if (error) throw error;
        state.petMedications = data || [];
      } catch (err) { console.error(err); state.petMedications = []; }
    }

    async function loadPetVaccines(petId) {
      try {
        const { data, error } = await sb.from('pet_vaccines').select('*, added_by_user:users!added_by(name)').eq('pet_id', petId).order('due_date', { ascending: true });
        if (error) throw error;
        state.petVaccines = data || [];
      } catch (err) { console.error(err); state.petVaccines = []; }
    }

    async function loadCaseNotes(caseId) {
      try {
        const { data, error } = await sb.from('case_notes').select('*, author:users!created_by(id, name, avatar_initials, avatar_color)').eq('case_id', caseId).order('created_at', { ascending: false });
        if (error) throw error;
        state.caseNotes = data || [];
      } catch (err) { console.error(err); state.caseNotes = []; }
    }

    async function loadCannedResponses() {
      try {
        const { data, error } = await sb.from('canned_responses').select('*').order('shortcut');
        if (error) throw error;
        state.cannedResponses = data || [];
      } catch (err) { console.error(err); state.cannedResponses = []; }
    }

    async function loadTouchpointTemplates() {
      try {
        const { data, error } = await sb.from('touchpoint_templates').select('*').order('name');
        if (error) throw error;
        state.touchpointTemplates = data || [];
      } catch (err) { console.error(err); state.touchpointTemplates = []; }
    }

    async function loadBuddyAllAppointments() {
      // Load today's (and upcoming) appointments across all cases assigned to this buddy
      try {
        const buddyCaseIds = (state.cases || []).map(c => c.id);
        if (!buddyCaseIds.length) { state.buddyAppointments = []; return; }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data, error } = await sb.from('appointments')
          .select('*, case:cases(pet_id, pets(name))')
          .in('case_id', buddyCaseIds)
          .neq('status', 'cancelled')
          .gte('scheduled_at', today.toISOString())
          .order('scheduled_at', { ascending: true });
        if (error) throw error;
        state.buddyAppointments = data || [];
      } catch (err) { console.error(err); state.buddyAppointments = []; }
    }

    async function loadBuddyAvailability() {
      try {
        const { data, error } = await sb.from('buddy_availability').select('*').eq('buddy_id', state.profile.id).order('start_date', { ascending: true });
        if (error) throw error;
        state.buddyAvailability = data || [];
      } catch (err) { console.error(err); state.buddyAvailability = []; }
    }

    async function loadAnalytics() {
      try {
        // Parallel fetch of analytics data
        const [
          { count: totalClients },
          { count: activeCases },
          { count: totalMessages },
          { count: openEscalations },
          { data: recentSignups },
        ] = await Promise.all([
          sb.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
          sb.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
          sb.from('messages').select('*', { count: 'exact', head: true }),
          sb.from('escalations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          sb.from('users').select('id, created_at').eq('role', 'client').order('created_at', { ascending: false }).limit(30),
        ]);
        state.analyticsData = { totalClients, activeCases, totalMessages, openEscalations, recentSignups: recentSignups || [] };
      } catch (err) { console.error(err); }
    }

    async function ensureReferralCode() {
      if (!state.profile || state.profile.referral_code) return;
      const code = 'VB-' + state.profile.id.substring(0, 8).toUpperCase();
      const { error } = await sb.from('users').update({ referral_code: code }).eq('id', state.profile.id);
      if (!error) state.profile.referral_code = code;
    }

    // ═══ NEW FEATURE DATA FUNCTIONS ═══
async function loadFaqArticles() {
  try {
    const { data, error } = await sb
      .from('faq_articles')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    state.faqArticles = data || [];
  } catch (err) {
    console.error('Error loading FAQ articles:', err);
    showToast('Failed to load FAQ articles', 'error');
  }
}

async function loadKbConversation() {
  if (!state.profile) return;
  try {
    // Load most recent conversation for this user
    const { data: convs } = await sb.from('kb_conversations')
      .select('id')
      .eq('user_id', state.profile.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (convs && convs.length > 0) {
      state.kbConversationId = convs[0].id;
      const { data: msgs } = await sb.from('kb_messages')
        .select('role, content, created_at')
        .eq('conversation_id', state.kbConversationId)
        .order('created_at', { ascending: true });
      state.kbMessages = msgs || [];
    } else {
      state.kbConversationId = null;
      state.kbMessages = [];
    }
  } catch (err) {
    console.error('loadKbConversation error:', err);
  }
}

async function loadKbAdminConversations() {
  if (!state.profile || state.profile.role !== 'admin') return;
  try {
    // Anonymous: no user details included
    const { data, error } = await sb.from('kb_conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    state.kbConversations = data || [];
  } catch (err) {
    console.error('loadKbAdminConversations error:', err);
  }
}

async function loadKbConversationMessages(convId) {
  try {
    const { data } = await sb.from('kb_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    return data || [];
  } catch (err) {
    console.error('loadKbConversationMessages error:', err);
    return [];
  }
}

function scrollKbToBottom() {
  const el = document.getElementById('kb-chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

async function sendKbMessage(content) {
  if (!content.trim() || state.kbLoading) return;
  state.kbMessages.push({ role: 'user', content: content.trim(), created_at: new Date().toISOString() });
  state.kbLoading = true;
  render();
  scrollKbToBottom();
  try {
    const result = await callEdgeFunction('kb-chat', {
      message: content.trim(),
      conversation_id: state.kbConversationId || null,
    });
    state.kbConversationId = result.conversation_id;
    state.kbMessages.push({ role: 'assistant', content: result.response, created_at: new Date().toISOString() });
  } catch (err) {
    console.error('kb-chat error:', err);
    state.kbMessages.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again or message your Vet Buddy directly.', created_at: new Date().toISOString() });
  }
  state.kbLoading = false;
  render();
  scrollKbToBottom();
}

async function loadAuditLog(limit = 50) {
  try {
    const { data, error } = await sb
      .from('audit_log')
      .select('*, user:users!user_id(name,role)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    state.auditLog = data || [];
  } catch (err) {
    console.error('Error loading audit log:', err);
    showToast('Failed to load audit log', 'error');
  }
}

async function logAudit(action, entityType, entityId, details) {
  try {
    const { error } = await sb
      .from('audit_log')
      .insert({
        user_id: state.profile.id,
        action: action,
        entity_type: entityType,
        entity_id: entityId,
        details: details,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (err) {
    console.error('Error logging audit:', err);
  }
}

async function loadClientSurveys(caseId) {
  try {
    const { data, error } = await sb
      .from('client_surveys')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading client surveys:', err);
    showToast('Failed to load surveys', 'error');
    return [];
  }
}

async function loadAllSurveys() {
  try {
    const { data, error } = await sb
      .from('client_surveys')
      .select(`
        *,
        client:users!client_id(name),
        buddy:users!buddy_id(name),
        case:cases(pet_id, pets(name))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.surveys = data || [];
  } catch (err) {
    console.error('Error loading all surveys:', err);
    showToast('Failed to load surveys', 'error');
  }
}

async function saveSurvey(caseId, buddyId, rating, feedback) {
  try {
    const { data, error } = await sb
      .from('client_surveys')
      .insert({
        case_id: caseId,
        buddy_id: buddyId,
        client_id: state.profile.id,
        rating: rating,
        feedback: feedback,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    await logAudit('survey_created', 'client_surveys', data[0].id, {
      rating: rating,
      buddy_id: buddyId
    });

    showToast('Survey submitted successfully', 'success');
    return data[0];
  } catch (err) {
    console.error('Error saving survey:', err);
    showToast('Failed to save survey', 'error');
  }
}

async function loadHandoffNotes(caseId) {
  try {
    const { data, error } = await sb
      .from('handoff_notes')
      .select(`
        *,
        from_buddy:users!from_buddy_id(name),
        to_buddy:users!to_buddy_id(name)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading handoff notes:', err);
    showToast('Failed to load handoff notes', 'error');
    return [];
  }
}

async function saveHandoffNote(caseId, toBuddyId, data) {
  try {
    const { data: inserted, error } = await sb
      .from('handoff_notes')
      .insert({
        case_id: caseId,
        from_buddy_id: state.profile.id,
        to_buddy_id: toBuddyId,
        active_issues: data.active_issues || '',
        watch_items: data.watch_items || '',
        client_preferences: data.client_preferences || '',
        additional_notes: data.additional_notes || '',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    await logAudit('handoff_created', 'handoff_notes', inserted[0].id, {
      to_buddy_id: toBuddyId,
      case_id: caseId
    });

    showToast('Handoff note saved', 'success');
    return inserted[0];
  } catch (err) {
    console.error('Error saving handoff note:', err);
    showToast('Failed to save handoff note', 'error');
  }
}

async function loadReferralStats() {
  try {
    const { data, error } = await sb
      .from('referrals')
      .select('reward_status')
      .eq('referrer_id', state.profile.id);

    if (error) throw error;

    const stats = {
      total: data.length,
      converted: data.filter(r => r.reward_status === 'converted').length,
      pending: data.filter(r => r.reward_status === 'pending').length
    };

    state.referralStats = stats;
  } catch (err) {
    console.error('Error loading referral stats:', err);
    showToast('Failed to load referral stats', 'error');
  }
}

async function loadHealthTimeline(petId) {
  try {
    const [vitalsRes, medsRes, vacsRes, apptRes] = await Promise.all([
      sb.from('pet_vitals').select('*').eq('pet_id', petId).order('recorded_at', { ascending: false }).limit(100),
      sb.from('pet_medications').select('*').eq('pet_id', petId).limit(100),
      sb.from('pet_vaccines').select('*').eq('pet_id', petId).limit(100),
      sb.from('appointments').select('*, case:cases!inner(pet_id)').eq('cases.pet_id', petId).order('scheduled_at', { ascending: false }).limit(100)
    ]);

    const timeline = [];

    if (vitalsRes.data) {
      vitalsRes.data.forEach(vital => {
        timeline.push({
          type: 'vital',
          date: new Date(vital.recorded_at),
          description: `Weight: ${vital.weight || ''}${vital.temperature ? ' · Temp: ' + vital.temperature : ''}${vital.notes ? ' · ' + vital.notes : ''}`,
          color: '#3b82f6'
        });
      });
    }

    if (medsRes.data) {
      medsRes.data.forEach(med => {
        timeline.push({
          type: 'medication',
          date: new Date(med.start_date),
          description: `${med.name}${med.dose ? ' (' + med.dose + ')' : ''}`,
          color: '#10b981'
        });
      });
    }

    if (vacsRes.data) {
      vacsRes.data.forEach(vac => {
        timeline.push({
          type: 'vaccine',
          date: new Date(vac.administered_date),
          description: `${vac.name}`,
          color: '#f59e0b'
        });
      });
    }

    if (apptRes.data) {
      apptRes.data.forEach(appt => {
        timeline.push({
          type: 'appointment',
          date: new Date(appt.scheduled_at),
          description: `${appt.title || appt.type || 'Appointment'}`,
          color: '#8b5cf6'
        });
      });
    }

    state.healthTimelineEntries = timeline.sort((a, b) => b.date - a.date);
  } catch (err) {
    console.error('Error loading health timeline:', err);
    showToast('Failed to load health timeline', 'error');
  }
}

async function toggleDarkMode() {
  try {
    state.darkMode = !state.darkMode;
    document.documentElement.dataset.theme = state.darkMode ? 'dark' : 'light';
    try { localStorage.setItem('vetbuddies_dark_mode', state.darkMode ? '1' : '0'); } catch(e) {}

    const { error } = await sb
      .from('users')
      .update({ dark_mode: state.darkMode })
      .eq('id', state.profile.id);

    if (error) throw error;
    render();
  } catch (err) {
    console.error('Error toggling dark mode:', err);
    showToast('Failed to update theme preference', 'error');
  }
}

function generateICS(appointment, petName) {
  const now = new Date();
  const uid = `vetbuddies-${appointment.id}-${now.getTime()}@vetbuddies.com`;

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const apptStart = formatDate(appointment.scheduled_at);
  const apptEnd = new Date(new Date(appointment.scheduled_at).getTime() + 60 * 60 * 1000);
  const apptEndFormatted = formatDate(apptEnd);

  const title = (appointment.title || appointment.type || 'Appointment') + ' for ' + petName;
  const description = appointment.notes || `Vet appointment for ${petName}`;

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vet Buddies//Vet Buddies Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(now)}
DTSTART:${apptStart}
DTEND:${apptEndFormatted}
SUMMARY:Vet Buddies: ${title}
DESCRIPTION:${description}
LOCATION:Veterinary Clinic
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  return ics;
}

async function generateCarePlanPDF(carePlan, currentCase) {
  try {
    const { jsPDF } = window;
    if (!jsPDF) {
      showToast('PDF library not loaded', 'error');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(51, 96, 38);
    doc.text('Vet Buddies', margin, yPosition);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Pet Care Plan', margin, yPosition);
    yPosition += 15;

    // Pet and Owner Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Pet: ${currentCase.pets?.name || 'Unknown'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Species: ${currentCase.pets?.species || 'Unknown'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Owner: ${currentCase.pets?.owner?.name || 'Unknown'}`, margin, yPosition);
    yPosition += 15;

    // Care Plan Sections (living plan structure)
    const lp = carePlan ? parseLivingCarePlan(carePlan) : null;
    if (lp) {
      const sections = [
        { title: 'Pet Profile', content: lp.pet_profile },
        { title: 'Active Care Goals', content: (lp.active_care_goals || []).map(g => '• ' + (g.goal_text || '')).join('\n') },
        { title: 'Engagement Log', content: (lp.engagement_log || []).map(e => '• ' + (e.entry_text || '')).join('\n') },
        { title: 'Milestones & Wins', content: (lp.milestones_and_wins || []).map(m => '• ' + (m.title || '')).join('\n') },
      ];
      sections.forEach(section => {
        if (!section.content) return;
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(11);
        doc.setTextColor(51, 96, 38);
        doc.text(section.title || 'Section', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setTextColor(50);
        const lines = doc.splitTextToSize(section.content || '', contentWidth);
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * 5 + 8;
      });
    }

    // Footer
    yPosition = pageHeight - 15;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
    doc.text('vetbuddies.com', pageWidth - margin - 40, yPosition);

    return doc.output('blob');
  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast('Failed to generate PDF', 'error');
  }
}

function checkMedicationRefills(medications) {
  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return medications.filter(med => {
    const refillDate = new Date(med.refill_date);
    return refillDate <= sevenDaysFromNow;
  });
}

function checkVaccineDueDates(vaccines) {
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const overdue = [];
  const dueSoon = [];

  vaccines.forEach(vaccine => {
    const dueDate = new Date(vaccine.due_date);
    if (dueDate < today) {
      overdue.push(vaccine);
    } else if (dueDate <= thirtyDaysFromNow) {
      dueSoon.push(vaccine);
    }
  });

  return { overdue, dueSoon };
}

async function calculateBuddyScorecard(buddyId) {
  try {
    const [casesRes, ratingsRes, messagesRes, escalationsRes] = await Promise.all([
      sb.from('cases').select('id').eq('assigned_buddy_id', buddyId),
      sb.from('client_surveys').select('rating').eq('buddy_id', buddyId),
      sb.from('messages')
        .select('id')
        .eq('sender_id', buddyId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      sb.from('escalations').select('id').eq('raised_by', buddyId)
    ]);

    const totalCases = casesRes.data ? casesRes.data.length : 0;
    const ratings = ratingsRes.data ? ratingsRes.data.map(r => r.rating) : [];
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 0;
    const messagesLast30 = messagesRes.data ? messagesRes.data.length : 0;
    const escalationCount = escalationsRes.data ? escalationsRes.data.length : 0;

    // Calculate average response time (you may need to adjust based on your schema)
    const responseTimeAvg = 24; // placeholder in hours

    // Calculate grade
    let grade = 'F';
    if (avgRating >= 4.5) grade = 'A';
    else if (avgRating >= 3.5) grade = 'B';
    else if (avgRating >= 2.5) grade = 'C';
    else if (avgRating >= 1.5) grade = 'D';

    return {
      totalCases,
      avgRating: parseFloat(avgRating.toFixed(2)),
      messagesLast30,
      escalationCount,
      responseTimeAvg,
      grade
    };
  } catch (err) {
    console.error('Error calculating buddy scorecard:', err);
    showToast('Failed to calculate buddy scorecard', 'error');
    return null;
  }
}


    async function loadEscalations() {
      try {
        const { data, error } = await sb.from('escalations').select(`
          id, case_id, raised_by, reason, status, resolved_by, resolved_at, created_at, escalation_type, incident_notes,
          case:cases (id, pet_id, pets (id, name, species)),
          raised_by_user:users!raised_by (id, name, role)
        `).order('created_at', { ascending: false });
        if (error) throw error;
        state.escalations = data || [];
      } catch (err) {
        console.error(err);
      }
    }

    async function loadTeamMembers() {
      try {
        const { data, error } = await sb.from('users').select('*').neq('role', 'client').limit(500);
        if (error) throw error;
        const members = data || [];

        // Augment vet_buddy members with scorecard metrics
        const buddies = members.filter(m => m.role === 'vet_buddy');
        if (buddies.length > 0) {
          const buddyIds = buddies.map(b => b.id);

          // Case counts per buddy
          const { data: caseData } = await sb.from('cases')
            .select('assigned_buddy_id')
            .in('assigned_buddy_id', buddyIds);

          // Message counts per buddy (last 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: msgData } = await sb.from('messages')
            .select('sender_id')
            .in('sender_id', buddyIds)
            .eq('sender_role', 'vet_buddy')
            .gte('created_at', thirtyDaysAgo);

          // Escalation counts per buddy
          const { data: escData } = await sb.from('escalations')
            .select('raised_by')
            .in('raised_by', buddyIds);

          // Survey ratings per buddy
          const { data: surveyData } = await sb.from('client_surveys')
            .select('buddy_id, rating')
            .in('buddy_id', buddyIds);

          // Aggregate by buddy id
          const caseCounts = {};
          (caseData || []).forEach(c => { caseCounts[c.assigned_buddy_id] = (caseCounts[c.assigned_buddy_id] || 0) + 1; });
          const msgCounts = {};
          (msgData || []).forEach(m => { msgCounts[m.sender_id] = (msgCounts[m.sender_id] || 0) + 1; });
          const escCounts = {};
          (escData || []).forEach(e => { escCounts[e.raised_by] = (escCounts[e.raised_by] || 0) + 1; });
          const ratingMap = {};
          (surveyData || []).forEach(s => {
            if (!ratingMap[s.buddy_id]) ratingMap[s.buddy_id] = [];
            if (s.rating) ratingMap[s.buddy_id].push(s.rating);
          });

          members.forEach(m => {
            if (m.role !== 'vet_buddy') return;
            m.active_cases_count = caseCounts[m.id] || 0;
            m.messages_30d = msgCounts[m.id] || 0;
            m.escalations_count = escCounts[m.id] || 0;
            const ratings = ratingMap[m.id] || [];
            m.avg_rating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
            m.avg_response_time = m.response_time || 'Typically within 24 hours';
          });
        }

        state.teamMembers = members;
      } catch (err) {
        console.error(err);
      }
    }

    async function loadResources() {
      try {
        const { data, error } = await sb.from('resources').select('*').order('created_at');
        if (error) throw error;
        if (data && data.length > 0) state.resources = data;
      } catch (err) {
        console.error('loadResources error:', err);
      }
    }

    async function loadGeneticistCases() {
      try {
        const { data, error } = await sb.from('cases')
          .select(`
            id, pet_id, assigned_buddy_id, status, subscription_tier, updated_at, created_at,
            pets (id, name, species, breed, dob, weight, photo_url, owner_id,
              owner:users!owner_id (id, name, email)),
            assigned_buddy:users!assigned_buddy_id (id, name, avatar_initials, avatar_color)
          `)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        state.cases = data || [];
      } catch (err) {
        console.error('loadGeneticistCases error:', err);
      }
    }

    async function loadGeneticInsights(caseId) {
      try {
        const { data, error } = await sb.from('genetic_insights')
          .select('*, authored_by_user:users!authored_by (id, name, avatar_initials, avatar_color)')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        state.geneticInsights = data || [];
      } catch (err) {
        console.error('loadGeneticInsights error:', err);
        state.geneticInsights = [];
      }
    }

    async function loadUnreadCount() {
      if (!state.profile) return;
      try {
        if (state.profile.role === 'admin') {
          // Admin: all unread client messages (tracked independently from buddy)
          const { count, error } = await sb.from('messages').select('*', { count: 'exact', head: true })
            .eq('is_read_by_staff', false).eq('sender_role', 'client');
          if (error) throw error;
          state.unreadCount = count || 0;
        } else if (state.profile.role === 'vet_buddy') {
          // Buddy: only unread from their assigned cases (uses buddy-specific read flag)
          const buddyCaseIds = (state.cases || []).map(c => c.id);
          if (!buddyCaseIds.length) { state.unreadCount = 0; return; }
          const { count, error } = await sb.from('messages').select('*', { count: 'exact', head: true })
            .eq('is_read_by_buddy', false).eq('sender_role', 'client').in('case_id', buddyCaseIds);
          if (error) throw error;
          state.unreadCount = count || 0;
        } else if (state.profile.role === 'client') {
          // Client: unread messages from staff in their cases
          await loadClientUnreadCount();
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadAllUnreadMessages() {
      if (!state.profile) return;
      try {
        let query;
        if (state.profile.role === 'client') {
          // Client: unread staff messages in their cases
          const clientCaseIds = (state.cases || []).map(c => c.id);
          if (!clientCaseIds.length) { state.inboxMessages = []; state.unreadCount = 0; return; }
          query = sb.from('messages')
            .select(`*, sender:users!sender_id(id, name, role)`)
            .eq('is_read_by_client', false)
            .neq('sender_role', 'client')
            .in('case_id', clientCaseIds)
            .order('created_at', { ascending: false });
        } else if (state.profile.role === 'vet_buddy') {
          // Buddy: unread client messages from assigned cases (buddy-specific read flag)
          const buddyCaseIds = (state.cases || []).map(c => c.id);
          if (!buddyCaseIds.length) { state.inboxMessages = []; state.unreadCount = 0; return; }
          query = sb.from('messages')
            .select(`*, sender:users!sender_id(id, name, role)`)
            .eq('is_read_by_buddy', false)
            .eq('sender_role', 'client')
            .in('case_id', buddyCaseIds)
            .order('created_at', { ascending: false });
        } else {
          // Admin: all unread client messages (admin-specific read flag)
          query = sb.from('messages')
            .select(`*, sender:users!sender_id(id, name, role)`)
            .eq('is_read_by_staff', false)
            .eq('sender_role', 'client')
            .order('created_at', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;
        state.inboxMessages = data || [];
        // Keep unreadCount in sync with actual inbox so badge always reflects reality
        state.unreadCount = state.inboxMessages.length;
        if (state.profile.role === 'client') state.clientUnreadCount = state.inboxMessages.length;
      } catch (err) {
        console.error('loadAllUnreadMessages error:', err);
        state.inboxMessages = [];
      }
    }

    // ============================================
    // REALTIME MESSAGING
    // ============================================
    function subscribeToMessages(caseId) {
      if (state.realtimeChannel) {
        sb.removeChannel(state.realtimeChannel);
        state.realtimeChannel = null;
      }
      state.typingUsers = {};
      state.realtimeChannel = sb
        .channel(`messages:case:${caseId}`)
        .on('presence', { event: 'sync' }, () => {
          // Update typing indicator from presence state
          const presenceState = state.realtimeChannel.presenceState();
          const typers = {};
          for (const key of Object.keys(presenceState)) {
            for (const p of presenceState[key]) {
              if (p.typing && p.userId !== state.profile?.id) {
                typers[p.userId] = p.userName || 'Someone';
              }
            }
          }
          state.typingUsers = typers;
          // Update typing indicator in DOM without full re-render
          const typingEl = document.getElementById('typing-indicator');
          if (typingEl) {
            const names = Object.values(typers);
            if (names.length > 0) {
              typingEl.style.display = 'block';
              typingEl.textContent = names.length === 1
                ? `${names[0]} is typing...`
                : `${names.join(' and ')} are typing...`;
            } else {
              typingEl.style.display = 'none';
              typingEl.textContent = '';
            }
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `case_id=eq.${caseId}`,
        }, async (payload) => {
          // Skip if we already have this message (e.g. sent by self)
          if (state.messages.some(m => m.id === payload.new.id)) return;
          // Fetch full message with sender info
          const { data } = await sb.from('messages')
            .select('id, case_id, sender_id, content, sender_role, is_read_by_staff, is_read_by_buddy, is_read_by_client, thread_type, message_type, read_at, created_at, attachment_url, attachment_name, sender:users!sender_id(id, name, role, avatar_initials, avatar_color)')
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          state.messages.push(data);

          const isStaff = ['admin', 'vet_buddy'].includes(state.profile?.role);
          const isClient = state.profile?.role === 'client';
          const isOwnMessage = data.sender_id === state.profile?.id;

          // Staff messages stay unread until responded to — no auto-mark on view.
          // Auto-mark as read only for clients viewing staff messages.
          if (isClient && data.sender_role !== 'client') {
            sb.from('messages').update({ is_read_by_client: true }).eq('id', data.id).then(({ error }) => { if (error) console.error('Failed to mark read:', error); });
          }
          // Play notification sound only if NOT actively viewing this conversation
          const _viewingThisCase = !document.hidden && state.caseId === caseId;
          if (!isOwnMessage && !_viewingThisCase) {
            playNotificationSound();
            // Track this message ID to prevent duplicate notifications from global channel
            if (state.notifiedMessageIds.size > 200) {
              const first = state.notifiedMessageIds.values().next().value;
              state.notifiedMessageIds.delete(first);
            }
            state.notifiedMessageIds.add(data.id);
          }

          render();
          scrollMessagesToBottom();
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && state.profile) {
            await state.realtimeChannel.track({
              typing: false,
              userId: state.profile.id,
              userName: state.profile.name,
            });
          }
        });
    }

    function sendTypingPresence(isTyping) {
      if (state.realtimeChannel && state.profile) {
        state.realtimeChannel.track({
          typing: isTyping,
          userId: state.profile.id,
          userName: state.profile.name,
        }).catch(() => {});
      }
    }

    function scrollMessagesToBottom() {
      setTimeout(() => {
        const el = document.getElementById('messages-list');
        if (el) el.scrollTop = el.scrollHeight;
      }, 60);
    }

    // ============================================
    // VIEW RENDER FUNCTIONS
    // ============================================
    function renderLogin() {
      return `
        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-logo"><svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><text x="100" y="28" text-anchor="middle" fill="#336026" font-size="28" font-weight="700" font-family="Georgia,serif">Vet Buddies</text><text x="100" y="48" text-anchor="middle" fill="#689562" font-size="13" font-family="DM Sans,sans-serif">Your pet deserves a Buddy.</text></svg></div>
            <div class="auth-title">Sign In</div>
            <div style="text-align:center; color:var(--text-secondary); font-size:14px; margin-bottom:20px; margin-top:-8px;">Welcome back — your Buddy is waiting.</div>
            <form data-action="signin">
              <div class="form-group">
                <label>Email</label>
                <input type="email" data-field="signin-email" placeholder="you@example.com" required>
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" data-field="signin-password" placeholder="••••••••" required>
              </div>
              <div style="text-align:right; margin-bottom:12px;">
                <a data-action="forgot-password" style="font-size:13px; color:var(--primary); cursor:pointer;">Forgot password?</a>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
            </form>
            <div class="auth-toggle">
              Don't have an account? <a data-action="nav-signup">Sign Up</a>
            </div>
          </div>
        </div>
      `;
    }

    function renderSignup() {
      return `
        <div class="auth-container">
          <div class="auth-card">
            <div class="auth-logo"><svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><text x="100" y="28" text-anchor="middle" fill="#336026" font-size="28" font-weight="700" font-family="Georgia,serif">Vet Buddies</text><text x="100" y="48" text-anchor="middle" fill="#689562" font-size="13" font-family="DM Sans,sans-serif">Your pet deserves a Buddy.</text></svg></div>
            <div class="auth-title">Create your account</div>
            <div style="text-align:center; color:var(--text-secondary); font-size:14px; margin-bottom:20px; margin-top:-8px;">Every pet deserves a Buddy.</div>
            <form data-action="signup">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" data-field="signup-name" placeholder="Jane Doe" required aria-label="Full name">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" data-field="signup-email" placeholder="you@example.com" required aria-label="Email address">
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" data-field="signup-password" placeholder="••••••••" required aria-label="Password">
              </div>
              <div class="form-group" style="margin-top:4px;">
                <div style="font-size:12px;color:var(--text-secondary);">Password must be at least 8 characters</div>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Create Account</button>
            </form>
            <div class="auth-toggle">
              Already have an account? <a data-action="nav-login">Sign In</a>
            </div>
          </div>
        </div>
      `;
    }

    function renderCareTeamInviteLanding() {
      const invite = state._careTeamInviteData;
      if (!invite) return '<div class="auth-container"><div class="auth-card"><p>This invite link is no longer valid.</p><button class="btn btn-primary" data-action="nav-login">Sign In</button></div></div>';
      const pet = invite.cases?.pets;
      const owner = pet?.owner;
      const petName = pet?.name || 'your pet';
      const petBreed = pet?.breed || '';
      const petSpecies = pet?.species || 'pet';
      const ownerName = owner?.name || 'Someone';
      const petPhoto = pet?.photo_url;
      const inviteMsg = invite.message || '';
      const inviteeName = [invite.first_name, invite.last_name].filter(Boolean).join(' ') || '';

      return `
        <div class="auth-container" style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #f0f7ef 0%, #e8f5e6 50%, #fff 100%);">
          <div class="auth-card" style="max-width:440px; text-align:center; padding:32px;">
            ${petPhoto
              ? `<img src="${esc(petPhoto)}" alt="${esc(petName)}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; margin:0 auto 16px; display:block; border:4px solid #c8e6c4;">`
              : `<div style="width:120px; height:120px; border-radius:50%; margin:0 auto 16px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #689562, #336026); font-size:48px; color:white; border:4px solid #c8e6c4;">${(petName.charAt(0) || '🐾').toUpperCase()}</div>`
            }
            <h2 style="font-family:'Fraunces',serif; color:#336026; font-size:22px; margin-bottom:8px;">${esc(petName)} needs you on their care team.</h2>
            <p style="color:var(--text-secondary); font-size:14px; margin-bottom:4px;">Invited by ${esc(ownerName)}</p>
            ${inviteMsg ? `<blockquote style="background:#f9f9f9; border-left:3px solid #689562; padding:10px 14px; margin:16px 0; font-style:italic; color:var(--text-secondary); font-size:14px; text-align:left; border-radius:0 6px 6px 0;">"${esc(inviteMsg)}"</blockquote>` : ''}
            <p style="color:var(--text-secondary); font-size:13px; line-height:1.5; margin:16px 0;">Vet Buddies connects pet owners with their care team and a dedicated Vet Buddy — a CSU veterinary student who keeps everyone in the loop between vet visits.</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
              <button class="btn btn-primary" data-action="care-team-invite-signup" style="width:100%; padding:12px;">Create my account</button>
              <button class="btn btn-secondary" data-action="care-team-invite-login" style="width:100%; padding:12px;">I already have an account</button>
            </div>
          </div>
        </div>
      `;
    }

    function renderClientDashboard() {
      if (state.cases.length === 0) {
        const subStatus = state.profile?.subscription_status;
        const hasAccess = hasActiveAccess(state.profile);
        return renderLayout(`
          <div class="empty-state">
            <div class="empty-state-icon">🐕</div>
            <div class="empty-state-title">${hasAccess ? "Let's add your pet!" : 'Welcome to Vet Buddies'}</div>
            <div class="empty-state-text">${hasAccess ? 'Add your pet to get started — they deserve a Buddy.' : 'Subscribe to a plan below to get started with personalized care coordination.'}</div>
            ${hasAccess ? '<button class="btn btn-primary" data-action="nav-add-pet" style="margin-top: 16px;">Add Your Pet</button>' : ''}
          </div>
          ${!hasAccess ? renderSubscriptionCard() : ''}
        `);
      }

      // Multi-pet: use activePetIndex to pick which case to show
      const idx = Math.min(state.activePetIndex || 0, state.cases.length - 1);
      const petCase = state.cases[idx];
      const pet = petCase.pets;
      const buddy = petCase.assigned_buddy;
      const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';
      const tier = TIER_DISPLAY[petCase.subscription_tier] || petCase.subscription_tier;

      const petSwitcher = state.cases.length > 1 ? `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title" style="margin-bottom:10px;">My Pets</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
            ${state.cases.map((c, i) => `
              <button data-action="switch-active-pet" data-idx="${i}"
                style="display:flex; align-items:center; gap:8px; padding:8px 14px 8px 8px; border-radius:30px; border:2px solid ${i===idx ? 'var(--primary)' : 'var(--border)'}; background:${i===idx ? 'rgba(42,157,143,0.08)' : 'white'}; cursor:pointer; font-size:13px; font-weight:500; color:#336026; transition:all 0.2s;">
                ${c.pets?.photo_url
                  ? `<img src="${esc(c.pets.photo_url)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid ${i===idx ? 'var(--primary)' : 'var(--border)'};" alt="${esc(c.pets?.name)}">`
                  : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#336026);display:flex;align-items:center;justify-content:center;font-size:16px;">${SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾'}</div>`}
                ${esc(c.pets?.name) || 'Pet'}${c._coOwned ? '<span class="co-owner-badge-inline">Shared</span>' : ''}
              </button>`).join('')}
          </div>
        </div>` : '';

      // Trial banner / expired overlay
      const _trialActive = isTrialActive(state.profile);
      const _trialExpired = isTrialExpired(state.profile);
      const _trialDays = getTrialDaysRemaining(state.profile);

      // Expired trial: read-only mode with persistent banner (no hard lockout)
      const expiredBanner = _trialExpired ? `
        <div class="card" style="border-left:4px solid var(--red);background:linear-gradient(135deg,#fff5f5,#fff);margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:2px;">Your Free Trial Has Ended</div>
              <div style="font-size:14px;color:var(--text-secondary);">Subscribe to continue check-ins with your Vet Buddy and updating your care plan. Your pet's information is safe and you can still view everything here.</div>
            </div>
            <button class="btn btn-primary" data-action="nav-subscribe" style="white-space:nowrap;">Choose a Plan</button>
          </div>
        </div>` : '';

      if (false) {
        // Legacy lockout code removed — replaced with read-only banner above
      }

      const trialBanner = _trialActive ? `
        <div class="card" style="border-left:4px solid #f39c12;background:linear-gradient(135deg,#fffbf0,#fff);margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:13px;font-weight:700;color:#e67e22;margin-bottom:2px;">🎉 Free Trial Active</div>
              <div style="font-size:14px;color:var(--text-secondary);">${_trialDays} day${_trialDays !== 1 ? 's' : ''} remaining — subscribe anytime to keep your access.</div>
            </div>
            <button class="btn btn-primary" data-action="nav-subscribe" style="white-space:nowrap;">Choose a Plan</button>
          </div>
        </div>` : '';

      // First-visit welcome banner (shown once after onboarding)
      const welcomeBanner = state._showWelcomeBanner ? `
        <div class="card" style="border:2px solid var(--primary);background:linear-gradient(135deg,#f0faf9 0%,#fff 100%);margin-bottom:16px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🎉</div>
          <div style="font-size:20px;font-weight:700;color:#336026;margin-bottom:8px;">Welcome to Vet Buddies, ${esc(state.profile.name)}!</div>
          <div style="color:var(--text-secondary);margin-bottom:16px;">Your Buddy ${buddy ? '(' + esc(buddy.name) + ') ' : ''}will reach out within 48 hours to start building your Living Care Plan together. In the meantime, feel free to explore!</div>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="messages">Send a Message</button>
            <button class="btn btn-secondary" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="careplan">View Care Plan</button>
          </div>
          <div style="margin-top:12px;">
            <button data-action="dismiss-welcome" style="background:none;border:none;color:var(--text-secondary);font-size:13px;cursor:pointer;text-decoration:underline;">Got it!</button>
          </div>
        </div>` : '';

      const coOwnerInviteBanner = renderPendingCoOwnerInvites();

      // ── Care Plan Dashboard Data ──
      const lp = state.carePlan?.living_plan || emptyLivingCarePlan();
      const cpRaw = state.carePlan || {};
      const nextAppt = (state.appointments || []).find(a => a.status !== 'cancelled' && new Date(a.scheduled_at) >= new Date());
      const activeGoals = (lp.active_care_goals || []).filter(g => g.status !== 'completed');
      const completedGoals = (lp.active_care_goals || []).filter(g => g.status === 'completed');
      const recentLog = [...(lp.engagement_log || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
      const milestones = (lp.milestones_and_wins || []).slice(-3);

      // Care plan summary fields
      const summaryFields = [
        ['Diagnoses', lp.diagnoses || cpRaw.diagnoses],
        ['Allergies', lp.allergies || cpRaw.allergies],
        ['Medications', lp.medications || (cpRaw.medications?.length ? cpRaw.medications.map(m => typeof m === 'string' ? m : m.name).join(', ') : null)],
        ['Diet', lp.diet_notes || cpRaw.diet_notes],
        ['Next Steps', lp.next_steps || cpRaw.next_steps],
      ].filter(([, val]) => val && val !== '[]' && val !== 'null');

      const hasCarePlan = summaryFields.length > 0 || activeGoals.length > 0 || lp.pet_profile;

      // ── Pet Profile Card Data ──
      const _petCareLevel = state._petCareLevel || {};
      const _petBadges = state._petBadges || [];
      const _userCareStats = state._userCareStats || {};
      const _userBadges = state._userBadges || [];
      const _careTeamMembers = state._careTeamMembers || [];
      const _petLevel = getLevelForXP(_petCareLevel.xp_total || 0);
      const _nextLevel = getNextLevelThreshold(_petLevel.level);
      const _xpCurrent = _petCareLevel.xp_total || 0;
      const _xpProgress = _nextLevel ? ((_xpCurrent - _petLevel.xp) / (_nextLevel.xp - _petLevel.xp) * 100) : 100;
      const _petAge = pet?.dob ? (() => { const d = new Date(pet.dob); const now = new Date(); let y = now.getFullYear() - d.getFullYear(); let m = now.getMonth() - d.getMonth(); if (m < 0) { y--; m += 12; } return y > 0 ? y + 'y ' + m + 'mo' : m + ' months'; })() : '';
      const _isLegacy = pet?.legacy_mode || false;
      const _recentTimeline = (state.timelineEntries || []).slice(0, 3);
      const _timelineTypeIcon = { appointment: '🗓️', update: '📝', note: '📌', escalation: '🚨', milestone: '🌟', medication: '💊', vaccine: '💉', message: '💬' };
      const _teamSize = 1 + (buddy ? 1 : 0) + _careTeamMembers.length + (state.petCoOwners || []).length;
      const _communityScore = _userCareStats.community_score || 0;
      const _openCareRequests = state._openCareRequests || [];
      const _pendingCareTeamInvites = state._pendingCareTeamInvites || [];
      const _referrals = state._referrals || [];
      const _caregivers = _careTeamMembers.filter(m => m.role === 'caregiver');
      const _hasCareTeam = _caregivers.length > 0;
      const _careTeamColors = ['#E67E22', '#3498DB', '#9B59B6', '#1ABC9C', '#E74C3C', '#F39C12', '#2ECC71'];
      const _referralsRewarded = _referrals.filter(r => r.reward_status === 'rewarded');
      const _referralCreditTotal = _referralsRewarded.reduce((sum, r) => sum + (parseFloat(r.reward_amount) || 0), 0);

      return renderLayout(`
        ${expiredBanner}
        ${trialBanner}
        ${welcomeBanner}
        ${coOwnerInviteBanner}

        <div class="pet-profile-card${_isLegacy ? ' pet-profile-legacy' : ''}">
          ${_isLegacy ? '<div class="pet-profile-legacy-label">In loving memory</div>' : ''}
          <div class="pet-profile-header">
            ${renderPetPhoto(pet, 'hero')}
            <div class="pet-profile-header-info">
              <div style="font-size:14px; color:var(--text-secondary);">Welcome back, ${esc(state.profile.name)}</div>
              <div class="pet-profile-name">${emoji} ${esc(pet.name)}</div>
              <div style="font-size:13px; color:var(--text-secondary);">${esc(pet.breed || '')}${_petAge ? ' · ' + _petAge : ''}</div>
              ${buddy ? `<div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">Vet Buddy: <strong>${esc(buddy.name)}</strong></div>` : ''}
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;">
                <div class="pet-care-level-badge" title="Care Level ${_petLevel.level}">
                  Level ${_petLevel.level} · ${_petLevel.label}
                </div>
                ${getUserTier() === 'buddy_vip' ? '<div class="vip-profile-badge">👑 VIP</div>' : ''}
                ${canAccessFeature('community_score') && _communityScore > 0 ? `<div class="community-score-chip" title="Community Score">${_communityScore} Community</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-self:flex-start;">
              <button class="btn btn-primary btn-small" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="messages" style="font-size:13px;">💬 Messages${state.unreadCount ? ' (' + state.unreadCount + ')' : ''}</button>
              <button class="btn btn-secondary btn-small" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="careplan" style="font-size:13px;">📋 Full Care Plan</button>
            </div>
          </div>

          <div class="pet-xp-bar-container">
            <div class="pet-xp-bar-labels">
              <span>${_xpCurrent} XP${getXPMultiplier() > 1 ? ` <span class="xp-multiplier-chip">${getXPMultiplier()}x</span>` : ''}</span>
              <span>${_nextLevel ? _nextLevel.xp + ' XP for Level ' + _nextLevel.level : 'Max Level!'}</span>
            </div>
            <div class="pet-xp-bar">
              <div class="pet-xp-bar-fill" style="width:${Math.min(_xpProgress, 100)}%"></div>
            </div>
            ${_petCareLevel.streak_days > 1 ? `<div class="pet-streak-indicator">🔥 ${_petCareLevel.streak_days}-day streak</div>` : ''}
          </div>

          <div class="pet-quick-stats">
            <div class="pet-quick-stat">
              <div class="pet-quick-stat-value">${_petCareLevel.streak_days || 0}</div>
              <div class="pet-quick-stat-label">Streak</div>
            </div>
            <div class="pet-quick-stat">
              <div class="pet-quick-stat-value">${_petBadges.length}</div>
              <div class="pet-quick-stat-label">Badges</div>
            </div>
            <div class="pet-quick-stat">
              <div class="pet-quick-stat-value">${_teamSize}</div>
              <div class="pet-quick-stat-label">Team</div>
            </div>
            <div class="pet-quick-stat">
              <div class="pet-quick-stat-value">${_userCareStats.assists_given || 0}</div>
              <div class="pet-quick-stat-label">Pets Helped</div>
            </div>
          </div>

          <div class="pet-badge-shelf">
            <div class="pet-badge-shelf-title">Badges Earned</div>
            <div class="pet-badge-shelf-row">
              ${_petBadges.length > 0 ? _petBadges.sort((a,b) => a.display_order - b.display_order).map(b => {
                const def = BADGE_DEFINITIONS[b.badge_type] || {};
                return `<div class="pet-badge-item" title="${esc(b.badge_label)}">
                  <span class="pet-badge-emoji">${def.emoji || '🏅'}</span>
                  <span class="pet-badge-label">${esc(b.badge_label)}</span>
                </div>`;
              }).join('') : '<div class="pet-badge-empty">Complete care actions to earn badges</div>'}
            </div>
          </div>

          <div class="care-team-section">
            <div class="care-team-header">
              <span class="care-team-title">Care Team</span>
              ${canAccessFeature('invite_helpers') ? (() => {
                const currentHelpers = _careTeamMembers.filter(m => m.role === 'helper').length;
                const cap = getHelperCap(petCase?.id);
                const canInvite = cap === Infinity || currentHelpers < cap;
                return canInvite
                  ? `<button class="btn btn-secondary btn-small" data-action="toggle-invite-helper" data-case-id="${petCase.id}" data-pet-id="${pet.id}">+ Invite Helper</button>`
                  : `<span style="font-size:11px;color:var(--text-secondary);">Helper limit reached (${currentHelpers}/${cap})</span>`;
              })() : (getUserTier() === 'buddy' ? `<span class="tier-gate-hint" data-action="show-tier-gate" data-feature="invite_helpers">+ Invite Helper ✨</span>` : '')}
            </div>
            <div class="care-team-list">
              <div class="care-team-member">
                ${renderAvatar(state.profile?.avatar_initials, state.profile?.avatar_color || '#888')}
                <div class="care-team-member-info">
                  <div class="care-team-member-name">${esc(state.profile?.name || 'You')}</div>
                  <div class="care-team-role-chip role-owner">Owner</div>
                </div>
              </div>
              ${buddy ? `<div class="care-team-member">
                ${renderAvatar(buddy.avatar_initials, buddy.avatar_color || '#9b59b6')}
                <div class="care-team-member-info">
                  <div class="care-team-member-name">${esc(buddy.name)}</div>
                  <div class="care-team-role-chip role-buddy">Buddy</div>
                </div>
              </div>` : ''}
              ${(state.petCoOwners || []).map(co => `<div class="care-team-member">
                <div class="avatar-circle" style="background:#888;width:28px;height:28px;font-size:11px;">${(co.user?.name || co.invited_email || '?').charAt(0).toUpperCase()}</div>
                <div class="care-team-member-info">
                  <div class="care-team-member-name">${esc(co.user?.name || co.invited_email || 'Co-owner')}</div>
                  <div class="care-team-role-chip role-owner">Co-owner</div>
                </div>
              </div>`).join('')}
              ${_careTeamMembers.map(m => `<div class="care-team-member">
                <div class="avatar-circle" style="background:#e67e22;width:28px;height:28px;font-size:11px;">${(m.display_name || '?').charAt(0).toUpperCase()}</div>
                <div class="care-team-member-info">
                  <div class="care-team-member-name">${esc(m.display_name || 'Helper')}</div>
                  <div class="care-team-role-chip role-helper">Helper</div>
                </div>
              </div>`).join('')}
            </div>
            ${state._showInviteHelper ? `
            <div class="invite-helper-form">
              <div class="form-group"><label>Email address</label><input type="email" data-field="helper-invite-email" placeholder="friend@example.com" class="form-input"></div>
              <div class="form-group"><label>Message (optional)</label><input type="text" data-field="helper-invite-msg" placeholder="Help me care for ${esc(pet.name)}!" class="form-input"></div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button class="btn btn-primary btn-small" data-action="send-helper-invite" data-case-id="${petCase.id}" data-pet-id="${pet.id}">Send Invite</button>
                <button class="btn btn-secondary btn-small" data-action="toggle-invite-helper">Cancel</button>
                <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;">+30 XP when they accept</span>
              </div>
            </div>` : ''}
          </div>


          <div class="care-team-section" style="margin-top:0;">
            ${!_hasCareTeam && _pendingCareTeamInvites.length === 0 ? `
            <div class="card" style="background:linear-gradient(135deg, #f0f7ef 0%, #e8f5e6 100%); border:1px solid #c8e6c4; text-align:center; padding:24px;">
              <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:600; color:#336026; margin-bottom:8px;">${esc(pet.name)} has a care team — let's make it official.</div>
              <div style="font-size:14px; color:var(--text-secondary); margin-bottom:16px;">Who else helps care for ${esc(pet.name)}? Invite them to Vet Buddies so everyone stays on the same page.</div>
              <button class="btn btn-primary" data-action="open-care-team-invite" data-case-id="${petCase.id}" data-pet-id="${pet.id}" data-pet-name="${esc(pet.name)}" data-pet-breed="${esc(pet.breed || '')}" data-owner-name="${esc(state.profile?.name || '')}">+ Invite someone</button>
            </div>
            ` : `
            <div class="care-team-header">
              <span class="care-team-title">${esc(pet.name)}'s Care Team</span>
              <button class="btn btn-secondary btn-small" data-action="open-care-team-invite" data-case-id="${petCase.id}" data-pet-id="${pet.id}" data-pet-name="${esc(pet.name)}" data-pet-breed="${esc(pet.breed || '')}" data-owner-name="${esc(state.profile?.name || '')}">+ Add</button>
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; margin:12px 0;">
              ${_caregivers.map((m, i) => `<div style="text-align:center; min-width:56px;">
                <div class="avatar-circle" style="background:${_careTeamColors[i % _careTeamColors.length]};width:44px;height:44px;font-size:16px;margin:0 auto;">${(m.display_name || '?').charAt(0).toUpperCase()}</div>
                <div style="font-size:11px; margin-top:4px; color:var(--text-primary); max-width:64px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(m.display_name || 'Caregiver')}</div>
              </div>`).join('')}
              <div style="text-align:center; min-width:56px; cursor:pointer;" data-action="open-care-team-invite" data-case-id="${petCase.id}" data-pet-id="${pet.id}" data-pet-name="${esc(pet.name)}" data-pet-breed="${esc(pet.breed || '')}" data-owner-name="${esc(state.profile?.name || '')}">
                <div class="avatar-circle" style="background:#f0f0f0;width:44px;height:44px;font-size:20px;margin:0 auto;color:#999;border:2px dashed #ccc;">+</div>
                <div style="font-size:11px; margin-top:4px; color:var(--text-secondary);">Add</div>
              </div>
            </div>
            ${_xpCurrent > 0 ? `<div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Your team has earned ${_xpCurrent} XP together for ${esc(pet.name)}.</div>` : ''}
            `}
            ${_pendingCareTeamInvites.length > 0 ? `
            <div style="margin-top:8px;">
              ${_pendingCareTeamInvites.map(inv => `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; color:var(--text-secondary);">
                <span style="flex:1;">${esc(inv.first_name || inv.email)}${inv.last_name ? ' ' + esc(inv.last_name) : ''}</span>
                <span class="badge" style="background:#f5f5f5; color:#999; font-size:10px;">Pending</span>
                <a href="#" style="font-size:11px; color:var(--primary);" data-action="resend-care-team-invite" data-invite-id="${inv.id}" data-email="${esc(inv.email)}">Resend</a>
              </div>`).join('')}
            </div>` : ''}
            ${_referrals.length > 0 ? `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
              <div style="font-size:13px; color:var(--text-secondary);">You've brought ${_referrals.length} ${_referrals.length === 1 ? 'person' : 'people'} into ${esc(pet.name)}'s care team.</div>
              ${_referralCreditTotal > 0 ? `<div style="font-size:13px; color:var(--primary); font-weight:600; margin-top:4px;">Referral credits earned: $${_referralCreditTotal.toFixed(2)}</div>` : ''}
              <div style="margin-top:6px;">
                ${_referrals.map(r => {
                  const rStatus = r.reward_status === 'rewarded' ? 'Subscribed' : (r.referred_user_id ? 'Joined' : 'Pending');
                  const rColor = r.reward_status === 'rewarded' ? '#2ECC71' : (r.referred_user_id ? '#3498DB' : '#999');
                  return `<div style="display:flex; align-items:center; gap:8px; font-size:12px; padding:3px 0;">
                    <span style="flex:1; color:var(--text-secondary);">${esc(r.referred_email)}</span>
                    <span style="color:${rColor}; font-weight:500;">${rStatus}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>` : ''}
          </div>

          ${(() => {
            if (!canAccessFeature('care_requests_post')) {
              return renderTierUpgradePrompt('care_requests_post');
            }
            return `<div class="care-requests-section">
              <div class="care-requests-header">
                <span class="care-requests-title">Care Requests</span>
                <button class="btn btn-secondary btn-small" data-action="toggle-post-care-request" data-pet-id="${pet.id}">+ Post a request for ${esc(pet.name)}</button>
              </div>
              ${state._showPostCareRequest ? `
              <div class="care-request-form">
                <div class="form-group"><label>Request type</label>
                  <select data-field="cr-type" class="form-input">
                    <option value="meds_coverage">Medication coverage</option>
                    <option value="check_in">Check-in visit</option>
                    <option value="transport">Transport help</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group"><label>Title</label><input type="text" data-field="cr-title" placeholder="What do you need help with?" class="form-input"></div>
                <div class="form-group"><label>Description</label><textarea data-field="cr-desc" placeholder="Details..." class="form-input" style="height:60px;"></textarea></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <div class="form-group" style="flex:1;min-width:140px;"><label>Needed by</label><input type="date" data-field="cr-needed-by" class="form-input"></div>
                  <div class="form-group" style="flex:1;min-width:140px;"><label>Location hint</label><input type="text" data-field="cr-location" placeholder="e.g. NW Portland" class="form-input"></div>
                </div>
                ${getUserTier() === 'buddy_vip' ? '<label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" data-field="cr-private"> Private (visible only to your care circle)</label>' : ''}
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-primary btn-small" data-action="save-care-request" data-pet-id="${pet.id}">Post Request</button>
                  <button class="btn btn-secondary btn-small" data-action="toggle-post-care-request">Cancel</button>
                </div>
              </div>` : ''}
              ${_openCareRequests.length > 0 ? `
              <div class="care-requests-feed">
                <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Open requests near you</div>
                ${_openCareRequests.map(r => {
                  const rPet = r.pets || {};
                  const rEmoji = SPECIES_EMOJI[rPet.species?.toLowerCase()] || '🐾';
                  const rTypeLabel = { meds_coverage: '💊 Medication', check_in: '👋 Check-in', transport: '🚗 Transport', other: '📋 Other' }[r.request_type] || r.request_type;
                  return `<div class="care-request-card${r.is_private ? ' care-request-private' : ''}">
                    <div class="care-request-card-header">
                      <span>${rEmoji} <strong>${esc(rPet.name || 'Pet')}</strong></span>
                      <span class="care-request-xp-pill">+${r.xp_reward || 25} XP</span>
                    </div>
                    <div class="care-request-card-title">${esc(r.title)}</div>
                    ${r.description ? `<div class="care-request-card-desc">${esc(r.description)}</div>` : ''}
                    <div class="care-request-card-meta">
                      <span class="care-request-type-label">${rTypeLabel}</span>
                      ${r.location_hint ? `<span>📍 ${esc(r.location_hint)}</span>` : ''}
                      ${r.needed_by ? `<span>⏰ ${formatDate(r.needed_by)}</span>` : ''}
                    </div>
                    ${canAccessFeature('care_requests_claim') ? `<button class="btn btn-primary btn-small" data-action="claim-care-request" data-request-id="${r.id}">Offer to help</button>` : ''}
                  </div>`;
                }).join('')}
              </div>` : `<div class="care-requests-empty">No open requests nearby yet. Be the first to post one!</div>`}
            </div>`;
          })()}

          ${(() => {
            if (!canAccessFeature('community_impact')) {
              return renderTierUpgradePrompt('community_impact');
            }
            const _assistsGiven = _userCareStats.assists_given || 0;
            const _assistsReceived = _userCareStats.assists_received || 0;
            const _contextNote = _assistsGiven > _assistsReceived ? 'You give more than you receive' : _assistsReceived > _assistsGiven ? 'Your community is supporting you' : 'Balanced giving and receiving';
            const _myClaimedRequests = state._myClaimedRequests || [];
            const _earnedUserBadges = _userBadges.map(b => b.badge_type);
            return `<div class="community-impact-section">
              <div class="community-impact-title">My Impact</div>
              <div class="community-impact-stats">
                <div class="community-stat community-stat-teal">
                  <div class="community-stat-value">${_assistsGiven}</div>
                  <div class="community-stat-label">Care assists given</div>
                </div>
                <div class="community-stat community-stat-amber">
                  <div class="community-stat-value">${_assistsReceived}</div>
                  <div class="community-stat-label">Care assists received</div>
                </div>
              </div>
              <div class="community-score-display">
                <span class="community-score-number">${_communityScore}</span> Community Score
                <span class="community-score-note">${_contextNote}</span>
              </div>
              <div class="user-badge-shelf">
                <div class="user-badge-shelf-title">Community Badges</div>
                <div class="user-badge-shelf-row">
                  ${Object.entries(COMMUNITY_BADGE_DEFINITIONS).map(([type, def]) => {
                    const earned = _earnedUserBadges.includes(type);
                    const locked = (type === 'community_pillar' || type === 'care_village') && getUserTier() !== 'buddy_vip';
                    return `<div class="user-badge-pill ${earned ? 'earned' : 'locked'}" title="${earned ? def.label : (locked ? 'Buddy VIP only: ' : '') + def.unlock}">
                      <span>${earned ? def.emoji : '🔒'}</span>
                      <span>${def.label}</span>
                    </div>`;
                  }).join('')}
                </div>
              </div>
              ${_myClaimedRequests.length > 0 ? `
              <div class="my-helping-list">
                <div class="my-helping-title">Pets I'm Helping</div>
                ${_myClaimedRequests.map(r => {
                  const rPet = r.pets || {};
                  return `<div class="my-helping-item">
                    <span>${SPECIES_EMOJI[rPet.species?.toLowerCase()] || '🐾'} ${esc(rPet.name || 'Pet')}</span>
                    <span style="color:var(--text-secondary);font-size:12px;">${esc(r.title || '')}</span>
                    <span class="care-request-xp-pill">+${r.xp_reward || 25} XP</span>
                  </div>`;
                }).join('')}
              </div>` : ''}
            </div>`;
          })()}

          <div class="pet-care-story-section">
            <label class="pet-care-story-label">Your pet's story</label>
            <textarea class="pet-care-story-textarea" data-field="pet-care-story" placeholder="Share what makes ${esc(pet.name)} special...">${esc(pet.care_story || '')}</textarea>
            <button class="btn btn-secondary btn-small pet-care-story-save" data-action="save-care-story" data-pet-id="${pet.id}">Save Story</button>
          </div>

          ${_isLegacy ? '<div class="pet-legacy-note">This care record is permanently preserved.</div>' : ''}
        </div>

        ${petSwitcher}

        ${nextAppt ? `
        <div class="card" style="border-left:4px solid var(--primary);margin-bottom:16px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary);margin-bottom:2px;">Next Appointment</div>
              <div style="font-size:15px;font-weight:600;color:#336026;">${formatDateTime(nextAppt.scheduled_at)}</div>
              ${nextAppt.type ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${esc(nextAppt.type)}</div>` : ''}
            </div>
            <button class="btn btn-secondary btn-small" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="appointments">View All</button>
          </div>
        </div>` : ''}

        ${hasCarePlan ? `
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="card-title" style="margin:0;">Care Summary</div>
          </div>
          ${lp.pet_profile ? `<div style="font-size:13px;line-height:1.6;color:var(--text-secondary);margin-bottom:12px;padding:10px 12px;background:var(--bg);border-radius:8px;">${esc(lp.pet_profile)}</div>` : ''}
          ${summaryFields.length > 0 ? `<div style="display:grid;gap:0;">
            ${summaryFields.map(([label, val]) => `
              <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                <div style="min-width:110px;color:var(--text-secondary);font-weight:600;">${label}</div>
                <div style="color:var(--text);line-height:1.5;">${esc(val)}</div>
              </div>`).join('')}
          </div>` : ''}
        </div>` : `
        <div class="card" style="margin-bottom:16px;text-align:center;padding:24px;">
          <div style="font-size:32px;margin-bottom:8px;">📋</div>
          <div style="font-weight:600;color:#336026;margin-bottom:4px;">Your Living Care Plan</div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">Your Buddy will start building your pet's care plan after your first check-in. It will appear right here.</div>
        </div>`}

        ${activeGoals.length > 0 ? `
        <div class="card" style="border-left:4px solid var(--green);margin-bottom:16px;">
          <div class="card-title" style="margin-bottom:10px;">Active Care Goals</div>
          ${activeGoals.map(g => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
              <div style="margin-top:2px;font-size:16px;">🎯</div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:500;">${esc(g.goal_text)}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
                  ${g.set_by_owner ? 'Set by you' : 'Set by Buddy'}${g.reviewed_at ? ' · Last reviewed ' + formatDate(g.reviewed_at) : ''}
                </div>
              </div>
            </div>`).join('')}
          ${completedGoals.length > 0 ? `<div style="font-size:12px;color:var(--green);margin-top:8px;font-weight:500;">${completedGoals.length} goal${completedGoals.length !== 1 ? 's' : ''} completed</div>` : ''}
        </div>` : ''}

        ${milestones.length > 0 ? `
        <div class="card" style="border-left:4px solid var(--amber);margin-bottom:16px;background:linear-gradient(135deg,#fffde7 0%,#fff8e1 100%);">
          <div class="card-title" style="margin-bottom:10px;">Recent Wins</div>
          ${milestones.map(m => `
            <div style="background:white;border-radius:8px;padding:10px 12px;margin-bottom:6px;border:1px solid #ffe082;">
              <div style="font-weight:600;color:#f57f17;font-size:13px;">🌟 ${esc(m.title)}</div>
              ${m.description ? `<div style="font-size:12px;margin-top:2px;color:var(--text-secondary);">${esc(m.description)}</div>` : ''}
            </div>`).join('')}
        </div>` : ''}

        ${recentLog.length > 0 ? `
        <div class="card" style="border-left:4px solid var(--purple);margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div class="card-title" style="margin:0;">Recent Check-ins</div>
            <button class="btn btn-secondary btn-small" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="careplan" style="font-size:11px;">View All</button>
          </div>
          ${recentLog.map(entry => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
              <div style="font-size:13px;line-height:1.5;">${esc(entry.entry_text)}</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">— ${esc(entry.created_by) || 'Buddy'} · ${entry.created_at ? formatDate(entry.created_at) : ''}</div>
            </div>`).join('')}
        </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:10px;margin-bottom:16px;">
          <div class="card" style="padding:14px;text-align:center;cursor:pointer;" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="appointments">
            <div style="font-size:20px;margin-bottom:4px;">🗓️</div><div style="font-weight:500;font-size:12px;color:#336026;">Appointments</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;cursor:pointer;" data-action="nav-client-case" data-case-id="${petCase.id}" data-tab="files">
            <div style="font-size:20px;margin-bottom:4px;">📁</div><div style="font-weight:500;font-size:12px;color:#336026;">Files</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;cursor:pointer;" data-action="nav-add-pet">
            <div style="font-size:20px;margin-bottom:4px;">➕</div><div style="font-weight:500;font-size:12px;color:#336026;">Add Pet</div>
          </div>
        </div>

        ${renderSubscriptionCard()}
      `);
    }

    // ── Stripe plan config ──────────────────────────────────────────────
    const STRIPE_PLANS = [
      {
        id: 'price_1TLxfzCoogKs3SGPIctkgMhW',
        name: 'Buddy',
        price: '$19.99',
        tier: 'Buddy',
        emoji: '🐾',
        features: ['1 check-in per month from your Vet Buddy', 'Digital Living Care Plan', 'Care coordination between vet visits'],
        highlight: false,
      },
      {
        id: 'price_1TLxg0CoogKs3SGPAdQBsb8d',
        name: 'Buddy+',
        price: '$29.99',
        tier: 'Buddy+',
        emoji: '⭐',
        features: ['1 check-in per week from your Vet Buddy', 'Digital Living Care Plan', 'Care coordination between vet visits'],
        highlight: true,
      },
      {
        id: 'price_1T7VxVCoogKs3SGPwcXrK0kI',
        name: 'Buddy VIP',
        price: '$279',
        tier: 'Buddy VIP',
        emoji: '👑',
        features: ['Weekly check-ins from your Vet Buddy', 'Monthly check-ins from a veterinarian', 'Digital Living Care Plan', 'Care coordination between vet visits'],
        highlight: false,
      },
    ];

    const PRICE_TO_NAME = {
      'price_1TLxfzCoogKs3SGPIctkgMhW': 'Buddy',
      'price_1TLxg0CoogKs3SGPAdQBsb8d': 'Buddy+',
      'price_1T7VxVCoogKs3SGPwcXrK0kI': 'Buddy VIP',
      // LTO price IDs
      [CONFIG.LTO_PRICES.buddy.priceId]: 'Buddy',
      [CONFIG.LTO_PRICES.buddy_plus.priceId]: 'Buddy+',
    };

    // Trial helpers (getTrialDaysRemaining, isTrialActive, etc.) are in utils.js
    // TIER_LEVELS, FEATURE_MIN_TIER, getTierLevel are in utils.js
    const TRIAL_DURATION_DAYS = CONFIG.TRIAL_DURATION_DAYS;

    function hasFeatureAccess(feature) {
      if (!state.profile || state.profile.role !== 'client') return true; // Non-clients have full access
      const caseTier = state.currentCase?.subscription_tier || 'Buddy';
      const userLevel = getTierLevel(caseTier);
      const required = FEATURE_MIN_TIER[feature] || 1;
      return userLevel >= required;
    }

    function renderUpgradePrompt(feature, currentTier) {
      const needed = FEATURE_MIN_TIER[feature] || 1;
      const tierName = needed >= 3 ? 'Buddy VIP' : 'Buddy+';
      return `<div style="background:linear-gradient(135deg,#f8f4ff,#fff8f0);border:1px solid var(--border);border-radius:10px;padding:20px;text-align:center;margin:12px 0;">
        <div style="font-size:24px;margin-bottom:8px;">🔒</div>
        <div style="font-weight:600;margin-bottom:4px;">Upgrade to ${tierName}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">This feature is available on the ${tierName} plan and above.</div>
        <button class="btn btn-primary btn-small" data-action="manage-billing">Upgrade Now</button>
      </div>`;
    }

    async function callEdgeFunction(fnName, body) {
      const { data, error } = await sb.functions.invoke(fnName, { body });
      if (error) throw new Error(error.message || 'Edge function error');
      return data;
    }

    // ============================================
    // NOTIFICATION SYSTEM
    // ============================================

    // Notification sound — short gentle chime using Web Audio API
    function playNotificationSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        // Second tone for pleasant chime
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.55);
      } catch (e) {
        // Audio not available — fail silently
      }
    }

    // Vibrate on mobile if supported
    function vibrateIfMobile() {
      try {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    // Request push notification permission
    async function requestNotificationPermission() {
      if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser', 'info');
        return 'denied';
      }
      if (Notification.permission === 'granted') {
        state.notificationPermission = 'granted';
        state.notificationSettings.push_enabled = true;
        await subscribeToPush();
        return 'granted';
      }
      if (Notification.permission === 'denied') {
        state.notificationPermission = 'denied';
        showToast('Notifications are blocked. Please enable them in your browser settings.', 'error');
        return 'denied';
      }
      try {
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission;
        state.notificationSettings.push_enabled = permission === 'granted';
        if (permission === 'granted') {
          await subscribeToPush();
          showToast('Notifications enabled! 🔔', 'success');
        } else {
          showToast('Notifications were not enabled', 'info');
        }
        return permission;
      } catch (e) {
        console.error('Notification permission error:', e);
        return 'denied';
      }
    }

    // Subscribe to Web Push via PushManager and store subscription in Supabase
    async function subscribeToPush() {
      if (!navigator.serviceWorker || !state.profile || VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        const subJson = subscription.toJSON();
        await sb.from('push_subscriptions').upsert({
          user_id: state.profile.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
          created_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });
      } catch (e) {
        console.warn('Push subscription failed, falling back to local notifications:', e);
      }
    }

    // Unsubscribe from Web Push and remove subscription from Supabase
    async function unsubscribeFromPush() {
      if (!navigator.serviceWorker || !state.profile) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
      } catch (e) {
        console.warn('Push unsubscribe error:', e);
      }
    }

    // Convert VAPID key from base64 URL to Uint8Array
    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    }

    // Show a local push notification (works when app is in foreground on mobile PWA)
    function showLocalNotification(title, body, data = {}) {
      // Suppress sound/vibrate/push during quiet hours (urgent always gets through)
      if (isQuietHoursActive() && !data.urgent) return;
      // Play sound + vibrate for in-app awareness
      playNotificationSound();
      vibrateIfMobile();

      // Show native notification if permitted and user isn't viewing this case's messages
      const viewingThisCase = !document.hidden && state.caseId === data.caseId;
      if (Notification.permission === 'granted' && !viewingThisCase) {
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(title, {
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.tag || 'vetbuddies-msg-' + Date.now(),
                renotify: true,
                vibrate: [200, 100, 200],
                data: { url: '/', caseId: data.caseId || null },
              });
            });
          } else {
            new Notification(title, { body, icon: '/icon-192.png', tag: data.tag || 'vetbuddies-msg' });
          }
        } catch (e) {
          console.warn('Notification display failed:', e);
        }
      }
    }

    // ── Appointment Reminder System ──────────────────────────
    let _appointmentReminderInterval = null;
    const _notifiedApptReminders = new Set();

    async function checkAppointmentReminders() {
      if (!state.profile || !state.cases || state.cases.length === 0) return;
      try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1h = new Date(now.getTime() + 60 * 60 * 1000);

        // Fetch upcoming appointments across all user cases
        const caseIds = state.cases.map(c => c.id);
        const { data: appointments } = await sb.from('appointments')
          .select('id, title, scheduled_at, type, case_id, status')
          .in('case_id', caseIds)
          .neq('status', 'cancelled')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', in24h.toISOString())
          .order('scheduled_at', { ascending: true });

        if (!appointments || appointments.length === 0) return;

        for (const appt of appointments) {
          const apptTime = new Date(appt.scheduled_at);
          const minsUntil = Math.round((apptTime - now) / (1000 * 60));

          // Notify at 1 hour and 15 minutes before
          if (minsUntil <= 60 && minsUntil > 15 && !_notifiedApptReminders.has(appt.id + '-1h')) {
            _notifiedApptReminders.add(appt.id + '-1h');
            showToast(`⏰ Appointment in ~1 hour: ${appt.title}`, 'info');
            showLocalNotification('Appointment Reminder', `${appt.title} in about 1 hour (${appt.type})`, { tag: 'appt-reminder-' + appt.id });
          } else if (minsUntil <= 15 && minsUntil > 0 && !_notifiedApptReminders.has(appt.id + '-15m')) {
            _notifiedApptReminders.add(appt.id + '-15m');
            showToast(`⏰ Appointment in ${minsUntil} minutes: ${appt.title}`, 'info');
            showLocalNotification('Appointment Starting Soon!', `${appt.title} starts in ${minsUntil} minutes`, { tag: 'appt-reminder-' + appt.id });
          }
        }
      } catch (e) {
        console.warn('Appointment reminder check failed:', e);
      }
    }

    function startAppointmentReminders() {
      if (_appointmentReminderInterval) clearInterval(_appointmentReminderInterval);
      checkAppointmentReminders(); // Check immediately
      _appointmentReminderInterval = setInterval(checkAppointmentReminders, 5 * 60 * 1000); // Every 5 minutes
    }

    function stopAppointmentReminders() {
      if (_appointmentReminderInterval) { clearInterval(_appointmentReminderInterval); _appointmentReminderInterval = null; }
    }

    // Load notification preferences from DB (notification_preferences table)
    async function loadNotificationSettings() {
      if (!state.profile) return;
      try {
        const { data, error } = await sb.from('notification_preferences')
          .select('*')
          .eq('user_id', state.profile.id)
          .maybeSingle();
        if (error) { console.warn('notification_preferences load:', error.message); return; }
        if (data) {
          state.notificationSettings = {
            email_messages: data.email_messages ?? true,
            email_escalations: data.email_escalations ?? true,
            weekly_digest: data.weekly_digest ?? false,
            push_enabled: data.push_enabled ?? false,
            sms_enabled: data.sms_enabled ?? false,
            sms_phone: data.sms_phone || '',
            quiet_hours_start: data.quiet_hours_start || '',
            quiet_hours_end: data.quiet_hours_end || '',
          };
        }
      } catch (e) {
        console.warn('loadNotificationSettings:', e);
      }
    }

    // Save notification preferences to DB
    async function saveNotificationSettings() {
      if (!state.profile) return;
      try {
        const payload = {
          user_id: state.profile.id,
          email_messages: state.notificationSettings.email_messages,
          email_escalations: state.notificationSettings.email_escalations,
          weekly_digest: state.notificationSettings.weekly_digest,
          push_enabled: state.notificationSettings.push_enabled,
          sms_enabled: state.notificationSettings.sms_enabled || false,
          sms_phone: state.notificationSettings.sms_phone || null,
          quiet_hours_start: state.notificationSettings.quiet_hours_start || null,
          quiet_hours_end: state.notificationSettings.quiet_hours_end || null,
          muted_case_ids: state.notificationSettings.muted_case_ids || [],
          updated_at: new Date().toISOString(),
        };
        const { error } = await sb.from('notification_preferences').upsert(payload, { onConflict: 'user_id' });
        if (error) {
          console.warn('notification_preferences save:', error.message);
          // Table might not exist yet — save to localStorage as fallback
          try { localStorage.setItem('vb_notif_prefs_' + state.profile.id, JSON.stringify(state.notificationSettings)); } catch(e) {}
          showToast('Preferences saved locally', 'success');
          return;
        }
        showToast('Notification preferences saved!', 'success');
      } catch (e) {
        console.warn('saveNotificationSettings:', e);
        try { localStorage.setItem('vb_notif_prefs_' + state.profile.id, JSON.stringify(state.notificationSettings)); } catch(e2) {}
        showToast('Preferences saved locally', 'success');
      }
    }

    // ── SMS Notification ──────────────────────────────────
    async function sendSmsNotification(userId, message) {
      try {
        await callEdgeFunction('send-sms-notification', { user_id: userId, message });
      } catch (e) {
        console.warn('SMS notification failed:', e);
      }
    }

    // ── Client unread count ──
    async function loadClientUnreadCount() {
      if (!state.profile || state.profile.role !== 'client') return;
      try {
        // Get the client's case IDs
        const caseIds = (state.cases || []).map(c => c.id);
        if (!caseIds.length) { state.clientUnreadCount = 0; return; }
        const { count, error } = await sb.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read_by_client', false)
          .neq('sender_role', 'client')
          .in('case_id', caseIds);
        if (error) throw error;
        state.clientUnreadCount = count || 0;
        // Also update generic unreadCount for badge display
        state.unreadCount = state.clientUnreadCount;
      } catch (err) {
        console.error('loadClientUnreadCount:', err);
      }
    }

    // ── Global realtime channel — listens for ALL new messages, not just current case ──
    function subscribeToGlobalNotifications() {
      // Clean up existing global channel
      if (state.globalNotifChannel) {
        sb.removeChannel(state.globalNotifChannel);
        state.globalNotifChannel = null;
      }
      if (!state.profile) return;

      const channelName = `global-notif:${state.profile.id}`;
      state.globalNotifChannel = sb
        .channel(channelName)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, async (payload) => {
          const msg = payload.new;
          // Skip own messages
          if (msg.sender_id === state.profile?.id) return;

          const role = state.profile?.role;
          const isStaff = ['admin', 'vet_buddy'].includes(role);
          const isClient = role === 'client';

          // Staff: only care about client messages
          if (isStaff && msg.sender_role !== 'client') return;
          // Client: only care about staff messages in their cases
          if (isClient && msg.sender_role === 'client') return;

          // For vet_buddies, only their assigned cases
          if (role === 'vet_buddy') {
            const buddyCaseIds = (state.cases || []).map(c => c.id);
            if (!buddyCaseIds.includes(msg.case_id)) return;
          }
          // For clients, only their own cases
          if (isClient) {
            const clientCaseIds = (state.cases || []).map(c => c.id);
            if (!clientCaseIds.includes(msg.case_id)) return;
          }

          // Don't double-count if we're already viewing this case's messages
          if (state.caseId === msg.case_id && state.messages.some(m => m.id === msg.id)) return;
          // Skip if per-case handler already notified for this message
          if (state.notifiedMessageIds.has(msg.id)) return;

          // Skip if this case is muted
          if ((state.notificationSettings.muted_case_ids || []).includes(msg.case_id)) return;

          // If actively viewing this case, just re-render (no sound/notification/badge bump)
          if (!document.hidden && state.caseId === msg.case_id) { render(); return; }

          // Update unread count
          state.unreadCount = Math.max(0, state.unreadCount + 1);
          if (isClient) state.clientUnreadCount = Math.max(0, state.clientUnreadCount + 1);

          // Get sender name for notification
          let senderName = 'Someone';
          try {
            const { data: sender } = await sb.from('users').select('name, role').eq('id', msg.sender_id).single();
            if (sender) senderName = sender.name || (sender.role === 'vet_buddy' ? 'Your Buddy' : 'Vet Buddies Team');
          } catch (e) {}

          // Show local notification
          const preview = (msg.content || '').substring(0, 80) + ((msg.content || '').length > 80 ? '…' : '');
          const urgentPrefix = msg.is_urgent ? '🚨 URGENT: ' : '';
          showLocalNotification(
            urgentPrefix + senderName,
            preview || 'Sent a message',
            { caseId: msg.case_id, tag: 'msg-' + msg.id, urgent: !!msg.is_urgent }
          );

          // Update inbox messages if panel is open
          if (state.showNotifications && isStaff) {
            await loadAllUnreadMessages();
          }

          // Contextual push prompt — show on first real incoming message
          if (('Notification' in window) && Notification.permission === 'default' && !localStorage.getItem('vb_push_prompted')) {
            state.showPushPromptBanner = true;
            state.showPushPromptInPanel = true;
            localStorage.setItem('vb_push_prompted', '1');
          }

          render();
        })
        .subscribe();
    }

    function renderSubscriptionCard() {
      const status = state.profile?.subscription_status || 'none';
      const priceId = state.profile?.subscription_tier_stripe;
      const planName = PRICE_TO_NAME[priceId] || null;

      const isFoundingMember = state.profile?.founding_member || false;

      if (status === 'active') {
        return `
          <div class="card" style="border-left: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); font-weight: 700; margin-bottom: 4px;">Active Subscription</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${planName || 'Active Plan'}</div>
                ${isFoundingMember ? '<div style="margin-top:6px;"><span style="display:inline-block;background:linear-gradient(135deg,#ffd700,#f5c842);color:#5d4e00;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.3px;">✨ Founding Member — Lifetime Rate</span></div>' : ''}
              </div>
              <button class="btn btn-secondary" data-action="manage-billing" style="white-space: nowrap;">⚙️ Manage Billing</button>
            </div>
          </div>`;
      }

      if (status === 'trialing') {
        const _days = getTrialDaysRemaining(state.profile);
        const _expired = _days <= 0;
        if (!_expired) {
          return `
            <div class="card" style="border-left: 4px solid #f39c12;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <div>
                  <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #e67e22; font-weight: 700; margin-bottom: 4px;">Free Trial</div>
                  <div style="font-size: 20px; font-weight: 700; color: #336026;">${_days} day${_days !== 1 ? 's' : ''} remaining</div>
                  <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">Check-ins, Living Care Plan & care coordination</div>
                </div>
                <button class="btn btn-primary" data-action="nav-subscribe" style="white-space: nowrap;">Subscribe Now</button>
              </div>
            </div>`;
        }
        // Expired trial — show plan picker below
      }

      if (status === 'past_due') {
        return `
          <div class="card" style="border-left: 4px solid var(--red);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="font-size: 12px; color: var(--red); font-weight: 700; margin-bottom: 4px;">⚠️ PAYMENT PAST DUE</div>
                <div style="color: var(--text-secondary); font-size: 14px;">Please update your payment method to keep your plan active.</div>
              </div>
              <button class="btn btn-primary" data-action="manage-billing">Fix Billing</button>
            </div>
          </div>`;
      }

      // Not subscribed — show plan picker (value-first, pricing subtle)
      const _ltoActive = isLTOActive();
      const _planKeyMap = { 'price_1TLxfzCoogKs3SGPIctkgMhW': 'buddy', 'price_1TLxg0CoogKs3SGPAdQBsb8d': 'buddy_plus', 'price_1T7VxVCoogKs3SGPwcXrK0kI': 'buddy_vip' };
      return `
        <div class="card">
          <div class="card-title" style="margin-bottom: 4px;">🐾 Get Started with Vet Buddies</div>
          <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Your pet's own Living Care Plan — built and maintained by a dedicated trained veterinary professional, with Dr. Rodgers as your clinical safety net.</div>
          <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;">Choose the level of care that fits your pet's needs:</div>
          ${_ltoActive ? renderLTOCountdownBanner() : ''}
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;" class="plans-grid">
            ${STRIPE_PLANS.map(plan => {
              const _pk = _planKeyMap[plan.id] || 'buddy_vip';
              const _pr = getActivePricing(_pk);
              const _priceHtml = _pr.isLTO
                ? `<div class="lto-badge" style="margin-top:8px;">Limited Time</div>
                   <div style="margin-top:4px;"><span class="lto-price-original">${_pr.regularPrice}/mo</span></div>
                   <div style="font-size:22px;font-weight:700;color:#4F152F;">${_pr.price}<span style="font-size:13px;font-weight:400;color:var(--text-secondary);">/mo</span></div>
                   <div class="lto-savings">Save $${(_pr.regularAmount - _pr.amount).toFixed(2)}/mo</div>`
                : `<div style="text-align: center; margin-top: 8px; font-size: 12px; color: var(--text-secondary);">${_pr.price}/mo</div>`;
              return `
              <div style="border: 2px solid ${plan.highlight ? 'var(--primary)' : 'var(--border)'}; border-radius: 12px; padding: 20px; position: relative; ${plan.highlight ? 'background: linear-gradient(135deg, #f0faf9 0%, #fff 100%);' : ''} ${_pr.isLTO ? 'border-top: 3px solid #4F152F;' : ''}">
                ${plan.highlight ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;white-space:nowrap;">MOST POPULAR</div>' : ''}
                <div style="font-size: 22px; margin-bottom: 6px;">${plan.emoji}</div>
                <div style="font-size: 17px; font-weight: 700; color: #336026;">${plan.name}</div>
                <ul style="list-style: none; padding: 0; margin: 12px 0 16px; font-size: 13px; color: var(--text-secondary);">
                  ${plan.features.map(f => `<li style="padding: 3px 0;">✓ ${f}</li>`).join('')}
                </ul>
                <button class="btn ${plan.highlight ? 'btn-primary' : 'btn-secondary'}" data-action="subscribe" data-price-id="${_pr.priceId}" style="width: 100%; font-size: 14px;">${_pr.isLTO ? 'Lock In This Rate' : 'Get Started'}</button>
                ${!_pr.isLTO ? `<div style="text-align: center; margin-top: 8px; font-size: 12px; color: var(--text-secondary);">${_pr.price}/mo</div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    function renderAddPetForm() {
      const preview = window._pendingPetPhotoDataUrl;
      return renderLayout(`
        <div class="card" style="max-width: 480px; margin: 0 auto;">
          <div class="card-title" style="margin-bottom: 20px;">🐾 Add a New Pet</div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label>Pet Photo <span style="color: var(--text-secondary); font-weight: 400;">(optional)</span></label>
            <div class="photo-upload-area" data-action="trigger-photo-upload">
              ${preview
                ? `<img src="${preview}" class="photo-upload-preview" alt="Pet preview">`
                : `<div style="font-size: 36px; margin-bottom: 8px;">📷</div>`}
              <div style="font-size: 14px; color: var(--text-secondary);">${preview ? 'Tap to change photo' : 'Tap to add a photo of your pet'}</div>
            </div>
          </div>

          <div class="form-group">
            <label>Pet Name</label>
            <input type="text" data-field="new-pet-name" placeholder="e.g. Biscuit" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px;">
          </div>
          <div class="form-group" style="margin-top: 16px;">
            <label>Species</label>
            <select data-field="new-pet-species" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px;">
              <option value="Dog">🐕 Dog</option>
              <option value="Cat">🐱 Cat</option>
              <option value="Bird">🐦 Bird</option>
              <option value="Rabbit">🐰 Rabbit</option>
              <option value="Other">🐾 Other</option>
            </select>
          </div>
          <div class="form-group" style="margin-top: 16px;">
            <label>Breed <span style="color: var(--text-secondary); font-weight: 400;">(optional)</span></label>
            <input type="text" data-field="new-pet-breed" placeholder="e.g. Tabby" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px;">
          </div>
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button class="btn btn-primary" data-action="save-new-pet" style="flex: 1;">Save Pet</button>
            <button class="btn btn-secondary" data-action="nav-client-dashboard" style="flex: 1;">Cancel</button>
          </div>
        </div>
      `);
    }

    function renderBuddyDashboard() {
      if (state.cases.length === 0) {
        return renderLayout(`
          <div class="empty-state">
            <div class="empty-state-icon">🐕</div>
            <div class="empty-state-title">No cases yet</div>
            <div class="empty-state-text">Your Living Care Plan is getting started — your Buddy will be in touch soon.</div>
          </div>
        `);
      }

      // ── Daily Agenda ─────────────────────────────────────────────────────
      const today = new Date();
      const todayStr = today.toDateString();
      const todayAppts = (state.buddyAppointments || []).filter(a => new Date(a.scheduled_at).toDateString() === todayStr);
      const unreadBadge = state.unreadCount > 0 ? `<span style="background:var(--red);color:white;border-radius:10px;font-size:11px;font-weight:700;padding:1px 8px;margin-left:8px;">${state.unreadCount} unread</span>` : '';

      let html = `<div style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;margin-bottom:16px;">Good ${today.getHours()<12?'morning':today.getHours()<17?'afternoon':'evening'}, ${esc(state.profile.name.split(' ')[0])}! 👋</div>`;
      html += `<div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,#336026,#689562);color:white;">
        <div style="font-weight:700;margin-bottom:12px;font-size:15px;">📅 Today's Agenda</div>
        ${todayAppts.length === 0
          ? `<div style="opacity:0.8;font-size:13px;">No appointments today — ${state.cases.length} active case${state.cases.length!==1?'s':''}</div>`
          : todayAppts.map(a => `<div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:13px;">
              <strong>${new Date(a.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</strong> — ${esc(a.title)}
              ${a.case?.pets?.name ? `<span style="opacity:0.75;font-size:11px;margin-left:6px;">(${esc(a.case.pets.name)})</span>` : ''}
              ${a.video_url && /^https?:\/\//i.test(a.video_url) ? `<a href="${esc(a.video_url)}" target="_blank" style="color:#a8e6cf;font-size:11px;display:block;margin-top:2px;">🎥 Join Call</a>` : ''}
            </div>`).join('')}
        <div style="margin-top:10px;font-size:12px;opacity:0.8;">Inbox${unreadBadge} · ${state.cases.length} case${state.cases.length!==1?'s':''} assigned</div>
      </div>`;

      // ── Earnings Estimate ──
      const earningsByTier = { 'Buddy': 20 * 0.40, 'Buddy+': 30 * 0.40, 'Buddy VIP': 279 * 0.40 };
      const monthlyEstimate = state.cases.reduce((sum, c) => sum + (earningsByTier[c.subscription_tier] || 39.60), 0);
      html += `<div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);font-weight:700;margin-bottom:4px;">Estimated Monthly Earnings</div>
            <div style="font-size:24px;font-weight:700;color:var(--green);">$${monthlyEstimate.toFixed(2)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">~40% of collected revenue · ${state.cases.length} active client${state.cases.length !== 1 ? 's' : ''}</div>
          </div>
          <div style="text-align:right;">
            ${state.cases.map(c => `<div style="font-size:11px;color:var(--text-secondary);">${esc(c.pets?.name) || '?'}: $${(earningsByTier[c.subscription_tier] || 39.60).toFixed(2)}/mo</div>`).join('')}
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">Earnings are calculated at ~38–42% of collected subscription revenue per assigned client. No hidden deductions. No arbitrary caps.</div>
      </div>`;

      // ── Proactive Check-In Reminders ──
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      // Pre-compute monthly buddy touchpoint counts per case
      const monthlyTpCounts = new Map();
      (state.touchpoints || []).forEach(t => {
        if (t.type === 'buddy' && new Date(t.completed_at) >= startOfMonth) {
          monthlyTpCounts.set(t.case_id, (monthlyTpCounts.get(t.case_id) || 0) + 1);
        }
      });
      const casesNeedingCheckin = state.cases.filter(c => {
        const tier = c.subscription_tier || 'Buddy';
        const target = ['Buddy+', 'Buddy VIP'].includes(tier) ? 4 : 1;
        return (monthlyTpCounts.get(c.id) || 0) < target;
      });
      if (casesNeedingCheckin.length > 0) {
        html += `<div class="card" style="margin-bottom:16px;border-left:4px solid var(--amber);background:#fffde7;">
          <div style="font-weight:700;margin-bottom:8px;font-size:14px;">🔔 Check-In Reminders</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">These cases are due for a proactive wellness check-in this month:</div>
          ${casesNeedingCheckin.map(c => {
            const monthlyDone = monthlyTpCounts.get(c.id) || 0;
            const tier = c.subscription_tier || 'Buddy';
            const target = ['Buddy+', 'Buddy VIP'].includes(tier) ? 4 : 1;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #fff3cd;">
              <span style="font-size:13px;">${SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾'} <strong>${esc(c.pets?.name) || 'Unknown'}</strong> — ${monthlyDone}/${target} check-ins this month</span>
              <button class="btn btn-primary btn-small" data-action="nav-buddy-case" data-case-id="${c.id}" style="font-size:11px;">Open Case</button>
            </div>`;
          }).join('')}
        </div>`;
      }

      html += '<div class="card"><div class="card-title">My Cases</div>';
      for (const petCase of state.cases) {
        const pet = petCase.pets;
        const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';
        const tier = TIER_DISPLAY[petCase.subscription_tier] || petCase.subscription_tier;

        // Count touchpoints for progress
        const buddyCount = state.touchpoints.filter(t => t.type === 'buddy').length;
        const maxTouchpoints = ['buddy', 'Buddy'].includes(petCase.subscription_tier) ? 1 : 4;

        html += `
          <div class="buddy-case-card">
            ${renderPetPhoto(pet, 'card')}
            <div class="buddy-case-content">
              <div class="buddy-case-pet">${esc(pet?.name) || 'Unknown'}</div>
              <div class="buddy-case-owner">Owner: ${esc(state.cases.find(c => c.id === petCase.id)?.pets?.owner?.name) || 'Unknown'}</div>
              <div class="buddy-case-tier">${tier}</div>
              <div class="buddy-case-progress">Check-ins: ${buddyCount}/${maxTouchpoints}</div>
              ${renderProgressBar(buddyCount, maxTouchpoints)}
              <div class="buddy-case-actions">
                <button class="btn btn-primary btn-small" data-action="nav-buddy-case" data-case-id="${petCase.id}">View Case</button>
                <button class="btn btn-secondary btn-small" data-action="log-checkin" data-case-id="${petCase.id}">Log Check-In</button>
              </div>
            </div>
          </div>
        `;
      }
      html += '</div>';

      return renderLayout(html);
    }

    function renderBuddyCase() {
      if (!state.currentCase) return renderLayout('<div class="empty-state"><div class="empty-state-icon">🐕</div><div class="empty-state-title">No case selected</div></div>');

      const pet = state.currentCase.pets;
      const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';

      let html = `<div class="case-detail-layout has-active-case">
        <div class="case-sidebar">
          <div style="font-weight: 600; margin-bottom: 12px;">My Cases</div>`;
      for (const c of state.cases) {
        const isActive = c.id === state.currentCase.id;
        const sidebarEmoji = SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾';
        html += `
          <div class="case-list-item ${isActive ? 'active' : ''}" data-action="select-case" data-case-id="${c.id}" style="display:flex; align-items:center; gap:10px;">
            ${c.pets?.photo_url
              ? `<img src="${esc(c.pets.photo_url)}" class="pet-photo-thumb" alt="${esc(c.pets?.name)}" style="flex-shrink:0;">`
              : `<div class="pet-photo-thumb-placeholder" style="flex-shrink:0;">${sidebarEmoji}</div>`}
            <div style="min-width:0;">
              <div class="case-list-pet-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.pets?.name) || 'Unknown'}</div>
              <div class="case-list-owner" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.pets?.owner?.name) || 'Unknown Owner'}</div>
            </div>
          </div>
        `;
      }
      html += `</div><div>`;

      // Mobile back button
      html += `<button class="mobile-back-btn" data-action="back-to-case-list" style="display:none;margin-bottom:12px;background:none;border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:14px;color:var(--dark);cursor:pointer;">← Back to Cases</button>`;

      const canChangePhoto = ['client', 'vet_buddy', 'admin'].includes(state.profile.role);
      html += `<div class="case-header-wrap">
        <div class="card case-header-card">
          <input type="file" id="change-photo-input" accept="image/*" style="display:none;" data-pet-id="${pet?.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div style="display:flex; align-items:center; gap:16px;">
              ${renderPetPhoto(pet, 'hero', canChangePhoto)}
              <div>
                <div style="font-weight: 600; font-size: 18px;">${esc(pet?.name) || 'Unknown'}</div>
                <div style="font-size: 13px; color: var(--text-secondary);">${esc(pet?.species)} ${pet?.breed ? '· ' + esc(pet.breed) : ''} ${pet?.weight ? '· ' + esc(pet.weight) : ''}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${['client','admin','vet_buddy'].includes(state.profile.role) ? `<button class="btn btn-secondary btn-small" data-action="toggle-edit-pet">${state.showEditPet ? '✕' : '✏️ Edit'}</button>` : ''}
              <button class="btn btn-secondary btn-small" data-action="toggle-mute-case" data-case-id="${state.currentCase.id}" title="${(state.notificationSettings.muted_case_ids || []).includes(state.currentCase.id) ? 'Unmute notifications' : 'Mute notifications'}">${(state.notificationSettings.muted_case_ids || []).includes(state.currentCase.id) ? '🔇 Muted' : '🔔'}</button>
              ${['vet_buddy','admin'].includes(state.profile.role) ? `<button class="btn btn-secondary btn-small" data-action="toggle-raise-escalation" style="border-color:#e74c3c;color:#e74c3c;">${state.showRaiseEscalation ? '✕' : '⚠️ Escalate'}</button>` : ''}
              ${['admin','dvm'].includes(state.profile.role) ? `<button class="btn btn-secondary btn-small" data-action="toggle-legacy-mode" data-pet-id="${pet?.id}" data-current-legacy="${pet?.legacy_mode || false}" style="font-size:11px;">${pet?.legacy_mode ? '🕊 Memorial On' : '🕊 Memorial'}</button>` : ''}
              ${state.currentCase.assigned_buddy ? renderAvatar(state.currentCase.assigned_buddy.avatar_initials, state.currentCase.assigned_buddy.avatar_color) : '<div style="color: var(--text-secondary);">No buddy</div>'}
            </div>
          </div>
          ${state.showRaiseEscalation && ['vet_buddy','admin'].includes(state.profile.role) ? `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
              <div class="form-group"><label>Escalation Type</label>
                <select data-field="escalation-type" style="width:100%;" onchange="const notes=document.getElementById('incident-notes-group');if(notes)notes.style.display=this.value==='adverse_outcome'?'block':'none';">
                  <option value="clinical">Clinical Question</option>
                  <option value="adverse_outcome">Adverse Outcome</option>
                </select>
              </div>
              <div class="form-group"><label>Escalation Reason</label><textarea data-field="escalation-reason" placeholder="Describe the issue requiring escalation..." style="width:100%;height:80px;"></textarea></div>
              <div id="incident-notes-group" class="form-group" style="display:none;">
                <label style="color:var(--red);font-weight:600;">Describe what happened and what guidance was given</label>
                <textarea data-field="incident-notes" placeholder="Required for adverse outcome escalations..." style="width:100%;height:80px;border-color:var(--red);"></textarea>
              </div>
              <button class="btn btn-primary btn-small" data-action="save-escalation" style="background:#e74c3c; border-color:#e74c3c;">Submit Escalation</button>
            </div>` : ''}
          ${['vet_buddy','admin'].includes(state.profile.role) ? `
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-small" data-action="toggle-invite-vet">${state.showInviteVet ? '✕ Cancel Invite' : '👩‍⚕️ Invite External Vet'}</button>
            </div>
            ${state.showInviteVet ? `<div style="margin-top:12px; background:var(--bg); border-radius:8px; padding:14px;">
              <div style="font-weight:600; margin-bottom:10px;">Invite External Vet to this Case</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group"><label>First Name</label><input type="text" data-field="invite-first" placeholder="Jane" style="width:100%;"></div>
                <div class="form-group"><label>Last Name</label><input type="text" data-field="invite-last" placeholder="Smith" style="width:100%;"></div>
              </div>
              <div class="form-group"><label>Email</label><input type="email" data-field="invite-email" placeholder="jane@vetclinic.com" style="width:100%;"></div>
              <div class="form-group"><label>Message (optional)</label><textarea data-field="invite-message" placeholder="Hi Dr. Smith, I'd like your input on this case..." style="width:100%;height:60px;"></textarea></div>
              <button class="btn btn-primary btn-small" data-action="save-invite-vet" data-case-id="${state.currentCase.id}">Send Invite</button>
            </div>` : ''}` : ''}
        </div>
      </div>`;

      // Tabs — clients see simplified tabs; staff see all
      const isClient = state.profile.role === 'client';
      let tabs;
      if (isClient) {
        // Core tabs always visible
        tabs = ['messages', 'careplan', 'appointments'];
        // Conditional tabs — only show when data exists
        if (state.petMedications && state.petMedications.length > 0) tabs.push('medications');
        if (state.petVaccines && state.petVaccines.length > 0) tabs.push('vaccines');
        tabs.push('files');
        tabs.push('co-owners');
      } else {
        tabs = ['careplan', 'messages', 'medications', 'vitals', 'vaccines', 'timeline', 'touchpoints', 'notes', 'appointments', 'files', 'co-owners', 'team'];
      }
      html += '<div class="tabs">';
      const labels = { careplan: 'Care Plan', messages: 'Messages', timeline: 'Timeline', touchpoints: 'Check-ins', appointments: 'Appointments', files: 'Files', medications: 'Meds', vitals: 'Vitals', vaccines: 'Vaccines', notes: 'Notes', 'co-owners': '👥 Owners', team: '🤝 Team' };
      for (const tab of tabs) {
        html += `<button class="tab-button ${state.caseTab === tab ? 'active' : ''}" data-action="switch-case-tab" data-tab="${tab}">${labels[tab]}</button>`;
      }
      html += '</div>';

      // Edit pet profile inline section (toggled by showEditPet)
      if (state.showEditPet && ['client','admin','vet_buddy'].includes(state.profile.role)) {
        const p = state.currentCase.pets;
        html += `<div class="card" style="margin-bottom:16px; background:#f0faf8; border:1px solid var(--primary);">
          <div class="card-title" style="margin-bottom:12px;">✏️ Edit Pet Profile</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group"><label>Weight</label><input type="text" data-field="pet-weight" value="${esc(p?.weight)}" placeholder="e.g. 12 lbs" style="width:100%;"></div>
            <div class="form-group"><label>Date of Birth</label><input type="date" data-field="pet-dob" value="${p?.dob || ''}" style="width:100%;"></div>
          </div>
          <div class="form-group"><label>Notes (behavior, preferences…)</label><textarea data-field="pet-notes" placeholder="Any notes about your pet..." style="width:100%;height:70px;">${esc(p?.notes)}</textarea></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-small" data-action="save-pet-profile" data-pet-id="${p?.id}">Save</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-edit-pet">Cancel</button>
            <div style="flex:1;"></div>
            <button class="btn btn-secondary btn-small" data-action="delete-pet" data-pet-id="${p?.id}" data-pet-name="${esc(p?.name || 'this pet')}" style="border-color:var(--red);color:var(--red);">Remove Pet</button>
          </div>
        </div>`;
      }

      // Tab contents
      html += renderCarePlanTab();
      html += renderMessagesTab();
      html += renderMedicationsTab();
      html += renderVitalsTab();
      html += renderVaccinesTab();
      html += renderTimelineTab();
      html += renderTouchpointsTab();
      html += renderCaseNotesTab();
      html += renderAppointmentsTab();
      html += renderDocumentsTab();
      html += renderCoOwnersTab();
      html += renderTeamTab();

      html += '</div></div>';
      return renderLayout(html);
    }

    function renderCarePlanTab() {
      const isVisible = state.caseTab === 'careplan';
      const canEdit = ['vet_buddy', 'admin'].includes(state.profile.role);
      const isClient = state.profile.role === 'client';
      const isBuddy = state.profile.role === 'vet_buddy';
      const isAdmin = state.profile.role === 'admin';
      const tier = state.currentCase?.subscription_tier || 'Buddy';
      const lp = state.carePlan?.living_plan || emptyLivingCarePlan();
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;

      // Export/Share toolbar
      html += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;">
        <button class="btn btn-secondary btn-small" onclick="window.print()" title="Print or save as PDF">🖨️ Print / Save PDF</button>
        <button class="btn btn-secondary btn-small" data-action="export-care-plan" title="Export PDF 📄 Living Care Plan as text">📤 Share</button>
      </div>`;

      // ── Section 1: Pet Profile ──
      html += `<div class="care-plan-section view-mode" style="border-left:4px solid var(--primary);margin-bottom:16px;">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>🐾 Pet Profile</span>
          ${(canEdit || isClient) ? `<button class="section-edit-btn" data-action="edit-careplan-section" data-section="pet_profile">Edit</button>` : ''}
        </div>
        <div class="section-content">
          ${esc(lp.pet_profile) || '<em style="color: var(--text-secondary);">No pet profile details yet — your Buddy will help fill this in.</em>'}
        </div>
        <div class="section-form">
          <textarea data-field="section-pet_profile" placeholder="Name, species, breed, age, conditions, medications, sensitivities, dietary needs...">${esc(lp.pet_profile)}</textarea>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-small" data-action="save-living-plan-section" data-section="pet_profile">Save</button>
            <button class="btn btn-secondary btn-small" data-action="cancel-careplan-section">Cancel</button>
          </div>
        </div>
      </div>`;

      // ── Section 2: Care Team ──
      html += `<div class="care-plan-section" style="border-left:4px solid var(--blue);margin-bottom:16px;">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>👩‍⚕️ Care Team</span>
          ${(canEdit || isClient) ? `<button class="section-edit-btn" data-action="toggle-add-care-team">+ Add Provider</button>` : ''}
        </div>
        <div class="section-content">`;
      if (lp.care_team.length === 0) {
        html += '<em style="color: var(--text-secondary);">No care team members added yet.</em>';
      } else {
        for (let i = 0; i < lp.care_team.length; i++) {
          const ct = lp.care_team[i];
          html += `<div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:600;">${esc(ct.name) || 'Unknown'}</div>
              <div style="font-size:13px;color:var(--text-secondary);">${esc(ct.role)} ${ct.clinic ? '· ' + esc(ct.clinic) : ''}</div>
              <div style="font-size:12px;color:var(--text-secondary);">${ct.phone ? '📞 ' + esc(ct.phone) : ''} ${ct.email ? '✉️ ' + esc(ct.email) : ''}</div>
            </div>
            ${(canEdit || isClient) ? `<button class="btn btn-secondary btn-small" data-action="remove-care-team" data-index="${i}" style="font-size:11px;">✕</button>` : ''}
          </div>`;
        }
      }
      html += `</div>
        ${state.showAddCareTeam ? `<div style="background:#f0faf8;border-radius:8px;padding:14px;margin-top:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="form-group"><label>Name</label><input type="text" data-field="ct-name" placeholder="Dr. Smith" style="width:100%;"></div>
            <div class="form-group"><label>Role</label><input type="text" data-field="ct-role" placeholder="Primary Vet" style="width:100%;"></div>
            <div class="form-group"><label>Clinic</label><input type="text" data-field="ct-clinic" placeholder="Clinic name" style="width:100%;"></div>
            <div class="form-group"><label>Phone</label><input type="text" data-field="ct-phone" placeholder="(555) 123-4567" style="width:100%;"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" data-field="ct-email" placeholder="doctor@clinic.com" style="width:100%;"></div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-small" data-action="save-care-team-member">Save Provider</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-add-care-team">Cancel</button>
          </div>
        </div>` : ''}
      </div>`;

      // ── Section 3: Active Care Goals (tier-differentiated) ──
      html += `<div class="care-plan-section" style="border-left:4px solid var(--green);margin-bottom:16px;">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>🎯 Active Care Goals</span>
          ${canEdit ? `<button class="section-edit-btn" data-action="toggle-add-goal">+ Add Goal</button>` : ''}
        </div>
        <div class="section-content">`;
      if (lp.active_care_goals.length === 0) {
        html += '<em style="color: var(--text-secondary);">No care goals set yet — your Buddy will work with you to set meaningful goals for your pet.</em>';
      } else {
        for (let i = 0; i < lp.active_care_goals.length; i++) {
          const g = lp.active_care_goals[i];
          const daysSinceReview = g.reviewed_at ? Math.floor((Date.now() - new Date(g.reviewed_at).getTime()) / (1000*60*60*24)) : 999;
          const needsQuarterlyReview = (tier === 'Buddy+' || tier === 'Buddy VIP') && daysSinceReview > 85 && g.status === 'active';
          const isDvmReviewed = g.dvm_reviewed;
          html += `<div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:8px;border-left:3px solid ${g.status === 'completed' ? 'var(--green)' : 'var(--amber)'};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;">
                <div style="font-weight:500;">${esc(g.goal_text)}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                  ${g.set_by_owner ? '✍️ Set by owner' : '📋 Set by Buddy'} · ${g.created_at ? formatDate(g.created_at) : ''}
                  ${g.reviewed_at ? ' · Last reviewed: ' + formatDate(g.reviewed_at) : ''}
                </div>
                ${tier === 'Buddy VIP' && isDvmReviewed ? '<span style="display:inline-block;margin-top:4px;background:#e8f5e9;color:#2e7d32;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">✅ DVM-Reviewed</span>' : ''}
                ${needsQuarterlyReview ? '<div style="margin-top:6px;background:#fff3cd;color:#856404;font-size:12px;padding:4px 8px;border-radius:6px;">⏰ Quarterly Goal Review due — this goal hasn\'t been reviewed in 85+ days</div>' : ''}
              </div>
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${g.status === 'completed' ? '#e8f5e9' : '#fff8e1'};color:${g.status === 'completed' ? '#2e7d32' : '#f57f17'};font-weight:600;">${g.status || 'active'}</span>
                ${canEdit ? `<button class="btn btn-secondary btn-small" data-action="toggle-goal-status" data-index="${i}" style="font-size:10px;padding:2px 6px;">${g.status === 'completed' ? '↩️' : '✓'}</button>` : ''}
                ${tier === 'Buddy VIP' && canEdit && !isDvmReviewed ? `<button class="btn btn-secondary btn-small" data-action="request-dvm-review" data-index="${i}" style="font-size:10px;padding:2px 6px;border-color:var(--primary);color:var(--primary);">Request DVM Review</button>` : ''}
              </div>
            </div>
          </div>`;
        }
      }
      html += `</div>
        ${state.showAddGoal ? `<div style="background:#f0faf8;border-radius:8px;padding:14px;margin-top:8px;">
          <div class="form-group"><label>Goal (in the owner's own words when possible)</label><textarea data-field="goal-text" placeholder="e.g. Help Percy lose 2 lbs over the next 3 months with portion control..." style="width:100%;height:60px;"></textarea></div>
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" data-field="goal-set-by-owner"> Owner wrote this goal themselves</label>
          <button class="btn btn-primary btn-small" data-action="save-new-goal">Save Goal</button>
        </div>` : ''}
      </div>`;

      // ── Section 4: Engagement Log ──
      html += `<div class="care-plan-section" style="border-left:4px solid var(--purple);margin-bottom:16px;">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>📝 Engagement Log</span>
          ${canEdit ? `<button class="section-edit-btn" data-action="toggle-add-log-entry">+ Add Entry</button>` : ''}
        </div>
        <div class="section-content" style="max-height:300px;overflow-y:auto;">`;
      if (lp.engagement_log.length === 0) {
        html += '<em style="color: var(--text-secondary);">No check-ins logged yet. Your first wellness check-in will appear here.</em>';
      } else {
        const sortedLog = [...lp.engagement_log].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        for (const entry of sortedLog) {
          html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:14px;line-height:1.5;">${esc(entry.entry_text)}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">— ${esc(entry.created_by) || 'Buddy'} · ${entry.created_at ? formatDate(entry.created_at) : ''}</div>
          </div>`;
        }
      }
      html += `</div>
        ${state.showAddLogEntry ? `<div style="background:#f5f0fa;border-radius:8px;padding:14px;margin-top:8px;">
          <div class="form-group"><label>Log Entry</label><textarea data-field="log-entry-text" placeholder="e.g. Asked about Percy's appetite after the new medication — owner reported improvement and followed through on the recheck..." style="width:100%;height:60px;"></textarea></div>
          <button class="btn btn-primary btn-small" data-action="save-log-entry">Save Entry</button>
        </div>` : ''}
      </div>`;

      // ── Section 5: Milestones & Wins ──
      html += `<div class="care-plan-section" style="border-left:4px solid var(--amber);margin-bottom:16px;background:linear-gradient(135deg,#fffde7 0%,#fff8e1 100%);border-radius:8px;padding:16px;">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>🏆 Milestones & Wins</span>
          ${(canEdit || isClient) ? `<button class="section-edit-btn" data-action="toggle-add-milestone">+ Celebrate a Win</button>` : ''}
        </div>
        <div class="section-content">`;
      if (lp.milestones_and_wins.length === 0) {
        html += '<em style="color: var(--text-secondary);">No milestones yet — every little win counts! Your first celebration will appear here. 🎉</em>';
      } else {
        for (const m of lp.milestones_and_wins) {
          html += `<div style="background:white;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #ffe082;">
            <div style="font-weight:600;color:#f57f17;">🌟 ${esc(m.title)}</div>
            ${m.description ? `<div style="font-size:13px;margin-top:4px;">${esc(m.description)}</div>` : ''}
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">— ${esc(m.created_by) || 'Team'} · ${m.created_at ? formatDate(m.created_at) : ''}</div>
          </div>`;
        }
      }
      html += `</div>
        ${state.showAddMilestone ? `<div style="background:white;border-radius:8px;padding:14px;margin-top:8px;border:1px solid #ffe082;">
          <div class="form-group"><label>Win Title</label><input type="text" data-field="milestone-title" placeholder="e.g. Percy hit his target weight!" style="width:100%;"></div>
          <div class="form-group"><label>Details (optional)</label><textarea data-field="milestone-desc" placeholder="What happened and why it matters..." style="width:100%;height:50px;"></textarea></div>
          <button class="btn btn-primary btn-small" data-action="save-milestone" style="background:var(--amber);border-color:var(--amber);">🎉 Save Win</button>
        </div>` : ''}
      </div>`;

      // ── Internal Notes (staff only, preserved from legacy) ──
      if (['vet_buddy', 'admin'].includes(state.profile.role)) {
        const internalNotes = state.carePlan.internal_notes || '';
        html += `
          <div class="care-plan-section view-mode" style="margin-bottom:16px;">
            <div class="section-title">
              🔒 Internal Notes (Staff Only)
              <button class="section-edit-btn" data-action="edit-careplan-section" data-section="internal_notes">Edit</button>
            </div>
            <div class="section-content">
              ${internalNotes ? esc(internalNotes) : '<em style="color: var(--text-secondary);">No internal notes</em>'}
            </div>
            <div class="section-form">
              <textarea data-field="section-internal_notes">${esc(internalNotes)}</textarea>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-small" data-action="save-careplan-section" data-section="internal_notes">Save</button>
                <button class="btn btn-secondary btn-small" data-action="cancel-careplan-section" data-section="internal_notes">Cancel</button>
              </div>
            </div>
          </div>
        `;
      }

      // ── Genetic Insights (visible to client, buddy, admin, and geneticist) ──
      const patientInsights = (state.geneticInsights || []).filter(g => g.case_id === state.caseId);
      if (patientInsights.length > 0) {
        html += '<div class="care-plan-section view-mode" style="margin-bottom:16px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">';
        html += '<span style="font-size:18px;">&#x1F9EC;</span>';
        html += '<div style="font-weight:700;font-size:15px;color:#534AB7;">Genetic Insights</div>';
        html += '<span style="font-size:11px;color:#534AB7;background:#EEEDFE;padding:2px 8px;border-radius:10px;">From Dr. El Hamidi Hay</span>';
        html += '</div>';
        for (const insight of patientInsights) {
          html += '<div style="margin-bottom:16px;">';
          html += '<div style="font-weight:600;font-size:14px;margin-bottom:6px;">' + esc(insight.title) + '</div>';
          html += '<div style="font-size:13px;line-height:1.7;color:#444;margin-bottom:10px;white-space:pre-wrap;">' + esc(insight.content) + '</div>';
          if (insight.breed_risk_flags && insight.breed_risk_flags.length > 0) {
            html += '<div style="margin-bottom:8px;">';
            html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#854F0B;margin-bottom:4px;">Risk Flags</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
            for (const flag of insight.breed_risk_flags) {
              html += '<span style="font-size:12px;background:#FFF4E0;color:#854F0B;padding:3px 10px;border-radius:10px;">' + esc(flag) + '</span>';
            }
            html += '</div></div>';
          }
          if (insight.recommendations && insight.recommendations.length > 0) {
            html += '<div>';
            html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#336026;margin-bottom:6px;">Recommendations</div>';
            html += '<ul style="margin:0;padding-left:18px;">';
            for (const rec of insight.recommendations) {
              html += '<li style="font-size:13px;color:#444;line-height:1.7;">' + esc(rec) + '</li>';
            }
            html += '</ul></div>';
          }
          html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">Updated ' + formatDate(insight.updated_at) + '</div>';
          html += '</div>';
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function renderMessagesTab() {
      const isVisible = state.caseTab === 'messages';
      const isStaff = ['vet_buddy', 'admin', 'external_vet', 'practice_manager'].includes(state.profile.role);
      const isBuddy = state.profile.role === 'vet_buddy';
      const canMessage = ['client', 'vet_buddy', 'admin', 'external_vet'].includes(state.profile.role);
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;

      // Thread switcher — staff can toggle between client thread and internal staff thread
      if (isStaff && state.currentCase?.assigned_buddy_id) {
        html += `<div class="thread-tabs">
          <button class="thread-tab ${state.messageThread === 'client' ? 'active' : ''}" data-action="switch-thread" data-thread="client">💬 Client Thread</button>
          <button class="thread-tab ${state.messageThread === 'staff' ? 'active' : ''}" data-action="switch-thread" data-thread="staff">🔒 Staff Thread</button>
        </div>`;
      }

      // Filter messages by thread
      const visibleMsgs = state.messages.filter(m => {
        if (!isStaff) return (m.thread_type || 'client') === 'client';
        return (m.thread_type || 'client') === state.messageThread;
      });

      html += '<div id="messages-list" style="overflow-y: auto; max-height: 420px; display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px;">';
      if (visibleMsgs.length === 0) {
        html += `<div class="empty-state"><div class="empty-state-text">💬 ${state.messageThread === 'staff' ? 'No internal staff messages yet.' : 'This is where your conversation with your Buddy will live. They\'ll reach out within 48 hours.'}</div></div>`;
      } else {
        for (const msg of visibleMsgs) {
          const isOwn = msg.sender_id === state.profile.id;
          const isImage = msg.attachment_name && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_name);
          const isVoice = msg.attachment_name && /\.(webm|ogg|mp3|wav)$/i.test(msg.attachment_name);
          const isRead = isOwn && state.profile.role !== 'client' && msg.is_read_by_client;
          const isUrgent = msg.is_urgent;
          html += `
            <div class="chat-bubble ${isOwn ? 'own' : ''}" style="${isUrgent ? 'border-left:3px solid var(--amber);background:#fff8e1;' : ''}">
              <div class="chat-content">
                <div class="chat-sender">${isUrgent ? '<span style="color:var(--amber);font-weight:700;font-size:11px;margin-right:4px;">🔶 URGENT</span>' : ''}${esc(msg.sender?.name) || 'Unknown'} ${msg.sender?.role ? renderBadge(msg.sender.role) : ''}</div>
                ${msg.content ? `<div class="chat-text">${esc(msg.content)}</div>` : ''}
                ${msg.attachment_url ? `<div class="chat-attachment">
                  ${isVoice
                    ? `<audio controls class="voice-preview" src="${esc(msg.attachment_url)}"></audio>`
                    : isImage
                      ? `<img src="${esc(msg.attachment_url)}" alt="${esc(msg.attachment_name)}">`
                      : `<a href="${esc(msg.attachment_url)}" target="_blank" rel="noopener">📎 ${esc(msg.attachment_name) || 'Attachment'}</a>`}
                </div>` : ''}
                <div class="chat-time">${formatDateTime(msg.created_at)}</div>
                ${isRead ? '<div class="msg-seen">✓✓ Seen by client</div>' : ''}
                ${isOwn && state.profile.role === 'client' && (msg.is_read_by_staff || msg.is_read_by_buddy) ? '<div class="msg-seen">✓✓ Seen</div>' : ''}
              </div>
            </div>
          `;
        }
      }
      html += '</div>';

      if (canMessage) {
        const placeholder = state.messageThread === 'staff'
          ? 'Message staff only (not visible to client)...'
          : ['vet_buddy','admin'].includes(state.profile.role)
            ? 'Type a message... (press / for templates)'
            : 'Type a message...';
        html += `
          <!-- file inputs are persistent in #persistent-file-inputs -->
          <div style="position:relative;">
            ${state.showCannedResponses && state.cannedResponses.length > 0 ? `
              <div class="canned-panel">
                ${state.cannedResponses.map(cr => `<div class="canned-item" data-action="insert-canned" data-content="${encodeURIComponent(cr.content)}">
                  <strong>${esc(cr.shortcut)}</strong>${esc(cr.content.substring(0, 80))}${cr.content.length > 80 ? '…' : ''}
                </div>`).join('')}
              </div>` : ''}
            <div id="typing-indicator" style="display:none;font-size:12px;color:var(--text-secondary);padding:4px 8px;font-style:italic;"></div>
            <div class="chat-input-area" style="flex-wrap:wrap;">
              <textarea data-field="message-input" placeholder="${placeholder}" maxlength="2000" style="flex:1; min-width:120px;" oninput="if(this.value.startsWith('/')){document.querySelector('[data-action=toggle-canned-responses]')?.click()}"></textarea>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn btn-secondary btn-small" data-action="toggle-urgency" title="Toggle urgency" style="padding:6px 10px;font-size:12px;border-color:${state.urgencyToggle ? 'var(--amber)' : 'var(--border)'};color:${state.urgencyToggle ? 'var(--amber)' : 'var(--text-secondary)'};background:${state.urgencyToggle ? '#fff8e1' : 'white'};">${state.urgencyToggle ? '🔶 Urgent' : 'Routine'}</button>
                ${isStaff ? `<button class="btn btn-secondary" data-action="toggle-canned-responses" title="Canned responses" style="padding:10px 12px;">💬</button>` : ''}
                <button class="voice-btn" id="voice-record-btn" data-action="toggle-voice-record" title="Voice message">🎙️</button>
                <button class="btn btn-secondary" data-action="attach-file" title="Attach file" style="padding:10px 12px;">📎</button>
                <button class="btn btn-primary" data-action="send-message">Send</button>
              </div>
            </div>
          </div>
          ${window._pendingAttachment ? `<div style="font-size:12px; color:var(--primary); padding:4px 0;">📎 Ready: ${esc(window._pendingAttachment.name)} <button class="btn btn-secondary btn-small" data-action="clear-attachment" style="font-size:10px;">✕</button></div>` : ''}
          ${window._pendingVoice ? `<div style="font-size:12px; color:var(--red); padding:4px 0;">🎙️ Voice memo ready <button class="btn btn-secondary btn-small" data-action="clear-voice" style="font-size:10px;">✕</button></div>` : ''}
          ${isBuddy ? `<div style="font-size:12px;color:#999;padding:6px 0;line-height:1.4;">Reminder: provide guidance and support only. Do not diagnose, prescribe, or recommend specific medications. Escalate to Dr. Rodgers for any clinical decisions.</div>
          <div id="scope-warning" style="display:none;font-size:12px;color:var(--amber);background:#fff8e1;padding:6px 10px;border-radius:6px;margin-top:4px;">Heads up — does this message stay within your guidance scope? Escalate to Dr. Rodgers if a clinical decision is needed.</div>` : ''}
        `;
      }

      // Q&A quick question form for clients
      if (state.profile.role === 'client') {
        html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <button class="btn btn-secondary btn-small" data-action="send-quick-question" style="font-size:12px;">❓ Send a Quick Question</button>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Short questions get faster responses than case messages.</div>
        </div>`;
      }

      html += '</div>';
      return html;
    }

    function renderTimelineTab() {
      const isVisible = state.caseTab === 'timeline';
      const canEdit = ['vet_buddy', 'admin'].includes(state.profile.role);
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;

      if (canEdit) {
        html += `<div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <button class="btn btn-primary btn-small" data-action="toggle-add-timeline">${state.showAddTimeline ? '✕ Cancel' : '+ Add Entry'}</button>
        </div>`;
      }

      if (state.showAddTimeline && canEdit) {
        html += `
          <div class="card" style="margin-bottom:16px; background:#f0faf8; border:1px solid var(--primary);">
            <div class="card-title" style="margin-bottom:12px;">New Timeline Entry</div>
            <div class="form-group"><label>Type</label>
              <select data-field="timeline-type" style="width:100%;">
                <option value="note">📋 Note</option>
                <option value="update">✏️ Update</option>
                <option value="milestone">⭐ Milestone</option>
                <option value="appointment">📅 Appointment</option>
              </select>
            </div>
            <div class="form-group"><label>Content</label><textarea data-field="timeline-content" placeholder="Describe what happened or was discussed..." style="width:100%;height:80px;"></textarea></div>
            <div class="form-group" style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" data-field="timeline-client-visible" id="tl-visible" checked>
              <label for="tl-visible" style="margin:0;font-size:13px;">Visible to client</label>
            </div>
            <button class="btn btn-primary" data-action="save-timeline-entry">Save Entry</button>
          </div>`;
      }

      if (state.timelineEntries.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-text">📅 No timeline entries yet — your care journey starts here.</div></div>';
      } else {
        html += '<div class="timeline">';
        const icons = { update: '✏️', note: '📋', escalation: '🚨', appointment: '📅', milestone: '⭐', message: '💬' };
        for (const entry of state.timelineEntries) {
          html += `
            <div class="timeline-entry">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div><span class="timeline-icon">${icons[entry.type] || '📌'}</span> ${esc(entry.content)}</div>
                <div class="timeline-author">By ${esc(entry.author?.name) || 'Unknown'} on ${formatDate(entry.created_at)}</div>
              </div>
            </div>
          `;
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function renderTouchpointsTab() {
      const isVisible = state.caseTab === 'touchpoints';
      const tier = state.currentCase.subscription_tier;
      const targets = { 'Buddy': { buddy: 1, dvm: 0 }, 'Buddy+': { buddy: 4, dvm: 1 }, 'Buddy VIP': { buddy: 4, dvm: 1 }, buddy: { buddy: 1, dvm: 0 }, buddy_plus: { buddy: 4, dvm: 1 }, buddy_vip: { buddy: 4, dvm: 1 } };
      const target = targets[tier] || { buddy: 0, dvm: 0 };
      const buddyCount = state.touchpoints.filter(t => t.type === 'buddy').length;
      const dvmCount = state.touchpoints.filter(t => t.type === 'dvm').length;

      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">
        <div class="card">
          <div class="card-title">Check-In Progress (This Month)</div>
          <div style="margin-top: 20px;">
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Buddy Check-Ins</span>
                <span style="font-weight: 600;">${buddyCount}/${target.buddy}</span>
              </div>
              ${renderProgressBar(buddyCount, Math.max(target.buddy, 1))}
            </div>
      `;

      if (target.dvm > 0) {
        html += `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>DVM Check-Ins</span>
                <span style="font-weight: 600;">${dvmCount}/${target.dvm}</span>
              </div>
              ${renderProgressBar(dvmCount, target.dvm)}
            </div>
        `;
      }

      if (state.profile.role === 'vet_buddy') {
        html += `<button class="btn btn-primary" data-action="log-checkin" data-case-id="${state.currentCase.id}">Log Buddy Check-In</button>`;
      } else if (state.profile.role === 'admin') {
        html += `<div style="display: flex; gap: 8px;"><button class="btn btn-primary" data-action="log-checkin" data-case-id="${state.currentCase.id}" data-type="buddy">Log Buddy Check-In</button><button class="btn btn-primary" data-action="log-checkin" data-case-id="${state.currentCase.id}" data-type="dvm">Log DVM Check-In</button></div>`;
      }

      // Recent touchpoints list with satisfaction rating
      if (state.touchpoints.length === 0) {
        html += '<div style="text-align:center;color:var(--text-secondary);padding:20px 0;font-size:13px;">No check-ins yet. Check-in history will appear here.</div>';
      } else if (state.touchpoints.length > 0) {
        html += `<div class="card" style="margin-top:16px;"><div class="card-title" style="margin-bottom:12px;">Recent Check-Ins</div>`;
        for (const tp of state.touchpoints) {
          const stars = tp.satisfaction_rating;
          const starHtml = state.profile.role === 'client' && !stars
            ? `<div style="margin-top:6px;"><span style="font-size:12px;color:var(--text-secondary);margin-right:6px;">Rate this check-in:</span><span class="star-rating">${[1,2,3,4,5].map(n => `<button class="star-btn" data-action="rate-touchpoint" data-tp-id="${tp.id}" data-rating="${n}">⭐</button>`).join('')}</span></div>`
            : stars ? `<div style="margin-top:4px;font-size:13px;">${'⭐'.repeat(stars)}${'☆'.repeat(5-stars)} <span style="font-size:11px;color:var(--text-secondary);">(${stars}/5)</span></div>` : '';
          html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;font-weight:500;">${tp.type === 'buddy' ? '🐾 Buddy' : '🩺 DVM'} Check-In</span>
              <span style="font-size:11px;color:var(--text-secondary);">${formatDate(tp.completed_at)}</span>
            </div>
            ${starHtml}
          </div>`;
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function renderAppointmentsTab() {
      const isVisible = state.caseTab === 'appointments';
      const canEdit = ['vet_buddy', 'admin'].includes(state.profile.role);
      const isClient = state.profile.role === 'client';
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;

      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-weight:600;">Appointments</div>
        ${canEdit ? `<button class="btn btn-primary btn-small" data-action="toggle-add-appt">${state.showAddAppt ? '✕ Cancel' : '+ Schedule Appointment'}</button>` : ''}
      </div>`;

      if (state.showAddAppt && canEdit) {
        html += `
          <div class="card" style="margin-bottom:16px; background:#f0faf8; border:1px solid var(--primary);">
            <div class="card-title" style="margin-bottom:12px;">New Appointment</div>
            <div class="form-group"><label>Title</label><input type="text" data-field="appt-title" placeholder="e.g. Monthly Check-In Call" style="width:100%;"></div>
            <div class="form-group"><label>Date & Time</label><input type="datetime-local" data-field="appt-date" style="width:100%;"></div>
            <div class="form-group"><label>Type</label>
              <select data-field="appt-type" style="width:100%;">
                <option value="Video Call">Video Call</option>
                <option value="Phone">Phone</option>
                <option value="In-Person">In-Person</option>
                <option value="Internal">Internal</option>
              </select>
            </div>
            <div class="form-group"><label>Video Call Link <span style="color:var(--text-secondary);font-weight:400;">(optional)</span></label><input type="url" data-field="appt-video-url" placeholder="https://zoom.us/j/... or meet.google.com/..." style="width:100%;"></div>
            <div class="form-group"><label>Notes (optional)</label><textarea data-field="appt-notes" placeholder="Any notes..." style="width:100%;height:70px;"></textarea></div>
            <button class="btn btn-primary" data-action="save-appointment">Save Appointment</button>
          </div>`;
      }

      // Edit appointment form
      if (state.editingApptId && canEdit) {
        const ea = state.appointments.find(a => a.id === state.editingApptId);
        if (ea) {
          const editDate = ea.scheduled_at ? new Date(ea.scheduled_at).toISOString().slice(0, 16) : '';
          html += `
            <div class="card" style="margin-bottom:16px; background:#fffbf0; border:1px solid var(--amber);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div class="card-title">Edit Appointment</div>
                <button class="btn btn-secondary btn-small" data-action="cancel-edit-appt">✕ Cancel</button>
              </div>
              <div class="form-group"><label>Title</label><input type="text" data-field="edit-appt-title" value="${esc(ea.title || '')}" style="width:100%;"></div>
              <div class="form-group"><label>Date & Time</label><input type="datetime-local" data-field="edit-appt-date" value="${editDate}" style="width:100%;"></div>
              <div class="form-group"><label>Type</label>
                <select data-field="edit-appt-type" style="width:100%;">
                  <option value="Video Call" ${ea.type === 'Video Call' ? 'selected' : ''}>Video Call</option>
                  <option value="Phone" ${ea.type === 'Phone' ? 'selected' : ''}>Phone</option>
                  <option value="In-Person" ${ea.type === 'In-Person' ? 'selected' : ''}>In-Person</option>
                  <option value="Internal" ${ea.type === 'Internal' ? 'selected' : ''}>Internal</option>
                </select>
              </div>
              <div class="form-group"><label>Video Call Link <span style="color:var(--text-secondary);font-weight:400;">(optional)</span></label><input type="url" data-field="edit-appt-video-url" value="${esc(ea.video_url || '')}" style="width:100%;"></div>
              <div class="form-group"><label>Notes (optional)</label><textarea data-field="edit-appt-notes" style="width:100%;height:70px;">${esc(ea.notes || '')}</textarea></div>
              <button class="btn btn-primary" data-action="save-edit-appointment">Save Changes</button>
            </div>`;
        }
      }

      if (state.appointments.length === 0) {
        html += `<div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No Appointments Yet</div>
          <div class="empty-state-text">${isClient
            ? 'Your Vet Buddy will schedule appointments here. Need to set one up? Send them a message!'
            : 'No appointments scheduled yet — use the button above to create one.'}</div>
          ${isClient ? `<button class="btn btn-primary" data-action="nav-client-case" data-case-id="${state.caseId}" data-tab="messages" style="margin-top:16px;">💬 Message Your Buddy</button>` : ''}
        </div>`;
      } else {
        const now = new Date();
        const upcoming = state.appointments.filter(a => new Date(a.scheduled_at) >= now && a.status !== 'cancelled');
        const past = state.appointments.filter(a => new Date(a.scheduled_at) < now && a.status !== 'cancelled');
        const cancelled = state.appointments.filter(a => a.status === 'cancelled');

        const renderApptList = (appts, sectionLabel, isPast) => {
          if (appts.length === 0) return '';
          let s = `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin:16px 0 8px;">${sectionLabel} (${appts.length})</div>`;
          for (const appt of appts) {
            const typeColors = { 'Video Call': 'var(--blue)', 'In-Person': 'var(--green)', 'Phone': 'var(--amber)', 'Internal': '#999' };
            const isCancelled = appt.status === 'cancelled';
            const opacity = isPast || isCancelled ? 'opacity:0.6;' : '';
            s += `
              <div class="appointment-item" style="border-left-color: ${typeColors[appt.type] || 'var(--blue)'}; ${opacity}">
                <div class="appointment-info" style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div class="appointment-title">${esc(appt.title)}</div>
                    ${isPast && !isCancelled ? '<span style="font-size:10px;background:#e0e0e0;color:#666;padding:2px 6px;border-radius:3px;">Completed</span>' : ''}
                    ${isCancelled ? '<span style="font-size:10px;background:#ffebee;color:var(--red);padding:2px 6px;border-radius:3px;">Cancelled</span>' : ''}
                  </div>
                  <div class="appointment-datetime">${formatDateTime(appt.scheduled_at)}</div>
                  ${appt.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${esc(appt.notes)}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; flex-wrap:wrap;">
                  ${!isCancelled && appt.video_url && /^https?:\/\//i.test(appt.video_url)
                    ? `<a href="${esc(appt.video_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-small" style="text-decoration:none;" onclick="event.stopPropagation();">🎥 Join</a>`
                    : !isCancelled && canEdit && appt.type === 'Video Call' && !isPast
                      ? `<button class="btn btn-secondary btn-small" data-action="generate-video-link" data-appt-id="${appt.id}">🔗 Get Link</button>`
                      : ''}
                  <button class="btn btn-secondary btn-small" data-action="download-ics" data-appointment-id="${appt.id}" style="font-size:11px;">📅 ICS</button>
                  ${canEdit && !isCancelled && !isPast ? `<button class="btn btn-secondary btn-small" data-action="edit-appointment" data-appt-id="${appt.id}" style="font-size:11px;">✏️</button>` : ''}
                  ${canEdit && !isCancelled ? `<button class="btn btn-secondary btn-small" data-action="cancel-appointment" data-appt-id="${appt.id}" style="font-size:11px;border-color:var(--red);color:var(--red);">✕</button>` : ''}
                  <span class="appointment-type" style="background: ${typeColors[appt.type] || 'var(--blue)'};">${appt.type}</span>
                </div>
              </div>
            `;
          }
          return s;
        };

        html += renderApptList(upcoming, 'Upcoming', false);
        html += renderApptList(past, 'Past', true);
        if (cancelled.length > 0) html += renderApptList(cancelled, 'Cancelled', false);
      }

      html += '</div>';
      return html;
    }

    function renderDocumentsTab() {
      const isVisible = state.caseTab === 'files';
      const canUpload = ['client', 'vet_buddy', 'admin'].includes(state.profile.role);
      const docs = state.documents || [];
      const docIcons = { 'application/pdf': '📄', 'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️', 'application/msword': '📝', 'text/csv': '📊' };

      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:600;">Documents & Files</div>
        ${canUpload ? `<div><button class="btn btn-primary btn-small" data-action="trigger-doc-upload">⬆️ Upload File</button></div>` : ''}
      </div>`;

      // AI extraction in-progress banner
      if (state.aiExtractionInProgress) {
        html += `<div style="background:linear-gradient(135deg,rgba(51,96,38,0.08),rgba(104,149,98,0.08));border:1px solid rgba(51,96,38,0.2);border-radius:10px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
          <div class="ai-spinner" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:#336026;border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0;"></div>
          <div>
            <div style="font-weight:600;font-size:14px;color:#336026;">Analyzing medical record with AI...</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Claude is extracting dates, diagnoses, medications, and more. This may take a few seconds.</div>
          </div>
        </div>`;
      }

      if (docs.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">No files uploaded yet</div><div class="empty-state-text">Share your pet\'s medical records, lab results, photos, or documents with your Buddy. Use the Upload File button above.</div></div>';
      } else {
        for (const doc of docs) {
          const icon = docIcons[doc.mime_type] || '📎';
          const size = doc.size_bytes ? (doc.size_bytes > 1024*1024 ? (doc.size_bytes/1024/1024).toFixed(1)+'MB' : (doc.size_bytes/1024).toFixed(0)+'KB') : '';
          const isAiSupported = AI_SUPPORTED_TYPES.includes(doc.mime_type);
          const aiStatusBadge = doc.ai_extraction_status === 'completed'
            ? '<span style="background:#336026;color:white;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-left:6px;">AI Extracted</span>'
            : doc.ai_extraction_status === 'processing'
            ? '<span style="background:var(--amber);color:white;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-left:6px;">Analyzing...</span>'
            : '';
          html += `<div class="doc-item">
            <span class="doc-icon">${icon}</span>
            <div style="flex:1;min-width:0;">
              <div class="doc-name">${esc(doc.name)}${aiStatusBadge}</div>
              <div class="doc-meta">${size ? size + ' · ' : ''}Uploaded by ${esc(doc.uploaded_by_user?.name) || 'Unknown'} · ${formatDate(doc.created_at)}</div>
            </div>
            ${isAiSupported && !doc.ai_extraction_status ? `<button class="btn btn-secondary btn-small" data-action="ai-analyze-doc" data-doc-id="${doc.id}" style="font-size:11px;">🤖 Analyze</button>` : ''}
            <a href="${esc(doc.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-small" onclick="event.stopPropagation();">⬇️</a>
            ${['admin','vet_buddy'].includes(state.profile.role) ? `
              <button class="btn btn-secondary btn-small" data-action="toggle-genetic-flag" data-doc-id="${doc.id}" data-is-genetic="${doc.is_genetic ? '1' : '0'}" style="${doc.is_genetic ? 'background:#EEEDFE;border-color:#534AB7;color:#534AB7;' : ''}">&#x1F9EC; ${doc.is_genetic ? 'Genetic' : 'Mark Genetic'}</button>
              <button class="btn btn-secondary btn-small" data-action="delete-doc" data-doc-id="${doc.id}" style="border-color:var(--red);color:var(--red);">✕</button>
            ` : ''}
          </div>`;
        }
      }

      html += '</div>';
      return html;
    }

    function renderAdminDashboard() {
      const broadcastModal = state.showBroadcast ? `
        <div class="broadcast-overlay" data-action="close-broadcast">
          <div class="broadcast-card" onclick="event.stopPropagation()">
            <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:600; margin-bottom:16px;">📢 Broadcast Message</div>
            <div class="form-group"><label>Message</label><textarea data-field="broadcast-message" placeholder="Write your message to all clients..." style="width:100%;height:100px;"></textarea></div>
            <div class="form-group"><label>Schedule (optional — leave blank to send now)</label><input type="datetime-local" data-field="broadcast-schedule" style="width:100%;"></div>
            <div class="form-group"><label>Send to</label>
              <select data-field="broadcast-tier" style="width:100%;">
                <option value="all">All clients</option>
                <option value="Buddy">Buddy tier only</option>
                <option value="Buddy+">Buddy+ tier only</option>
                <option value="Buddy VIP">Buddy VIP tier only</option>
                <option value="Trial">Free Trial only</option>
              </select>
            </div>
            <div style="display:flex;gap:10px;margin-top:8px;">
              <button class="btn btn-primary" data-action="send-broadcast" style="flex:1;">Send to All</button>
              <button class="btn btn-secondary" data-action="close-broadcast">Cancel</button>
            </div>
          </div>
        </div>` : '';

      const grantTrialModal = state.showGrantTrial ? `
        <div class="broadcast-overlay" data-action="close-grant-trial">
          <div class="broadcast-card" onclick="event.stopPropagation()">
            <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:600; margin-bottom:16px;">🎉 Grant Free Trial</div>
            <div style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">Grant a ${TRIAL_DURATION_DAYS}-day free trial to a client by entering their email address.</div>
            <div class="form-group"><label>Client Email</label><input type="email" data-field="grant-trial-email" placeholder="client@example.com" style="width:100%;"></div>
            <div style="display:flex;gap:10px;margin-top:8px;">
              <button class="btn btn-primary" data-action="confirm-grant-trial" style="flex:1;">Grant ${TRIAL_DURATION_DAYS}-Day Trial</button>
              <button class="btn btn-secondary" data-action="close-grant-trial">Cancel</button>
            </div>
          </div>
        </div>` : '';

      return renderLayout(`
        ${broadcastModal}
        ${grantTrialModal}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
          <div style="font-family:'Fraunces',serif; font-size:22px; font-weight:600;">Admin Dashboard</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-small" data-action="show-grant-trial">🎉 Grant Trial</button>
            <button class="btn btn-secondary btn-small" data-action="export-csv">⬇️ Export CSV</button>
            <button class="btn btn-primary btn-small" data-action="toggle-broadcast">📢 Broadcast</button>
          </div>
        </div>
        ${(() => {
          const tierRevenue = { 'Buddy': 99, 'Buddy+': 149, 'Buddy VIP': 279 };
          const activeCases = state.cases.filter(c => c.status === 'Active' || c.status === 'pending_assignment');
          const mrr = activeCases.reduce((sum, c) => sum + (tierRevenue[c.subscription_tier] || 0), 0);
          const arpu = activeCases.length > 0 ? (mrr / activeCases.length) : 0;
          const tierCounts = {};
          for (const c of activeCases) { const t = c.subscription_tier || 'None'; tierCounts[t] = (tierCounts[t] || 0) + 1; }
          return `<div style="margin-bottom:16px;">
            <div class="card" style="background:linear-gradient(135deg,#336026,#689562);color:white;margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;">
                <div><div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:0.5px;">Monthly Recurring Revenue</div><div style="font-size:32px;font-weight:700;">$${mrr.toLocaleString()}</div></div>
                <div><div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:0.5px;">Blended ARPU</div><div style="font-size:24px;font-weight:600;">$${arpu.toFixed(0)}</div></div>
                <div><div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:0.5px;">Active Subscribers</div><div style="font-size:24px;font-weight:600;">${activeCases.length}</div></div>
              </div>
              <div style="margin-top:12px;display:flex;gap:16px;font-size:12px;opacity:0.8;">
                <span>Buddy: ${tierCounts['Buddy'] || 0}</span>
                <span>Buddy+: ${tierCounts['Buddy+'] || 0}</span>
                <span>Buddy VIP: ${tierCounts['Buddy VIP'] || 0}</span>
              </div>
            </div>
          </div>`;
        })()}
        <div style="margin-bottom: 24px;">
          <div class="admin-grid">
            <div class="card" style="text-align: center;">
              <div style="font-size: 32px; color: var(--primary); margin-bottom: 8px;">${state.cases.length}</div>
              <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase;">Total Cases</div>
            </div>
            <div class="card" style="text-align: center;">
              <div style="font-size: 32px; color: var(--green); margin-bottom: 8px;">${state.cases.filter(c => c.status === 'Active').length}</div>
              <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase;">Active Cases</div>
            </div>
            <div class="card" style="text-align: center;">
              <div style="font-size: 32px; color: var(--amber); margin-bottom: 8px;">${state.cases.filter(c => c.status === 'Needs Attention').length}</div>
              <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase;">Needs Attention</div>
            </div>
            <div class="card" style="text-align: center;">
              <div style="font-size: 32px; color: var(--amber); margin-bottom: 8px;">${state.escalations.filter(e => e.status !== 'resolved').length}</div>
              <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase;">Open Escalations</div>
            </div>
            <div class="card" style="text-align: center;">
              <div style="font-size: 32px; color: var(--green); margin-bottom: 8px;">${state.unreadCount}</div>
              <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase;">Unread Messages</div>
            </div>
          </div>
        </div>

        ${(() => {
          const surveyMilestones = [30, 90, 365];
          const surveysDue = [];
          for (const c of state.cases) {
            if (c.status !== 'Active') continue;
            const owner = c.pets?.owner;
            if (!owner) continue;
            const startDate = new Date(c.created_at || Date.now());
            const daysSinceStart = Math.floor((Date.now() - startDate) / 86400000);
            for (const milestone of surveyMilestones) {
              if (daysSinceStart >= milestone && daysSinceStart < milestone + 7) {
                surveysDue.push({ pet: c.pets?.name, owner: owner.name, milestone, caseId: c.id });
              }
            }
          }
          if (surveysDue.length === 0) return '';
          const rows = surveysDue.map(function(s) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">'
              + '<div>'
              + '<div style="font-weight:600;font-size:14px;">' + esc(s.owner) + ' \u00b7 ' + esc(s.pet) + '</div>'
              + '<div style="font-size:12px;color:var(--text-secondary);">Day ' + s.milestone + ' check-in survey \u2014 send via Messages</div>'
              + '</div>'
              + '<button class="btn btn-secondary btn-small" data-action="select-case" data-case-id="' + s.caseId + '">Open case</button>'
              + '</div>';
          }).join('');
          return '<div class="card" style="border-left:3px solid #3498db;margin-bottom:16px;">'
            + '<div class="card-title" style="margin-bottom:12px;">\u2b50 Surveys due</div>'
            + rows
            + '</div>';
        })()}
        <div class="card">
          <div class="card-title">Recent Cases</div>
          <div style="overflow-x:auto;">
          <table class="cases-table" style="margin-top: 16px;">
            <thead>
              <tr>
                <th>Pet</th>
                <th>Owner</th>
                <th>Buddy</th>
                <th>Tier</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${state.cases.slice(0, 5).map(c => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:8px;">${c.pets?.photo_url ? `<img src="${esc(c.pets.photo_url)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--border);" alt="${esc(c.pets?.name)}">` : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#336026);display:flex;align-items:center;justify-content:center;font-size:14px;">${SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾'}</div>`}<span class="case-table-pet">${esc(c.pets?.name || 'Unknown')}</span></div></td>
                  <td><span class="case-table-owner">${esc(c.pets?.owner?.name || 'Unknown')}</span></td>
                  <td>${esc(c.assigned_buddy?.name || 'Unassigned')}</td>
                  <td>${TIER_DISPLAY[c.subscription_tier] || c.subscription_tier}</td>
                  <td>${renderStatusDot(c.status)} ${c.status}</td>
                  <td><a class="case-table-link" data-action="nav-admin-case" data-case-id="${c.id}">View</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>
      `);
    }

    // ══════════════════════════════════════════════════════════
    // NEW CASE TABS
    // ══════════════════════════════════════════════════════════

    function renderMedicationsTab() {
      const isVisible = state.caseTab === 'medications';
      const canEdit = ['vet_buddy', 'admin'].includes(state.profile.role);
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';

      const pet = state.currentCase?.pets;
      const activeMeds = state.petMedications.filter(m => m.is_active);
      const pastMeds = state.petMedications.filter(m => !m.is_active);

      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-weight:600;">💊 Medications</div>
        ${canEdit ? `<button class="btn btn-primary btn-small" data-action="toggle-add-med">+ Add Medication</button>` : ''}
      </div>`;

      if (state.showAddMed && canEdit) {
        html += `<div class="card" style="margin-bottom:14px;background:#f0faf8;border:1px solid var(--primary);">
          <div class="card-title" style="margin-bottom:10px;">Add Medication</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group"><label>Medication Name</label><input type="text" data-field="med-name" placeholder="e.g. Amoxicillin" style="width:100%;"></div>
            <div class="form-group"><label>Dose</label><input type="text" data-field="med-dose" placeholder="e.g. 250mg" style="width:100%;"></div>
            <div class="form-group"><label>Frequency</label><input type="text" data-field="med-frequency" placeholder="e.g. Twice daily" style="width:100%;"></div>
            <div class="form-group"><label>Start Date</label><input type="date" data-field="med-start" style="width:100%;"></div>
          </div>
          <div class="form-group"><label>End Date (optional)</label><input type="date" data-field="med-end" style="width:100%;max-width:200px;"></div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary btn-small" data-action="save-medication" data-pet-id="${pet?.id}" data-case-id="${state.caseId}">Save</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-add-med">Cancel</button>
          </div>
        </div>`;
      }

      if (activeMeds.length === 0 && pastMeds.length === 0) {
        html += '<div class="empty-state" style="padding:30px 0;"><div class="empty-state-text">No medications on record — your Buddy will help keep this updated.</div></div>';
      } else {
        if (activeMeds.length > 0) {
          html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Active</div>';
          for (const med of activeMeds) {
            html += `<div class="med-row">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-weight:600;">${esc(med.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${esc(med.dose || '')} ${med.dose && med.frequency ? '·' : ''} ${esc(med.frequency || '')}</div>
              </div>
              <div style="font-size:11px;color:var(--text-secondary);">${med.start_date ? 'Since ' + formatDate(med.start_date) : ''}</div>
              ${canEdit ? `<button class="btn btn-secondary btn-small" data-action="deactivate-med" data-med-id="${med.id}" style="font-size:11px;padding:3px 8px;">Discontinue</button>` : ''}
            </div>`;
          }
        }
        if (pastMeds.length > 0) {
          html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;">Past</div>';
          for (const med of pastMeds) {
            html += `<div class="med-row med-inactive">
              <div style="width:8px;height:8px;border-radius:50%;background:#ccc;flex-shrink:0;"></div>
              <div style="flex:1;"><div style="font-weight:600;">${esc(med.name)}</div><div style="font-size:12px;color:var(--text-secondary);">${esc(med.dose || '')} ${esc(med.frequency || '')}</div></div>
            </div>`;
          }
        }
      }
      html += '</div>';
      return html;
    }

    function renderVitalsTab() {
      const isVisible = state.caseTab === 'vitals';
      const canEdit = ['vet_buddy', 'admin'].includes(state.profile.role);
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';

      if (!hasFeatureAccess('vitals_tracking')) {
        return html + renderUpgradePrompt('vitals_tracking', state.currentCase?.subscription_tier) + '</div>';
      }

      const pet = state.currentCase?.pets;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-weight:600;">📊 Vitals Log</div>
        ${canEdit ? `<button class="btn btn-primary btn-small" data-action="toggle-add-vitals">+ Record</button>` : ''}
      </div>`;

      if (state.showAddVitals && canEdit) {
        html += `<div class="card" style="margin-bottom:14px;background:#f0faf8;border:1px solid var(--primary);">
          <div class="card-title" style="margin-bottom:10px;">Record Vitals</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group"><label>Weight (lbs)</label><input type="text" data-field="vital-weight" placeholder="e.g. 14.2" style="width:100%;"></div>
            <div class="form-group"><label>Temperature (°F)</label><input type="text" data-field="vital-temp" placeholder="e.g. 101.5" style="width:100%;"></div>
          </div>
          <div class="form-group"><label>Notes</label><textarea data-field="vital-notes" placeholder="Other observations..." style="width:100%;height:60px;"></textarea></div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary btn-small" data-action="save-vitals" data-pet-id="${pet?.id}">Save</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-add-vitals">Cancel</button>
          </div>
        </div>`;
      }

      const weightData = state.petVitals.filter(v => v.weight).slice(0, 10).reverse();
      if (weightData.length >= 2) {
        html += `<div class="card" style="margin-bottom:14px;">
          <div style="font-weight:600;margin-bottom:10px;">Weight Trend</div>
          <div class="chart-container"><canvas id="vitals-chart"></canvas></div>
        </div>`;
      }

      if (state.petVitals.length === 0) {
        html += '<div class="empty-state" style="padding:30px 0;"><div class="empty-state-text">No vitals recorded yet — weight and health metrics will appear here.</div></div>';
      } else {
        html += '<div class="card"><div style="font-weight:600;margin-bottom:10px;">History</div>';
        for (const v of state.petVitals) {
          html += `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--bg);font-size:13px;">
            <div style="color:var(--text-secondary);font-size:11px;white-space:nowrap;min-width:80px;">${formatDate(v.recorded_at)}</div>
            <div style="flex:1;">
              ${v.weight ? `<span style="font-weight:600;">⚖️ ${v.weight}</span> ` : ''}
              ${v.temperature ? `<span>🌡️ ${v.temperature}°F</span> ` : ''}
              ${v.notes ? `<div style="color:var(--text-secondary);margin-top:2px;">${esc(v.notes)}</div>` : ''}
            </div>
          </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderVaccinesTab() {
      const isVisible = state.caseTab === 'vaccines';
      const canEdit = ['vet_buddy', 'admin', 'client'].includes(state.profile.role);
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';

      const pet = state.currentCase?.pets;
      const today = new Date();
      const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-weight:600;">💉 Vaccine Tracker</div>
        ${canEdit ? `<button class="btn btn-primary btn-small" data-action="toggle-add-vaccine">+ Add Vaccine</button>` : ''}
      </div>`;

      if (state.showAddVaccine) {
        html += `<div class="card" style="margin-bottom:14px;background:#f0faf8;border:1px solid var(--primary);">
          <div class="card-title" style="margin-bottom:10px;">Add Vaccine</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group"><label>Vaccine Name</label><input type="text" data-field="vaccine-name" placeholder="e.g. Rabies, DHPP" style="width:100%;"></div>
            <div class="form-group"><label>Date Administered</label><input type="date" data-field="vaccine-date" style="width:100%;"></div>
            <div class="form-group"><label>Next Due Date</label><input type="date" data-field="vaccine-due" style="width:100%;"></div>
          </div>
          <div class="form-group"><label>Notes (optional)</label><input type="text" data-field="vaccine-notes" placeholder="Lot #, clinic, etc." style="width:100%;"></div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-primary btn-small" data-action="save-vaccine" data-pet-id="${pet?.id}">Save</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-add-vaccine">Cancel</button>
          </div>
        </div>`;
      }

      if (state.petVaccines.length === 0) {
        html += '<div class="empty-state" style="padding:30px 0;"><div class="empty-state-text">No vaccines on record yet — vaccination history will be tracked here.</div></div>';
      } else {
        for (const v of state.petVaccines) {
          const dueDate = v.due_date ? new Date(v.due_date) : null;
          let statusClass = 'ok', statusLabel = '✅ Up to date';
          if (dueDate) {
            if (dueDate < today) { statusClass = 'overdue'; statusLabel = '⚠️ Overdue'; }
            else if (dueDate < thirtyDays) { statusClass = 'due-soon'; statusLabel = '🔔 Due soon'; }
          }
          html += `<div class="vaccine-row" role="listitem">
            <div class="vaccine-status ${statusClass}" aria-hidden="true"></div>
            <div style="flex:1;">
              <div style="font-weight:600;">${esc(v.name)}</div>
              <div style="font-size:11px;color:var(--text-secondary);">
                ${v.administered_date ? 'Given: ' + formatDate(v.administered_date) : ''}
                ${v.due_date ? ' · Due: ' + formatDate(v.due_date) : ''}
              </div>
            </div>
            <span style="font-size:11px;">${statusLabel}</span>
          </div>`;
        }
      }
      html += '</div>';
      return html;
    }

    function renderCaseNotesTab() {
      const isVisible = state.caseTab === 'notes';
      const isStaff = ['vet_buddy', 'admin', 'external_vet', 'practice_manager'].includes(state.profile.role);
      if (!isStaff) return '';
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';

      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div><div style="font-weight:600;">🔒 Internal Notes</div><div style="font-size:11px;color:var(--text-secondary);">Visible to staff only — never shown to clients</div></div>
        <button class="btn btn-primary btn-small" data-action="toggle-add-note">+ Add Note</button>
      </div>`;

      if (state.showAddNote) {
        html += `<div class="card" style="margin-bottom:14px;background:#f0faf8;border:1px solid var(--primary);">
          <textarea data-field="note-content" placeholder="Add an internal note..." style="width:100%;height:100px;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-small" data-action="save-case-note" data-case-id="${state.caseId}">Save Note</button>
            <button class="btn btn-secondary btn-small" data-action="toggle-add-note">Cancel</button>
          </div>
        </div>`;
      }

      if (state.caseNotes.length === 0) {
        html += '<div class="empty-state" style="padding:30px 0;"><div class="empty-state-text">No internal notes yet — staff notes about this case will appear here.</div></div>';
      } else {
        for (const note of state.caseNotes) {
          html += `<div class="card" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
              <div style="font-size:12px;font-weight:600;">${renderAvatar(note.author?.avatar_initials, note.author?.avatar_color, 'xs')} ${esc(note.author?.name || 'Staff')}</div>
              <div style="font-size:11px;color:var(--text-secondary);">${formatDateTime(note.created_at)}</div>
            </div>
            <div style="font-size:13px;white-space:pre-wrap;">${esc(note.content)}</div>
          </div>`;
        }
      }
      html += '</div>';
      return html;
    }

    function renderCoOwnersTab() {
      const isVisible = state.caseTab === 'co-owners';
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';
      html += renderCoOwnerSection(state.currentCase?.pet_id);
      html += '</div>';
      return html;
    }

    function renderTeamTab() {
      const isVisible = state.caseTab === 'team';
      let html = `<div class="tab-content ${isVisible ? 'active' : ''}">`;
      if (!isVisible) return html + '</div>';
      const pet = state.currentCase?.pets;
      const buddy = state.currentCase?.assigned_buddy;
      const owner = state.currentCase?.pets?.owner;
      const teamMembers = state._careTeamMembers || [];
      const coOwners = state.petCoOwners || [];
      html += `<div class="card" style="margin-bottom:16px;">
        <div class="card-title" style="margin-bottom:12px;">🤝 ${esc(pet?.name || 'Pet')}'s Care Team</div>
        <div class="care-team-list">
          ${owner ? `<div class="care-team-member">
            ${renderAvatar(owner.avatar_initials || owner.name?.charAt(0), owner.avatar_color || '#888')}
            <div class="care-team-member-info">
              <div class="care-team-member-name">${esc(owner.name || 'Owner')}</div>
              <div class="care-team-role-chip role-owner">Owner</div>
            </div>
          </div>` : ''}
          ${buddy ? `<div class="care-team-member">
            ${renderAvatar(buddy.avatar_initials, buddy.avatar_color || '#9b59b6')}
            <div class="care-team-member-info">
              <div class="care-team-member-name">${esc(buddy.name)}</div>
              <div class="care-team-role-chip role-buddy">Buddy</div>
            </div>
          </div>` : ''}
          ${coOwners.map(co => `<div class="care-team-member">
            <div class="avatar-circle" style="background:#888;width:28px;height:28px;font-size:11px;">${(co.user?.name || '?').charAt(0).toUpperCase()}</div>
            <div class="care-team-member-info">
              <div class="care-team-member-name">${esc(co.user?.name || co.invited_email || 'Co-owner')}</div>
              <div class="care-team-role-chip role-owner">Co-owner</div>
              ${co.accepted_at ? `<div style="font-size:10px;color:var(--text-secondary);">Joined ${formatDate(co.accepted_at)}</div>` : ''}
            </div>
          </div>`).join('')}
          ${teamMembers.map(m => `<div class="care-team-member">
            <div class="avatar-circle" style="background:#e67e22;width:28px;height:28px;font-size:11px;">${(m.display_name || '?').charAt(0).toUpperCase()}</div>
            <div class="care-team-member-info">
              <div class="care-team-member-name">${esc(m.display_name || 'Helper')}</div>
              <div class="care-team-role-chip role-helper">Helper</div>
              ${m.created_at ? `<div style="font-size:10px;color:var(--text-secondary);">Joined ${formatDate(m.created_at)}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
      html += '</div>';
      return html;
    }

    // ── Notification panel overlay (rendered into topbar area) ─────────────
    function renderNotificationsPanel() {
      if (!state.showNotifications) return '';
      // Sort: urgent first, then by recency
      const recentMsgs = [...state.inboxMessages]
        .sort((a, b) => {
          if (a.is_urgent && !b.is_urgent) return -1;
          if (!a.is_urgent && b.is_urgent) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        })
        .slice(0, 15);
      const role = state.profile?.role;
      const inboxAction = role === 'client' ? 'nav-client-case'
        : role === 'vet_buddy' ? 'nav-buddy-inbox' : 'nav-admin-inbox';
      const inboxTab = role === 'client' ? 'messages' : '';

      // Push notification prompt — only show if contextual prompt was triggered
      const pushBanner = state.showPushPromptInPanel ? `
        <div style="padding:10px 16px;background:rgba(42,157,143,0.1);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🔔</span>
          <div style="flex:1;font-size:12px;color:var(--text-secondary);">You have unread messages — enable notifications so you never miss one</div>
          <button data-action="enable-push-notifications" style="background:var(--primary);color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;">Enable</button>
        </div>` : '';

      return `<div class="notif-panel">
        <div class="notif-header">
          <span>🔔 Notifications <span style="font-size:11px;color:var(--text-secondary);font-weight:400;">(${state.unreadCount} unread)</span></span>
          <button data-action="mark-all-notifications-read" style="background:none;border:none;color:var(--primary);font-size:11px;cursor:pointer;font-weight:600;margin-left:auto;">Mark all read</button>
        </div>
        ${pushBanner}
        <div class="notif-list">
          ${recentMsgs.length === 0
            ? '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">All caught up! 🎉</div>'
            : recentMsgs.map(m => {
                const _c = (state.cases || []).find(c => c.id === m.case_id);
                const _pet = _c?.pets?.name;
                const _sender = esc(m.sender?.name || (role === 'client' ? 'Your Buddy' : 'Client'));
                const _label = _pet ? `${_sender} about ${esc(_pet)}` : _sender;
                return `<div class="notif-item unread" data-action="${inboxAction}" ${inboxTab ? `data-tab="${inboxTab}"` : ''} data-case-id="${m.case_id || ''}">
                <div style="display:flex;align-items:center;gap:6px;">
                  ${m.is_urgent ? '<span style="color:var(--red);font-size:11px;font-weight:700;">🚨 URGENT</span>' : ''}
                  <strong>${_label}</strong>
                </div>
                <div style="margin-top:2px;">${esc((m.content||'').substring(0,60))}${(m.content||'').length>60?'...':''}</div>
                <div class="notif-time">${formatDateTime(m.created_at)}</div>
              </div>`;
            }).join('')}
        </div>
        <div style="padding:8px 16px;border-top:1px solid var(--border);text-align:center;">
          <button data-action="show-notif-settings" style="background:none;border:none;color:var(--primary);font-size:12px;cursor:pointer;font-weight:500;">⚙️ Notification Settings</button>
        </div>
      </div>`;
    }

    function renderAdminCases() {
      const hasActive = !!state.currentCase;
      let html = `<div class="case-detail-layout${hasActive ? ' has-active-case' : ''}"><div class="case-sidebar">`;
      html += '<button class="btn btn-primary btn-small" data-action="nav-admin-create-case" style="width:100%;margin-bottom:12px;">+ Create Case</button>';
      html += '<input type="text" placeholder="Search cases..." data-field="case-search" style="margin-bottom: 12px;" aria-label="Search cases">';
      const casesPaged = paginate(state.cases, pagination.cases);
      for (const c of casesPaged.items) {
        const isActive = state.currentCase?.id === c.id;
        const adminSidebarEmoji = SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾';
        html += `
          <div class="case-list-item ${isActive ? 'active' : ''}" data-action="select-case" data-case-id="${c.id}" style="display:flex; align-items:center; gap:10px;">
            ${c.pets?.photo_url
              ? `<img src="${esc(c.pets.photo_url)}" class="pet-photo-thumb" alt="${esc(c.pets?.name)}" style="flex-shrink:0;">`
              : `<div class="pet-photo-thumb-placeholder" style="flex-shrink:0;">${adminSidebarEmoji}</div>`}
            <div style="min-width:0; flex:1;">
              <div class="case-list-pet-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.pets?.name || 'Unknown')}</div>
              <div class="case-list-owner" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.pets?.owner?.name || 'Unknown Owner')}</div>
              ${c.subscription_tier ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">${c.subscription_tier}</div>` : ''}
            </div>
          </div>
        `;
      }
      html += renderPagination('cases', casesPaged.page, casesPaged.totalPages, casesPaged.total);
      html += '</div><div>';

      if (state.currentCase) {
        const pet = state.currentCase.pets;
        const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';
        const ownerName = pet?.owner?.name || 'Unknown Owner';
        const buddies = state.teamMembers.filter(m => m.role === 'vet_buddy');

        // Mobile back button
        html += `<button class="mobile-back-btn" data-action="back-to-case-list" style="display:none;margin-bottom:12px;background:none;border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:14px;color:var(--dark);cursor:pointer;">← Back to Cases</button>`;

        // ── Persistent case header ──
        html += `
          <div class="card" style="margin-bottom: 12px; padding: 16px 20px;">
            <div style="margin-bottom: 14px; display:flex; align-items:center; gap:16px;">
              ${renderPetPhoto(pet, 'card')}
              <div>
                <div style="font-size: 19px; font-weight: 700; color: var(--text-primary);">${esc(pet?.name) || 'Unknown Pet'}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">${esc(pet?.breed)} · Owner: ${esc(ownerName)}</div>
              </div>
            </div>
            <div class="case-header-dropdowns">
              <div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Status</div>
                <select data-field="case-status" data-case-id="${state.currentCase.id}" style="width:100%; font-size:13px; padding: 6px 8px;">
                  <option value="Active"          ${state.currentCase.status === 'Active'          ? 'selected' : ''}>Active</option>
                  <option value="Needs Attention" ${state.currentCase.status === 'Needs Attention' ? 'selected' : ''}>Needs Attention</option>
                  <option value="Inactive"        ${state.currentCase.status === 'Inactive'        ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              <div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Assigned Buddy</div>
                <select data-field="assign-buddy" data-case-id="${state.currentCase.id}" style="width:100%; font-size:13px; padding: 6px 8px;">
                  <option value="">Unassigned</option>
                  ${buddies.map(m => `<option value="${m.id}" ${m.id === state.currentCase.assigned_buddy_id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
                </select>
              </div>
              <div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Tier</div>
                <select data-field="case-tier" data-case-id="${state.currentCase.id}" style="width:100%; font-size:13px; padding: 6px 8px;">
                  <option value="Buddy"     ${state.currentCase.subscription_tier === 'Buddy'     ? 'selected' : ''}>Buddy</option>
                  <option value="Buddy+"    ${state.currentCase.subscription_tier === 'Buddy+'    ? 'selected' : ''}>Buddy+</option>
                  <option value="Buddy VIP" ${state.currentCase.subscription_tier === 'Buddy VIP' ? 'selected' : ''}>Buddy VIP</option>
                </select>
              </div>
            </div>
          </div>
        `;

        // ── Tabs (all staff tabs including medical records) ──
        const adminCaseTabs = ['careplan', 'messages', 'medications', 'vitals', 'vaccines', 'timeline', 'touchpoints', 'notes', 'appointments', 'files'];
        const adminCaseLabels = { careplan: 'Living Care Plan', messages: 'Messages', timeline: 'Timeline', touchpoints: 'Check-ins', appointments: 'Appointments', files: '📁 Files', medications: '💊 Meds', vitals: '📊 Vitals', vaccines: '💉 Vaccines', notes: '🔒 Notes' };
        html += '<div class="tabs">';
        for (const tab of adminCaseTabs) {
          html += `<button class="tab-button ${state.caseTab === tab ? 'active' : ''}" data-action="switch-case-tab" data-tab="${tab}">${adminCaseLabels[tab]}</button>`;
        }
        html += '</div>';

        html += renderCarePlanTab();
        html += renderMessagesTab();
        html += renderMedicationsTab();
        html += renderVitalsTab();
        html += renderVaccinesTab();
        html += renderTimelineTab();
        html += renderTouchpointsTab();
        html += renderCaseNotesTab();
        html += renderAppointmentsTab();
        html += renderDocumentsTab();
        html += renderCoOwnersTab();
        html += renderTeamTab();
      } else {
        html += '<div class="empty-state"><div class="empty-state-text">Select a case to view details</div></div>';
      }

      html += '</div></div>';
      return renderLayout(html);
    }

    function renderAdminInbox() {
      const grouped = {};
      for (const msg of state.inboxMessages) {
        if (!grouped[msg.case_id]) grouped[msg.case_id] = [];
        grouped[msg.case_id].push(msg);
      }

      let html = '<div>';
      html += `<div style="font-size:20px;font-weight:700;margin-bottom:18px;">📬 Message Monitor</div>`;
      if (Object.keys(grouped).length === 0) {
        html += '<div class="empty-state"><div class="empty-state-text">✅ No unread client messages</div></div>';
      } else {
        for (const [caseId, msgs] of Object.entries(grouped)) {
          const petCase = state.cases.find(c => c.id === caseId);
          const petName = petCase?.pets?.name || 'Unknown Pet';
          const ownerName = petCase?.pets?.owner?.name || 'Client';
          const species = petCase?.pets?.species?.toLowerCase() || '';
          const assignedBuddy = state.teamMembers.find(m => m.id === petCase?.assigned_buddy_id);
          const buddyLabel = assignedBuddy ? `Buddy: ${assignedBuddy.name}` : 'No buddy assigned';
          html += `<div class="card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              ${petCase?.pets?.photo_url
                ? `<img src="${petCase.pets.photo_url}" class="pet-photo-thumb" alt="${esc(petName)}">`
                : `<div class="pet-photo-thumb-placeholder">${SPECIES_EMOJI[species] || '🐾'}</div>`}
              <div>
                <div style="font-weight:600;">${SPECIES_EMOJI[species] || '🐾'} ${esc(petName)} <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">· ${msgs.length} unread</span></div>
                <div style="font-size:12px;color:var(--text-secondary);">Owner: ${esc(ownerName)} · ${esc(buddyLabel)}</div>
              </div>
            </div>`;
          for (const msg of msgs.slice(0, 3)) {
            const preview = (msg.content || '').substring(0, 100);
            html += `<div style="padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:6px;cursor:pointer;" data-action="nav-admin-case" data-case-id="${caseId}">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px;">${esc(msg.sender?.name || ownerName)} · ${formatDateTime(msg.created_at)}</div>
              <div style="font-size:13px;">${esc(preview)}${(msg.content||'').length > 100 ? '…' : ''}</div>
            </div>`;
          }
          if (msgs.length > 3) html += `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;">+${msgs.length - 3} more…</div>`;
          html += '</div>';
        }
      }
      html += '</div>';
      return renderLayout(html);
    }

    // ══════════════════════════════════════════════════════════
    // CLIENT FEATURES
    // ══════════════════════════════════════════════════════════

    function renderHealthSummary() {
      if (!state.currentCase) return renderLayout('<div class="empty-state"><div class="empty-state-text">Select a case to view health summary</div></div>');
      const pet = state.currentCase.pets;
      const species = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '🐾';
      const buddy = state.currentCase.assigned_buddy;
      const activeMeds = state.petMedications.filter(m => m.is_active);
      const today = new Date();
      const overdueVaccines = state.petVaccines.filter(v => v.due_date && new Date(v.due_date) < today);
      const upcomingAppts = state.appointments.filter(a => new Date(a.scheduled_at) > today).slice(0, 2);

      const summaryHtml = `
        <div class="health-summary" id="health-summary-content">
          <div class="health-summary-header">
            ${renderPetPhoto(pet, 'card')}
            <div>
              <h2>${esc(pet?.name) || 'Unknown'}</h2>
              <div style="color:var(--text-secondary);font-size:13px;">${esc(pet?.breed || pet?.species)} ${pet?.dob ? '· Born ' + formatDate(pet.dob) : ''}</div>
              ${pet?.weight ? `<div style="font-size:13px;">⚖️ ${esc(pet.weight)}</div>` : ''}
            </div>
          </div>

          ${buddy ? `<div style="margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;font-size:13px;">
            <div style="font-weight:600;margin-bottom:4px;">🩺 Vet Buddy</div>
            ${renderAvatar(buddy.avatar_initials, buddy.avatar_color, 'sm')} ${esc(buddy.name)}
          </div>` : ''}

          ${activeMeds.length > 0 ? `<div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:8px;">💊 Current Medications</div>
            ${activeMeds.map(m => `<div style="padding:6px 0;font-size:13px;border-bottom:1px solid var(--bg);">
              <strong>${esc(m.name)}</strong> ${m.dose ? '– ' + esc(m.dose) : ''} ${m.frequency ? '(' + esc(m.frequency) + ')' : ''}
            </div>`).join('')}
          </div>` : ''}

          ${state.petVaccines.length > 0 ? `<div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:8px;">💉 Vaccines ${overdueVaccines.length > 0 ? '<span style="color:var(--red);font-size:12px;">⚠️ ' + overdueVaccines.length + ' overdue</span>' : ''}</div>
            ${state.petVaccines.slice(0, 5).map(v => `<div style="font-size:13px;padding:4px 0;">${esc(v.name)} ${v.due_date ? '– Due ' + formatDate(v.due_date) : ''}</div>`).join('')}
          </div>` : ''}

          ${state.carePlan?.diagnoses ? `<div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:6px;">🩻 Current Diagnoses</div>
            <div style="font-size:13px;color:var(--text-secondary);">${esc(state.carePlan.diagnoses)}</div>
          </div>` : ''}

          ${upcomingAppts.length > 0 ? `<div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:8px;">🗓️ Upcoming Appointments</div>
            ${upcomingAppts.map(a => `<div style="font-size:13px;padding:4px 0;">${esc(a.title)} – ${new Date(a.scheduled_at).toLocaleString()}</div>`).join('')}
          </div>` : ''}

          <div style="font-size:11px;color:var(--text-secondary);margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
            Generated ${new Date().toLocaleDateString()} · Vet Buddies Portal
          </div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save PDF</button>
          <button class="btn btn-secondary" data-action="nav-client-case" data-tab="careplan">← Back to Living Care Plan</button>
        </div>
      `;
      return renderLayout(summaryHtml);
    }

    function renderReferralPage() {
      const code = state.profile?.referral_code || 'Getting your referral code ready…';
      const link = `${window.location.origin}?ref=${code}`;
      return renderLayout(`
        <div style="max-width:500px;margin:0 auto;">
          <div style="font-family:'Fraunces',serif;font-size:24px;font-weight:700;margin-bottom:8px;">🎁 Refer a Friend</div>
          <div style="color:var(--text-secondary);margin-bottom:24px;">Share the love! When a friend signs up and activates their subscription, you'll both get a discount.</div>
          <div class="referral-code-box">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">YOUR REFERRAL CODE</div>
            <div class="referral-code">${esc(code)}</div>
          </div>
          <div class="card" style="margin-top:16px;">
            <div style="font-weight:600;margin-bottom:8px;">Share your link</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="referral-link-input" value="${esc(link)}" style="flex:1;font-size:12px;" readonly>
              <button class="btn btn-primary btn-small" onclick="navigator.clipboard.writeText('${esc(link)}').then(()=>document.getElementById('referral-link-input').style.background='#e8f8f5')">Copy</button>
            </div>
          </div>
          <div class="card" style="margin-top:12px;background:#f0faf8;">
            <div style="font-weight:600;margin-bottom:8px;">How it works</div>
            <div style="font-size:13px;color:var(--text-secondary);">
              1. Share your unique link or code with a friend<br>
              2. They sign up and choose a subscription plan<br>
              3. You both receive a credit on your next billing cycle
            </div>
          </div>
        </div>
      `);
    }

    // ══════════════════════════════════════════════════════════
    // BUDDY FEATURES
    // ══════════════════════════════════════════════════════════

    function renderBuddyAvailabilityPage() {
      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:4px;">🗓️ My Availability</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Mark time off so admin can reassign cases during your absence.</div>

          <button class="btn btn-primary" data-action="toggle-availability" style="margin-bottom:16px;">+ Add Time Off</button>

          ${state.showAvailability ? `<div class="card" style="margin-bottom:16px;background:#f0faf8;border:1px solid var(--primary);">
            <div class="card-title" style="margin-bottom:12px;">Add Out-of-Office Period</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group"><label>Start Date</label><input type="date" data-field="avail-start" style="width:100%;"></div>
              <div class="form-group"><label>End Date</label><input type="date" data-field="avail-end" style="width:100%;"></div>
            </div>
            <div class="form-group"><label>Reason (optional)</label><input type="text" data-field="avail-reason" placeholder="e.g. Vacation, Conference" style="width:100%;"></div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-primary btn-small" data-action="save-availability">Save</button>
              <button class="btn btn-secondary btn-small" data-action="toggle-availability">Cancel</button>
            </div>
          </div>` : ''}

          ${state.buddyAvailability.length === 0 ? '<div class="empty-state"><div class="empty-state-text">No time off scheduled</div></div>' :
            state.buddyAvailability.map(a => `<div class="availability-period">
              <span style="font-size:20px;">🏖️</span>
              <div style="flex:1;">
                <div style="font-weight:600;">${formatDate(a.start_date)} → ${formatDate(a.end_date)}</div>
                ${a.reason ? `<div style="font-size:12px;color:var(--text-secondary);">${esc(a.reason)}</div>` : ''}
              </div>
              <button class="btn btn-secondary btn-small" data-action="delete-availability" data-avail-id="${a.id}" style="font-size:11px;">Remove</button>
            </div>`).join('')
          }
        </div>
      `);
    }

    function renderCannedResponsesPage() {
      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:4px;">💬 Canned Responses</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Save frequently-used replies. Type <strong>/shortcut</strong> in any message box to quickly insert.</div>
          <button class="btn btn-primary" data-action="show-add-canned" style="margin-bottom:16px;">+ New Response</button>
          ${state.cannedResponses.map(cr => `<div class="card" style="margin-bottom:10px;display:flex;align-items:flex-start;gap:12px;">
            <div style="flex:1;">
              <div style="font-weight:600;color:var(--primary);font-size:13px;">${esc(cr.shortcut)}</div>
              <div style="font-size:13px;margin-top:4px;">${esc(cr.content)}</div>
            </div>
            <button class="btn btn-secondary btn-small" data-action="delete-canned" data-canned-id="${cr.id}" style="font-size:11px;flex-shrink:0;">Delete</button>
          </div>`).join('')}
        </div>
      `);
    }

    function renderTouchpointTemplatesPage() {
      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:4px;">📋 Check-in Templates</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Pre-written scripts for common check-ins. Click "Use" to pre-fill a touchpoint note.</div>
          ${state.touchpointTemplates.map(t => `<div class="card" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
              <div style="font-weight:600;">${esc(t.name)}</div>
              <span style="font-size:11px;background:var(--bg);padding:2px 8px;border-radius:10px;color:var(--text-secondary);">${esc(t.type)}</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">${esc(t.content)}</div>
            <button class="btn btn-secondary btn-small" data-action="use-template" data-template-id="${t.id}">Use Template</button>
          </div>`).join('')}
        </div>
      `);
    }

    // ══════════════════════════════════════════════════════════
    // ADMIN FEATURES
    // ══════════════════════════════════════════════════════════

    function renderAdminAnalytics() {
      const d = state.analyticsData;
      if (!d) return renderLayout('<div class="empty-state"><div class="empty-state-text">Getting your care plan ready…</div></div>');

      // Build signup trend (last 30 signups bucketed by week)
      const weekBuckets = {};
      for (const u of d.recentSignups || []) {
        const week = new Date(u.created_at);
        week.setDate(week.getDate() - week.getDay());
        const key = week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weekBuckets[key] = (weekBuckets[key] || 0) + 1;
      }
      const weekLabels = Object.keys(weekBuckets).slice(-8);
      const weekValues = weekLabels.map(k => weekBuckets[k]);

      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:20px;">📊 Analytics</div>
          <div class="analytics-grid">
            <div class="analytics-stat"><div class="analytics-stat-num">${d.totalClients || 0}</div><div class="analytics-stat-label">Client Accounts</div></div>
            <div class="analytics-stat"><div class="analytics-stat-num" style="color:var(--green);">${d.activeCases || 0}</div><div class="analytics-stat-label">Active Cases</div></div>
            <div class="analytics-stat"><div class="analytics-stat-num" style="color:var(--blue);">${d.totalMessages || 0}</div><div class="analytics-stat-label">Total Messages</div></div>
            <div class="analytics-stat"><div class="analytics-stat-num" style="color:${d.openEscalations > 0 ? 'var(--red)' : 'var(--green)'};">${d.openEscalations || 0}</div><div class="analytics-stat-label">Open Escalations</div></div>
          </div>

          <div class="card">
            <div style="font-weight:600;margin-bottom:12px;">New Client Signups (Recent)</div>
            <div class="chart-container"><canvas id="signups-chart"></canvas></div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div style="font-weight:600;margin-bottom:12px;">Subscription Tiers</div>
            <div class="chart-container" style="height:150px;"><canvas id="tiers-chart"></canvas></div>
          </div>
        </div>
      `);
    }

    function renderOnboardingPipeline() {
      const stages = [
        { key: 'signed_up', label: 'Signed Up', icon: '👤' },
        { key: 'pet_added', label: 'Pet Added', icon: '🐾' },
        { key: 'buddy_assigned', label: 'Buddy Assigned', icon: '🩺' },
        { key: 'active', label: 'Active', icon: '✅' },
      ];

      const clientCases = state.cases;
      const stageClients = {
        signed_up: clientCases.filter(c => !c.pets?.name && !c.assigned_buddy_id),
        pet_added: clientCases.filter(c => c.pets?.name && !c.assigned_buddy_id),
        buddy_assigned: clientCases.filter(c => c.assigned_buddy_id && c.status !== 'Active'),
        active: clientCases.filter(c => c.status === 'Active'),
      };

      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:20px;">🚀 Onboarding Pipeline</div>
          <div class="kanban-board">
            ${stages.map(s => `
              <div class="kanban-col">
                <div class="kanban-col-title">${s.icon} ${s.label} <span style="background:var(--primary);color:white;border-radius:10px;padding:1px 7px;font-size:10px;">${stageClients[s.key]?.length || 0}</span></div>
                ${(stageClients[s.key] || []).map(c => `
                  <div class="kanban-card" data-action="select-case" data-case-id="${c.id}">
                    <div style="font-weight:600;font-size:12px;">${esc(c.pets?.name) || 'No pet yet'}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${esc(c.pets?.owner?.name)}</div>
                    ${c.subscription_tier === 'Trial' ? `<div style="font-size:10px;color:#e67e22;margin-top:3px;font-weight:600;">🎉 Free Trial</div>` : c.subscription_tier ? `<div style="font-size:10px;color:var(--primary);margin-top:3px;">${c.subscription_tier}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }

    function renderSLATracker() {
      const now = new Date();
      const slaHours = 24;
      const casesSLAStatus = state.cases.map(c => {
        const lastUpdate = new Date(c.last_client_message_at || c.updated_at);
        const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);
        return { ...c, hoursSince, breached: hoursSince > slaHours };
      }).sort((a, b) => b.hoursSince - a.hoursSince);

      const breached = casesSLAStatus.filter(c => c.breached);
      const ok = casesSLAStatus.filter(c => !c.breached);

      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:6px;">⏱️ Response Time Monitor</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Cases without an update in the last ${slaHours} hours are flagged.</div>

          ${breached.length > 0 ? `
            <div style="font-weight:600;color:var(--red);margin-bottom:10px;">🔴 Needs Attention (${breached.length})</div>
            ${breached.map(c => `
              <div class="sla-alert" data-action="select-case" data-case-id="${c.id}" style="cursor:pointer;">
                <div style="font-weight:600;">${SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾'} ${esc(c.pets?.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">No update for ${Math.floor(c.hoursSince)}h · ${esc(c.pets?.owner?.name)} · Buddy: ${esc(c.assigned_buddy?.name) || 'Unassigned'}</div>
              </div>`).join('')}
          ` : '<div style="color:var(--green);margin-bottom:16px;">✅ All cases updated within SLA</div>'}

          ${ok.length > 0 ? `
            <div style="font-weight:600;color:var(--green);margin-bottom:10px;margin-top:16px;">🟢 Within SLA (${ok.length})</div>
            ${ok.map(c => `
              <div class="sla-alert sla-ok" data-action="select-case" data-case-id="${c.id}" style="cursor:pointer;">
                <div style="font-weight:600;">${SPECIES_EMOJI[c.pets?.species?.toLowerCase()] || '🐾'} ${esc(c.pets?.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">Updated ${Math.floor(c.hoursSince)}h ago · ${esc(c.assigned_buddy?.name) || 'Unassigned'}</div>
              </div>`).join('')}
          ` : ''}
        </div>
      `);
    }

    function renderReEngagementAlerts() {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const atRisk = state.cases.filter(c => {
        const lastUpdate = new Date(c.updated_at);
        return lastUpdate < thirtyDaysAgo && c.status === 'Active';
      });

      return renderLayout(`
        <div>
          <div style="font-size:20px;font-weight:700;margin-bottom:6px;">📢 Re-Engagement Alerts</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Active clients with no activity in 30+ days — consider reaching out.</div>
          ${atRisk.length === 0 ? '<div class="empty-state"><div class="empty-state-text">✅ No at-risk clients right now</div></div>' :
            atRisk.map(c => {
              const daysSince = Math.floor((now - new Date(c.updated_at)) / (1000 * 60 * 60 * 24));
              return `<div class="card" style="margin-bottom:10px;display:flex;align-items:center;gap:12px;">
                ${renderPetPhoto(c.pets, 'card')}
                <div style="flex:1;">
                  <div style="font-weight:600;">${esc(c.pets?.name)} – ${esc(c.pets?.owner?.name)}</div>
                  <div style="font-size:12px;color:var(--red);">No activity for ${daysSince} days</div>
                  <div style="font-size:12px;color:var(--text-secondary);">Buddy: ${esc(c.assigned_buddy?.name) || 'Unassigned'}</div>
                </div>
                <button class="btn btn-primary btn-small" data-action="nav-buddy-case" data-case-id="${c.id}">View Case</button>
              </div>`;
            }).join('')
          }
        </div>
      `);
    }

    function renderBuddyInbox() {
      const grouped = {};
      for (const msg of state.inboxMessages) {
        if (!grouped[msg.case_id]) grouped[msg.case_id] = [];
        grouped[msg.case_id].push(msg);
      }

      let html = '<div>';
      html += `<div style="font-size:20px;font-weight:700;margin-bottom:18px;">📬 My Inbox</div>`;
      if (Object.keys(grouped).length === 0) {
        html += '<div class="empty-state"><div class="empty-state-text">✅ All caught up — no unread messages</div></div>';
      } else {
        for (const [caseId, msgs] of Object.entries(grouped)) {
          const petCase = state.cases.find(c => c.id === caseId);
          const petName = petCase?.pets?.name || 'Unknown Pet';
          const ownerName = petCase?.pets?.owner?.name || 'Client';
          const species = petCase?.pets?.species?.toLowerCase() || '';
          html += `<div class="card" style="cursor:pointer;" data-action="nav-buddy-case" data-case-id="${caseId}">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              ${petCase?.pets?.photo_url
                ? `<img src="${petCase.pets.photo_url}" class="pet-photo-thumb" alt="${esc(petName)}">`
                : `<div class="pet-photo-thumb-placeholder">${SPECIES_EMOJI[species] || '🐾'}</div>`}
              <div>
                <div style="font-weight:600;">${SPECIES_EMOJI[species] || '🐾'} ${esc(petName)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">Owner: ${esc(ownerName)} · ${msgs.length} unread</div>
              </div>
            </div>`;
          for (const msg of msgs.slice(0, 3)) {
            const preview = (msg.content || '').substring(0, 100);
            html += `<div style="padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:6px;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px;">${esc(msg.sender?.name || ownerName)} · ${formatDateTime(msg.created_at)}</div>
              <div style="font-size:13px;">${esc(preview)}${(msg.content||'').length > 100 ? '…' : ''}</div>
            </div>`;
          }
          if (msgs.length > 3) html += `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;">+${msgs.length - 3} more…</div>`;
          html += '</div>';
        }
      }
      html += '</div>';
      return renderLayout(html);
    }

    function renderAdminEscalations() {
      let html = '<div>';
      if (state.escalations.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-text">No open escalations — things are running smoothly.</div></div>';
      } else {
        const adverseOutcomes = state.escalations.filter(e => e.escalation_type === 'adverse_outcome');
        const clinicalEscalations = state.escalations.filter(e => e.escalation_type !== 'adverse_outcome');
        const statusBg = { open: 'var(--red)', acknowledged: 'var(--amber)', resolved: 'var(--green)' };

        function renderEscCard(escalation, isAdverse) {
          return `
            <div class="escalation-card" style="${isAdverse ? 'border:2px solid var(--red);background:#fef2f2;' : ''}">
              <div class="escalation-header">
                <div class="escalation-pet">${isAdverse ? '🔴 ' : ''}${SPECIES_EMOJI[escalation.case?.pets?.species] || '🐾'} ${esc(escalation.case?.pets?.name)}</div>
                <span class="escalation-status" style="background: ${statusBg[escalation.status]}20; color: ${statusBg[escalation.status]};">${esc(escalation.status?.toUpperCase())}</span>
              </div>
              ${isAdverse ? '<div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:4px;">Adverse Outcome</div>' : ''}
              <div class="escalation-reason">${esc(escalation.reason)}</div>
              ${escalation.incident_notes ? `<div style="margin-top:8px;padding:8px;background:#fff5f5;border-radius:6px;border-left:3px solid var(--red);font-size:13px;"><strong>Incident Notes:</strong> ${esc(escalation.incident_notes)}</div>` : ''}
              <div class="escalation-date">Raised by ${esc(escalation.raised_by_user?.name)} on ${formatDate(escalation.created_at)}</div>
              ${escalation.status !== 'resolved' ? `
                <div style="margin-top: 8px; display: flex; gap: 8px;">
                  ${escalation.status === 'open' ? `<button class="btn btn-secondary btn-small" data-action="escalation-ack" data-escalation-id="${escalation.id}">Acknowledge</button>` : ''}
                  <button class="btn btn-primary btn-small" data-action="escalation-resolve" data-escalation-id="${escalation.id}">Mark Resolved</button>
                </div>
              ` : ''}
            </div>
          `;
        }

        // Adverse Outcomes section — always shown first
        if (adverseOutcomes.length > 0) {
          html += `<div style="margin-bottom:24px;">
            <div style="font-size:16px;font-weight:700;color:var(--red);margin-bottom:12px;padding:8px 12px;background:#fef2f2;border-radius:8px;border-left:4px solid var(--red);">🔴 Adverse Outcomes — Requires Immediate Review</div>`;
          for (const escItem of adverseOutcomes) html += renderEscCard(escItem, true);
          html += '</div>';
        }

        // Clinical escalations
        if (clinicalEscalations.length > 0) {
          html += `<div style="margin-bottom:16px;font-size:16px;font-weight:600;">Clinical Escalations</div>`;
          for (const escItem of clinicalEscalations) html += renderEscCard(escItem, false);
        }
      }
      html += '</div>';
      return renderLayout(html);
    }

    function renderAdminSchedule() {
      // Build week grid: today + 6 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        weekDays.push(d);
      }

      // Group appointments by date string
      const apptsByDate = {};
      for (const appt of state.appointments) {
        const d = new Date(appt.scheduled_at);
        d.setHours(0, 0, 0, 0);
        const key = d.toDateString();
        if (!apptsByDate[key]) apptsByDate[key] = [];
        apptsByDate[key].push(appt);
      }

      // Collect pending touchpoints from cases (monthly check-ins due)
      const touchpointsDue = [];
      for (const c of state.cases) {
        if (c.status === 'Active') {
          const lastMsg = c.last_client_message_at ? new Date(c.last_client_message_at) : null;
          const daysSince = lastMsg ? Math.floor((Date.now() - lastMsg) / 86400000) : 999;
          if (daysSince >= 28) {
            touchpointsDue.push({ pet: c.pets?.name, owner: c.pets?.owner?.name, buddy: c.assigned_buddy?.name, daysSince, caseId: c.id });
          }
        }
      }

      const typeColors = { 'Video Call': '#3498db', 'In-Person': '#336026', 'Phone': '#e67e22', 'Internal': '#888' };
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      let html = '<div>';

      // Header row
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:20px;font-weight:700;">Schedule</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Week of ${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}</div>
        </div>
        <button class="btn btn-primary btn-small" data-action="new-appointment">+ New Appointment</button>
      </div>`;

      // Weekly grid
      html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:24px;">`;
      for (const day of weekDays) {
        const key = day.toDateString();
        const appts = apptsByDate[key] || [];
        const isToday = day.toDateString() === new Date().toDateString();
        html += `<div style="background:${isToday ? '#f0faf8' : 'white'};border:${isToday ? '2px solid #336026' : '1px solid var(--border)'};border-radius:8px;padding:10px 8px;min-height:80px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${isToday ? '#336026' : 'var(--text-secondary)'};">${dayNames[day.getDay()]}</div>
          <div style="font-size:18px;font-weight:700;color:${isToday ? '#336026' : 'var(--text-primary)'};">${day.getDate()}</div>
          ${appts.map(a => `<div style="margin-top:4px;font-size:10px;background:${typeColors[a.type] || '#3498db'};color:white;border-radius:3px;padding:2px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.title)}</div>`).join('')}
          ${appts.length === 0 && isToday ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:4px;">Nothing scheduled</div>' : ''}
        </div>`;
      }
      html += '</div>';

      // Upcoming appointments list
      const upcomingAppts = state.appointments
        .filter(a => new Date(a.scheduled_at) >= today)
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

      html += `<div class="card" style="margin-bottom:16px;">
        <div style="font-weight:700;margin-bottom:12px;">Upcoming appointments</div>`;
      if (upcomingAppts.length === 0) {
        html += `<div style="color:var(--text-secondary);font-size:14px;padding:8px 0;">No appointments scheduled — use the button above to add one.</div>`;
      } else {
        for (const appt of upcomingAppts) {
          const dt = new Date(appt.scheduled_at);
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
              <div style="font-weight:600;font-size:14px;">${esc(appt.title)}</div>
              <div style="font-size:12px;color:var(--text-secondary);">${dt.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})} · ${dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;background:${typeColors[appt.type] || '#3498db'}22;color:${typeColors[appt.type] || '#3498db'};">${esc(appt.type)}</span>
          </div>`;
        }
      }
      html += '</div>';

      // Touchpoints due
      if (touchpointsDue.length > 0) {
        html += `<div class="card" style="border-left:3px solid #e67e22;">
          <div style="font-weight:700;margin-bottom:12px;">⏰ Check-ins due (28+ days since last contact)</div>`;
        for (const tp of touchpointsDue) {
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
            <div>
              <div style="font-weight:600;font-size:14px;">${esc(tp.pet)} · ${esc(tp.owner) || 'Unknown owner'}</div>
              <div style="font-size:12px;color:var(--text-secondary);">Buddy: ${esc(tp.buddy) || 'Unassigned'} · Last contact ${tp.daysSince === 999 ? 'never' : tp.daysSince + ' days ago'}</div>
            </div>
            <button class="btn btn-secondary btn-small" data-action="select-case" data-case-id="${tp.caseId}">View case</button>
          </div>`;
        }
        html += '</div>';
      }

      html += '</div>';
      return renderLayout(html);
    }

    function renderAdminTeam() {
      let html = '<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:20px;font-weight:700;">Team Management</div></div>';
      html += '<div class="grid">';
      for (const member of state.teamMembers) {
        const caseCount = state.cases.filter(c => c.assigned_buddy_id === member.id).length;
        const isBuddy = member.role === 'vet_buddy';
        html += `
          <div class="team-card">
            <div class="team-card-avatar">${renderAvatar(member.avatar_initials, member.avatar_color, 'md')}</div>
            <div class="team-card-name">${esc(member.name)}</div>
            <div class="team-card-role">${member.role === 'admin' ? 'Supervising DVM' : member.role.replace('_', ' ')}</div>
            <div class="team-card-bio">${esc(member.bio) || 'No bio'}</div>
            <div class="team-card-stat">${caseCount} assigned case${caseCount !== 1 ? 's' : ''}</div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-small" data-action="edit-team-member" data-member-id="${member.id}">Edit</button>
              ${isBuddy && caseCount > 0 ? `<button class="btn btn-secondary btn-small" data-action="initiate-transition" data-member-id="${member.id}" data-member-name="${esc(member.name)}" style="border-color:var(--amber);color:var(--amber);">🔄 Initiate Transition</button>` : ''}
              ${isBuddy ? `<button class="btn btn-secondary btn-small" data-action="deactivate-buddy" data-member-id="${member.id}" style="border-color:var(--red);color:var(--red);font-size:11px;">Deactivate</button>` : ''}
            </div>
          </div>
        `;
      }
      html += '</div>';

      // Transition Protocol panel
      if (state.showTransitionPanel) {
        html += `<div class="card" style="margin-top:20px;border:2px solid var(--amber);background:#fffde7;">
          <div style="font-weight:700;margin-bottom:12px;font-size:16px;">🔄 Buddy Transition Protocol</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Transitioning: <strong>${esc(state.transitionBuddyName)}</strong></div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;margin-bottom:16px;">
            <div>1. ✅ Notify Dr. Rodgers (you're doing this now)</div>
            <div>2. Outgoing Buddy writes transition notes for each case</div>
            <div>3. Client selects replacement Buddy from available pool</div>
            <div>4. Both Buddies active during overlap period (1–8 weeks)</div>
            <div>5. Incoming Buddy reads full Living Care Plan before first contact</div>
            <div>6. Warm handoff call/message with client</div>
            <div>7. 30-day satisfaction window begins</div>
          </div>
          <div class="form-group"><label style="font-weight:600;">Overlap Period (weeks)</label>
            <select data-field="transition-overlap" style="width:100%;">
              <option value="1">1 week</option><option value="2">2 weeks</option><option value="4" selected>4 weeks</option><option value="8">8 weeks</option>
            </select>
          </div>
          <div class="form-group"><label style="font-weight:600;">Transition Notes</label>
            <textarea data-field="transition-notes" placeholder="Document relationship context, communication preferences, and anything the case summary may not capture..." style="width:100%;height:100px;"></textarea>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" data-action="save-transition">Begin Transition</button>
            <button class="btn btn-secondary" data-action="cancel-transition">Cancel</button>
          </div>
        </div>`;
      }

      return renderLayout(html);
    }

    function renderProfileSettings() {
      const AVATAR_COLORS = ['#689562', '#336026', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#27ae60', '#c0392b'];
      return renderLayout(`
        <div class="card" style="max-width: 520px;">
          <div class="card-title" style="margin-bottom: 20px;">Profile Settings</div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" data-field="profile-name" value="${esc(state.profile.name) || ''}" style="width:100%;">
          </div>
          ${['vet_buddy', 'admin'].includes(state.profile.role) ? `
          <div class="form-group">
            <label>Bio</label>
            <textarea data-field="profile-bio" placeholder="Tell clients about yourself..." style="width:100%;height:80px;">${esc(state.profile.bio) || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Response Time</label>
            <input type="text" data-field="profile-response-time" value="${esc(state.profile.response_time) || ''}" placeholder="e.g. Within 4 hours" style="width:100%;">
          </div>` : ''}
          <div class="form-group">
            <label>Avatar Color</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
              ${AVATAR_COLORS.map(c => `<div data-action="pick-avatar-color" data-color="${c}" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:${state.profile.avatar_color === c ? '3px solid #000' : '3px solid transparent'};"></div>`).join('')}
            </div>
          </div>
          <div style="display:flex; gap:12px; margin-top:8px;">
            <button class="btn btn-primary" data-action="save-profile">Save Changes</button>
            <button class="btn btn-secondary" data-action="cancel-profile">Cancel</button>
          </div>
        </div>
        ${state.profile.role === 'client' ? `
        <div class="card" style="max-width: 520px; margin-top: 24px; border: 1px solid var(--red);">
          <div class="card-title" style="color: var(--red); margin-bottom: 12px;">Danger Zone</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Permanently delete your account and all associated data. This action cannot be undone. Your pets, care plans, messages, and documents will be removed.</p>
          <button class="btn" data-action="delete-account" style="background: var(--red); color: white; border: none;">Delete My Account</button>
        </div>` : ''}
      `);
    }

    function renderAdminResources() {
      const canEdit = state.profile?.role === 'admin';
      const resources = state.resources.length > 0 ? state.resources : [
        { id: null, title: 'Tier Overview', description: 'Buddy, Buddy+, and Buddy VIP plan details', icon: '📊', url: null },
        { id: null, title: 'Behavioral Consult Protocol', description: 'Step-by-step guide for behavioral escalations', icon: '🧠', url: null },
        { id: null, title: 'Welcome Script', description: 'Onboarding script for new client calls', icon: '📝', url: null },
        { id: null, title: 'Compensation Structure', description: 'CSU student payment and hour tracking', icon: '💰', url: null },
        { id: null, title: 'CSU Student Handbook', description: 'Policies and clinical guidelines', icon: '📖', url: null },
        { id: null, title: 'Emergency Escalation Protocol', description: 'When and how to escalate to Dr. Rodgers', icon: '🚨', url: null },
      ];

      let html = '';
      if (canEdit) {
        html += `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
          <button class="btn btn-primary btn-small" data-action="toggle-add-resource">${state.showAddResource ? '✕ Cancel' : '+ Add Resource'}</button>
        </div>`;
        if (state.showAddResource) {
          html += `<div class="card" style="margin-bottom:16px;background:#f0faf8;border:1px solid var(--primary);">
            <div class="card-title" style="margin-bottom:12px;">New Resource</div>
            <div class="form-group"><label>Title</label><input type="text" data-field="res-title" placeholder="Resource name" style="width:100%;"></div>
            <div class="form-group"><label>Description</label><input type="text" data-field="res-desc" placeholder="Brief description" style="width:100%;"></div>
            <div class="form-group"><label>URL (optional)</label><input type="url" data-field="res-url" placeholder="https://..." style="width:100%;"></div>
            <div class="form-group"><label>Icon (emoji)</label><input type="text" data-field="res-icon" value="📄" style="width:80px;"></div>
            <button class="btn btn-primary" data-action="save-resource">Save Resource</button>
          </div>`;
        }
      }

      html += '<div class="grid">';
      for (const res of resources) {
        const tag = res.url ? 'a' : 'div';
        const href = res.url ? `href="${esc(res.url)}" target="_blank" rel="noopener"` : '';
        html += `
          <${tag} ${href} class="resource-card" data-action="${res.url ? '' : 'open-resource'}" data-res-id="${res.id || ''}">
            <div class="resource-icon">${res.icon || '📄'}</div>
            <div class="resource-title">${esc(res.title)}</div>
            <div class="resource-description">${esc(res.description) || ''}</div>
            ${res.url ? '<div style="font-size:11px;color:var(--primary);margin-top:6px;">🔗 Open link</div>' : RESOURCE_DOCUMENTS[res.title] ? '<div style="font-size:11px;color:var(--primary);margin-top:6px;">📖 View document</div>' : '<div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">No link yet</div>'}
            ${canEdit && res.id ? `<button class="btn btn-secondary btn-small" data-action="edit-resource-url" data-res-id="${res.id}" style="margin-top:8px;" onclick="event.preventDefault();event.stopPropagation();">Edit URL</button>` : ''}
          </${tag}>
        `;
      }
      html += '</div>';
      return renderLayout(html);
    }

    function renderAdminCaseCreation() {
      const clients = state.allClients;
      return renderLayout(`
        <div class="card" style="max-width:560px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <button class="btn btn-secondary btn-small" data-action="nav-admin-cases">← Back</button>
            <div class="card-title" style="margin:0;">Create New Case</div>
          </div>
          <div class="form-group">
            <label>Client</label>
            <select data-field="new-case-client" style="width:100%;">
              <option value="">Select a client...</option>
              ${clients.map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.email)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Pet Name</label>
            <input type="text" data-field="new-case-pet-name" placeholder="e.g. Biscuit" style="width:100%;">
          </div>
          <div class="form-group">
            <label>Species</label>
            <select data-field="new-case-pet-species" style="width:100%;">
              <option value="Dog">Dog 🐕</option>
              <option value="Cat">Cat 🐈</option>
              <option value="Bird">Bird 🦜</option>
              <option value="Rabbit">Rabbit 🐇</option>
              <option value="Other">Other 🐾</option>
            </select>
          </div>
          <div class="form-group">
            <label>Breed (optional)</label>
            <input type="text" data-field="new-case-pet-breed" placeholder="e.g. Labrador" style="width:100%;">
          </div>
          <div class="form-group">
            <label>Subscription Tier</label>
            <select data-field="new-case-tier" style="width:100%;">
              <option value="Buddy">Buddy</option>
              <option value="Buddy+">Buddy+</option>
              <option value="Buddy VIP">Buddy VIP</option>
            </select>
          </div>
          <div class="form-group">
            <label>Assign Buddy (optional)</label>
            <select data-field="new-case-buddy" style="width:100%;">
              <option value="">Unassigned</option>
              ${state.teamMembers.filter(m => m.role === 'vet_buddy').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;gap:12px;margin-top:8px;">
            <button class="btn btn-primary" data-action="save-new-case">Create Case</button>
            <button class="btn btn-secondary" data-action="nav-admin-cases">Cancel</button>
          </div>
        </div>
      `);
    }

    function renderOnboarding() {
      const step = state.onboardingStep || 1;
      // Simplified 2-step onboarding: Subscribe → Add Pet (then straight to dashboard)
      const steps = ['Start Free Trial', 'Add Your Pet'];
      const stepsHtml = steps.map((s, i) => `
        <div style="display:flex;align-items:center;gap:8px;${i+1 < step ? 'opacity:0.5;' : ''}">
          <div style="width:28px;height:28px;border-radius:50%;background:${i+1 <= step ? 'var(--primary)' : 'var(--border)'};color:${i+1 <= step ? 'white' : 'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;">${i+1 < step ? '✓' : i+1}</div>
          <span style="font-size:14px;font-weight:${i+1===step ? '600' : '400'};color:${i+1===step ? 'var(--text)' : 'var(--text-secondary)'};">${s}</span>
        </div>
        ${i < steps.length-1 ? '<div style="width:2px;height:20px;background:var(--border);margin-left:14px;"></div>' : ''}
      `).join('');

      let content = '';
      if (step === 1) {
        const _onboardLTO = isLTOActive();
        content = `
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;margin-bottom:12px;">🐾</div>
            <div style="font-size:22px;font-weight:700;color:#336026;margin-bottom:8px;">Welcome to Vet Buddies!</div>
            <div style="color:var(--text-secondary);">Every pet deserves a Buddy. Let's get you set up.</div>
          </div>
          ${_onboardLTO ? renderLTOCountdownBanner() : ''}
          <div class="card" style="border:2px solid var(--primary);background:linear-gradient(135deg,#f0faf9 0%,#fff 100%);margin-bottom:20px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🎉</div>
            <div style="font-size:18px;font-weight:700;color:#336026;margin-bottom:6px;">Try Vet Buddies Free for ${TRIAL_DURATION_DAYS} Days</div>
            <div style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">No credit card required. Full access — regular check-ins from your Vet Buddy, your Living Care Plan, and care coordination between vet visits.</div>
            <button class="btn btn-primary" data-action="start-free-trial" style="width:100%;font-size:16px;padding:14px;">Start My Free Trial →</button>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">Cancel anytime · No commitment</div>
          </div>
          <div style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:16px;">— or choose a paid plan to get started right away —</div>
          ${renderSubscriptionCard()}
        `;
      } else if (step === 2) {
        // Combined: Add Pet + "What's on your mind?" in one form
        content = `
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;margin-bottom:12px;">🐕</div>
            <div style="font-size:22px;font-weight:700;color:#336026;margin-bottom:8px;">Tell us about your pet</div>
            <div style="color:var(--text-secondary);">We'll create a care profile and your Buddy will reach out within 48 hours.</div>
          </div>
          <div class="card">
            <div class="form-group"><label>Pet Name</label><input type="text" data-field="new-pet-name" placeholder="e.g. Biscuit" style="width:100%;" autofocus></div>
            <div class="form-group"><label>Species</label>
              <select data-field="new-pet-species" style="width:100%;">
                <option value="Dog">Dog 🐕</option><option value="Cat">Cat 🐈</option><option value="Bird">Bird 🦜</option><option value="Rabbit">Rabbit 🐇</option><option value="Other">Other 🐾</option>
              </select>
            </div>
            <div class="form-group"><label>Breed (optional)</label><input type="text" data-field="new-pet-breed" placeholder="e.g. Tabby" style="width:100%;"></div>
            <div class="form-group" style="margin-top:8px;padding-top:16px;border-top:1px solid var(--border);">
              <label style="font-weight:600;">What's most on your mind about your pet's care?</label>
              <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">This becomes your first care goal — totally optional.</div>
              <textarea data-field="onboarding-concern" placeholder="e.g. I'm worried about my dog's weight gain since the surgery..." style="width:100%;height:70px;"></textarea>
            </div>
          </div>
          <div style="margin-top:20px;">
            <div style="font-size:18px;font-weight:700;color:#336026;margin-bottom:4px;">Choose Your Buddy</div>
            <div style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">Pick the trained veterinary professional who'll be your pet's dedicated point of contact.</div>
            <div class="buddy-picker-grid">
              ${state.availableBuddies.map(b => {
                const isReferred = b.id === state.referredByBuddyId;
                const isSelected = b.id === state.selectedBuddyId;
                return `
                  <div class="buddy-picker-card ${isSelected ? 'selected' : ''}" data-action="select-buddy" data-buddy-id="${b.id}">
                    ${isReferred ? '<div class="buddy-referred-badge">Referred you!</div>' : ''}
                    <div class="buddy-picker-avatar" style="background:${b.avatar_color || '#689562'};">${esc(b.avatar_initials || b.name?.substring(0,2).toUpperCase() || '??')}</div>
                    <div class="buddy-picker-name">${esc(b.name)}</div>
                    <div class="buddy-picker-bio">${esc(b.bio) || 'Trained veterinary professional'}</div>
                    <div class="buddy-picker-meta">${esc(b.response_time || 'Typically responds within 24 hours')}</div>
                    <div class="buddy-picker-meta">Currently caring for ${b.activeCases} pet${b.activeCases !== 1 ? 's' : ''}</div>
                    <div class="buddy-picker-check">${isSelected ? '✓ Selected' : 'Choose'}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>
            <button class="btn btn-primary" data-action="save-new-pet-and-finish" style="width:100%;margin-top:20px;font-size:16px;padding:14px;">Get Started →</button>
          </div>
        `;
      }

      return `
        <div style="max-width:540px;margin:0 auto;padding:24px 16px;">
          <div style="display:flex;flex-direction:column;gap:0;margin-bottom:32px;">${stepsHtml}</div>
          ${content}
        </div>
      `;
    }

    function renderGeneticistDashboard() {
      const cases = state.cases || [];
      if (cases.length === 0) {
        return renderLayout(
          '<div class="empty-state">' +
          '<div class="empty-state-icon">🧬</div>' +
          '<div class="empty-state-title">No genetic records on file yet</div>' +
          '<div class="empty-state-text">Patients whose owners have uploaded genetic records will appear here. Ask Dr. Rodgers to mark records as genetic in the Files tab.</div>' +
          '</div>'
        );
      }
      let html = '<div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
      html += '<div><div style="font-size:20px;font-weight:700;">Patients — Genetic Records</div>';
      html += '<div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">' + cases.length + ' patient' + (cases.length !== 1 ? 's' : '') + ' with genetic data on file</div></div>';
      html += '</div>';
      html += '<div class="grid">';
      for (const c of cases) {
        const pet = c.pets;
        const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '\u{1F43E}';
        const hasInsight = (state.geneticInsights || []).some(g => g.case_id === c.id);
        html += '<div class="card" style="cursor:pointer;" data-action="nav-geneticist-case" data-case-id="' + c.id + '">';
        html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">';
        if (pet?.photo_url) {
          html += '<img src="' + esc(pet.photo_url) + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;" alt="' + esc(pet?.name || '') + '">';
        } else {
          html += '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#534AB7,#7F77DD);display:flex;align-items:center;justify-content:center;font-size:22px;">' + emoji + '</div>';
        }
        html += '<div>';
        html += '<div style="font-weight:700;font-size:16px;">' + esc(pet?.name || 'Unknown') + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);">' + esc(pet?.species || '') + (pet?.breed ? ' \u00b7 ' + esc(pet.breed) : '') + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);">Owner: ' + esc(pet?.owner?.name || 'Unknown') + '</div>';
        html += '</div></div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="font-size:12px;padding:3px 10px;border-radius:10px;background:' + (c.status === 'Active' ? '#E8F5E4' : '#f5f5f0') + ';color:' + (c.status === 'Active' ? '#336026' : '#888') + ';">' + (c.status || 'Unknown') + '</span>';
        html += '<span style="font-size:11px;padding:3px 10px;border-radius:10px;background:' + (hasInsight ? '#EEEDFE' : '#f5f5f0') + ';color:' + (hasInsight ? '#534AB7' : '#888') + ';">' + (hasInsight ? '\u2713 Insights added' : 'No insights yet') + '</span>';
        html += '</div>';
        html += '<button class="btn btn-primary btn-small" style="width:100%;margin-top:12px;" data-action="nav-geneticist-case" data-case-id="' + c.id + '">Open Patient</button>';
        html += '</div>';
      }
      html += '</div></div>';
      return renderLayout(html);
    }

    function renderGeneticistCase() {
      if (!state.currentCase) return renderLayout('<div class="empty-state"><div class="empty-state-text">No patient selected</div></div>');
      const c = state.currentCase;
      const pet = c.pets;
      const emoji = SPECIES_EMOJI[pet?.species?.toLowerCase()] || '\u{1F43E}';
      const tab = state.geneticCaseTab || 'overview';

      const tabs = [
        { id: 'overview', label: '\u{1F43E} Overview' },
        { id: 'records', label: '\u{1F4C1} Files' },
        { id: 'medications', label: '\u{1F48A} Medications' },
        { id: 'vaccines', label: '\u{1F489} Vaccines' },
        { id: 'careplan', label: '\u{1F4CB} Care Plan' },
        { id: 'insights', label: '\u{1F9EC} Genetic Insights' },
      ];

      let html = '<div>';
      // Back button
      html += '<button class="btn btn-secondary btn-small" data-action="nav-geneticist-dashboard" style="margin-bottom:16px;">\u2190 All Patients</button>';

      // Patient header
      html += '<div class="card" style="margin-bottom:16px;">';
      html += '<div style="display:flex;align-items:center;gap:16px;">';
      if (pet?.photo_url) {
        html += '<img src="' + esc(pet.photo_url) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">';
      } else {
        html += '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#534AB7,#7F77DD);display:flex;align-items:center;justify-content:center;font-size:28px;">' + emoji + '</div>';
      }
      html += '<div>';
      html += '<div style="font-size:20px;font-weight:700;">' + esc(pet?.name || 'Unknown') + '</div>';
      html += '<div style="font-size:13px;color:var(--text-secondary);">' + esc(pet?.species || '') + (pet?.breed ? ' \u00b7 ' + esc(pet.breed) : '') + (pet?.dob ? ' \u00b7 DOB ' + esc(pet.dob) : '') + (pet?.weight ? ' \u00b7 ' + esc(pet.weight) : '') + '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Owner: ' + esc(pet?.owner?.name || 'Unknown') + (pet?.owner?.email ? ' \u00b7 ' + esc(pet.owner.email) : '') + '</div>';
      html += '</div></div></div>';

      // Tab bar
      html += '<div class="tabs" style="margin-bottom:16px;">';
      for (const t of tabs) {
        html += '<button class="tab-button ' + (tab === t.id ? 'active' : '') + '" data-action="toggle-genetic-case-tab" data-tab="' + t.id + '">' + t.label + '</button>';
      }
      html += '</div>';

      // Overview tab
      if (tab === 'overview') {
        const lp = state.carePlan?.living_plan || {};
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-title" style="margin-bottom:12px;">Pet Profile</div>';
        const fields = [
          ['Species', pet?.species], ['Breed', pet?.breed], ['Date of Birth', pet?.dob],
          ['Weight', pet?.weight], ['Allergies', lp.allergies || state.carePlan?.allergies],
          ['Current Conditions', lp.diagnoses || state.carePlan?.diagnoses],
          ['Diet', lp.diet_notes || state.carePlan?.diet_notes],
        ];
        for (const [label, val] of fields) {
          if (val) {
            html += '<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">';
            html += '<div style="min-width:140px;color:var(--text-secondary);font-weight:500;">' + label + '</div>';
            html += '<div>' + esc(val) + '</div></div>';
          }
        }
        html += '</div>';
        const buddy = c.assigned_buddy;
        if (buddy) {
          html += '<div class="card">';
          html += '<div class="card-title" style="margin-bottom:8px;">Assigned Vet Buddy</div>';
          html += '<div style="display:flex;align-items:center;gap:10px;">';
          html += renderAvatar(buddy.avatar_initials, buddy.avatar_color, 'sm');
          html += '<div style="font-size:14px;font-weight:500;">' + esc(buddy.name) + '</div>';
          html += '</div></div>';
        }
      }

      // Files tab
      if (tab === 'records') {
        const docs = state.documents || [];
        html += '<div class="card">';
        html += '<div class="card-title" style="margin-bottom:12px;">Uploaded Files</div>';
        if (docs.length === 0) {
          html += '<div style="color:var(--text-secondary);font-size:14px;padding:12px 0;">No files uploaded yet for this patient.</div>';
        } else {
          const docIcons = { 'application/pdf': '\u{1F4C4}', 'image/jpeg': '\u{1F5BC}\uFE0F', 'image/png': '\u{1F5BC}\uFE0F' };
          for (const doc of docs) {
            const icon = docIcons[doc.mime_type] || '\u{1F4CE}';
            const isGenetic = doc.is_genetic;
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">';
            html += '<span style="font-size:20px;">' + icon + '</span>';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:13px;font-weight:500;">' + esc(doc.name) + '</div>';
            html += '<div style="font-size:11px;color:var(--text-secondary);">';
            html += (doc.size_bytes ? (doc.size_bytes > 1024*1024 ? (doc.size_bytes/1024/1024).toFixed(1)+'MB' : (doc.size_bytes/1024).toFixed(0)+'KB') + ' \u00b7 ' : '');
            html += formatDate(doc.created_at);
            if (isGenetic) html += ' \u00b7 <span style="color:#534AB7;font-weight:600;">\u{1F9EC} Genetic Record</span>';
            html += '</div></div>';
            html += '<a href="' + esc(doc.url) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-small">\u2B07\uFE0F View</a>';
            html += '</div>';
          }
        }
        html += '</div>';
      }

      // Medications tab
      if (tab === 'medications') {
        const meds = state.petMedications || [];
        html += '<div class="card">';
        html += '<div class="card-title" style="margin-bottom:12px;">Current Medications</div>';
        if (meds.length === 0) {
          html += '<div style="color:var(--text-secondary);font-size:14px;padding:12px 0;">No medications on record.</div>';
        } else {
          for (const med of meds.filter(m => m.is_active)) {
            html += '<div style="padding:10px 0;border-bottom:1px solid var(--border);">';
            html += '<div style="font-weight:600;font-size:14px;">' + esc(med.name) + '</div>';
            html += '<div style="font-size:12px;color:var(--text-secondary);">' + esc(med.dose || '') + (med.frequency ? ' \u00b7 ' + esc(med.frequency) : '') + (med.start_date ? ' \u00b7 Started ' + esc(med.start_date) : '') + '</div>';
            html += '</div>';
          }
        }
        html += '</div>';
      }

      // Vaccines tab
      if (tab === 'vaccines') {
        const vaccines = state.petVaccines || [];
        html += '<div class="card">';
        html += '<div class="card-title" style="margin-bottom:12px;">Vaccination History</div>';
        if (vaccines.length === 0) {
          html += '<div style="color:var(--text-secondary);font-size:14px;padding:12px 0;">No vaccination records on file.</div>';
        } else {
          for (const v of vaccines) {
            const overdue = v.due_date && new Date(v.due_date) < new Date();
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">';
            html += '<div>';
            html += '<div style="font-weight:500;font-size:13px;">' + esc(v.name) + '</div>';
            html += '<div style="font-size:11px;color:var(--text-secondary);">' + (v.administered_date ? 'Given: ' + esc(v.administered_date) : '') + (v.due_date ? ' \u00b7 Due: ' + esc(v.due_date) : '') + '</div>';
            html += '</div>';
            if (overdue) html += '<span style="font-size:11px;color:#c0392b;font-weight:600;">Overdue</span>';
            html += '</div>';
          }
        }
        html += '</div>';
      }

      // Care Plan tab
      if (tab === 'careplan') {
        const lp = state.carePlan;
        html += '<div class="card">';
        html += '<div class="card-title" style="margin-bottom:12px;">Living Care Plan</div>';
        if (!lp) {
          html += '<div style="color:var(--text-secondary);font-size:14px;padding:12px 0;">No care plan on file yet.</div>';
        } else {
          const sections = [
            ['Summary', lp.summary], ['Diagnoses', lp.diagnoses], ['Allergies', lp.allergies],
            ['Current Medications', lp.medications], ['Diet Notes', lp.diet_notes],
            ['Lifestyle Notes', lp.lifestyle_notes], ['Next Steps', lp.next_steps],
            ['Open Questions', lp.open_questions ? JSON.stringify(lp.open_questions) : null],
          ];
          for (const [label, val] of sections) {
            if (val && val !== '[]' && val !== 'null') {
              html += '<div style="margin-bottom:12px;">';
              html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:4px;">' + label + '</div>';
              html += '<div style="font-size:13px;line-height:1.6;">' + esc(val) + '</div>';
              html += '</div>';
            }
          }
        }
        html += '</div>';
      }

      // Genetic Insights tab (write access)
      if (tab === 'insights') {
        const insights = (state.geneticInsights || []).filter(g => g.case_id === c.id);
        const existing = insights[0] || null;
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-title" style="margin-bottom:4px;">\u{1F9EC} Your Genetic Insights</div>';
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Your findings will be visible to Dr. Rodgers, the assigned Vet Buddy, and the pet owner in their portal.</div>';
        html += '<div class="form-group"><label>Title</label><input type="text" data-field="insight-title" value="' + esc(existing?.title || 'Genetic Insights') + '" style="width:100%;"></div>';
        html += '<div class="form-group"><label>Findings & Analysis</label><textarea data-field="insight-content" style="width:100%;min-height:140px;" placeholder="Describe genetic findings, variant interpretations, breed-specific risk profile, and clinical relevance...">' + esc(existing?.content || '') + '</textarea></div>';
        html += '<div class="form-group"><label>Breed Risk Flags <span style="font-weight:400;color:var(--text-secondary)">(comma-separated)</span></label><input type="text" data-field="insight-risks" value="' + esc(existing?.breed_risk_flags?.join(', ') || '') + '" style="width:100%;" placeholder="e.g. MDR1 mutation, degenerative myelopathy risk"></div>';
        html += '<div class="form-group"><label>Recommendations <span style="font-weight:400;color:var(--text-secondary)">(one per line)</span></label><textarea data-field="insight-recs" style="width:100%;min-height:80px;" placeholder="e.g. Avoid acepromazine and ivermectin&#10;Annual cardiac screening recommended">' + esc(existing?.recommendations?.join('\n') || '') + '</textarea></div>';
        html += '<button class="btn btn-primary" data-action="save-genetic-insight" data-case-id="' + c.id + '">' + (existing ? 'Update Insights' : 'Save Insights') + '</button>';
        if (existing) {
          html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">Last updated: ' + formatDate(existing.updated_at) + '</div>';
        }
        html += '</div>';

        // Previous insights from other geneticists (read-only)
        if (insights.length > 1) {
          html += '<div class="card">';
          html += '<div class="card-title" style="margin-bottom:12px;">Other Insights on File</div>';
          for (const insight of insights.slice(1)) {
            html += '<div style="padding:12px 0;border-bottom:1px solid var(--border);">';
            html += '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">' + esc(insight.title) + '</div>';
            html += '<div style="font-size:13px;line-height:1.6;margin-bottom:6px;">' + esc(insight.content) + '</div>';
            if (insight.breed_risk_flags?.length) {
              html += '<div style="font-size:12px;color:#534AB7;margin-bottom:4px;">\u{1F6A9} Risk flags: ' + esc(insight.breed_risk_flags.join(', ')) + '</div>';
            }
            html += '<div style="font-size:11px;color:var(--text-secondary);">By ' + esc(insight.authored_by_user?.name || 'Unknown') + ' \u00b7 ' + formatDate(insight.updated_at) + '</div>';
            html += '</div>';
          }
          html += '</div>';
        }
      }

      html += '</div>';
      return renderLayout(html);
    }

        function renderExternalDashboard() {
      if (state.cases.length === 0) {
        return renderLayout(`
          <div class="empty-state">
            <div class="empty-state-icon">🐕</div>
            <div class="empty-state-title">No shared cases yet</div>
            <div class="empty-state-text">Cases shared with you by Vet Buddies will appear here.</div>
          </div>
        `);
      }

      const activeCases = state.cases.filter(c => c.status !== 'closed');
      const closedCases = state.cases.filter(c => c.status === 'closed');
      const upcomingAppts = state.appointments?.filter(a => a.status !== 'cancelled' && new Date(a.scheduled_at) > new Date()).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).slice(0, 5) || [];

      let html = '<div style="padding:24px;">';
      html += '<h1 style="font-family:\'Fraunces\',serif;font-size:28px;font-weight:700;color:var(--dark);margin-bottom:24px;">External Vet Dashboard</h1>';

      // Stats
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;">
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:12px;color:var(--text-secondary);font-weight:600;margin-bottom:8px;">Active Cases</div>
          <div style="font-size:28px;font-weight:700;color:#336026;">${activeCases.length}</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:12px;color:var(--text-secondary);font-weight:600;margin-bottom:8px;">Total Cases</div>
          <div style="font-size:28px;font-weight:700;color:var(--blue);">${state.cases.length}</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:12px;color:var(--text-secondary);font-weight:600;margin-bottom:8px;">Upcoming Appts</div>
          <div style="font-size:28px;font-weight:700;color:var(--amber);">${upcomingAppts.length}</div>
        </div>
      </div>`;

      // Upcoming appointments
      if (upcomingAppts.length > 0) {
        html += '<div class="card" style="padding:16px;margin-bottom:24px;"><h3 style="font-weight:600;color:#336026;margin-bottom:12px;">Upcoming Appointments</h3>';
        for (const a of upcomingAppts) {
          const typeColors = { 'Video Call': 'var(--blue)', 'In-Person': 'var(--green)', 'Phone': 'var(--amber)' };
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bg);">
            <div>
              <div style="font-weight:600;font-size:14px;">${esc(a.title)}</div>
              <div style="font-size:12px;color:var(--text-secondary);">${formatDate(a.scheduled_at)}</div>
            </div>
            <span style="background:${typeColors[a.type] || '#888'};color:white;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;">${esc(a.type)}</span>
          </div>`;
        }
        html += '</div>';
      }

      // Active cases
      html += '<h2 style="font-weight:600;color:#336026;margin-bottom:12px;">Shared Cases</h2>';
      html += '<div class="grid">';
      for (const c of state.cases) {
        const pet = c.pets || {};
        const emoji = SPECIES_EMOJI[pet.species?.toLowerCase()] || '🐾';
        const statusColor = c.status === 'active' ? 'var(--green)' : c.status === 'closed' ? '#999' : 'var(--amber)';
        html += `
          <div class="card" style="cursor:pointer;padding:16px;" data-action="nav-external-case" data-case-id="${c.id}">
            <div style="display:flex;gap:12px;margin-bottom:12px;">
              ${renderPetPhoto(pet, 'thumb')}
              <div style="flex:1;">
                <div style="font-weight:600;color:#336026;">${emoji} ${esc(pet.name || 'Unknown')}</div>
                <div style="font-size:12px;color:var(--text-secondary);">Owner: ${esc(pet.owner?.name || c.client?.name || 'Unknown')}</div>
                <div style="font-size:11px;margin-top:4px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:4px;"></span>${esc(c.status || 'active')}</div>
              </div>
            </div>
            <button class="btn btn-primary btn-small" style="width:100%;">View Case</button>
          </div>
        `;
      }
      html += '</div></div>';
      return renderLayout(html);
    }

    function renderLayout(content) {
      if (!state.profile) return content;

      const navsByRole = {
        client: [
          { label: 'My Pet', icon: '🐕', action: 'nav-client-dashboard' },
          { label: 'Messages', icon: '💬', action: 'nav-client-case', tab: 'messages' },
          { label: 'Care Plan', icon: '📋', action: 'nav-client-case', tab: 'careplan' },
          { label: 'Knowledge Base', icon: '📚', action: 'nav-knowledge-base' },
          { label: 'Health Timeline', icon: '📊', action: 'nav-health-timeline' },
          { label: 'Referrals', icon: '🎁', action: 'nav-referral-dashboard' },
        ],
        vet_buddy: [
          { label: 'Dashboard', icon: '⭐', action: 'nav-buddy-dashboard' },
          { label: 'Inbox', icon: '📬', action: 'nav-buddy-inbox', badge: state.unreadCount },
          { label: 'Schedule', icon: '📅', action: 'nav-buddy-schedule' },
          { label: 'Templates', icon: '📋', action: 'nav-touchpoint-templates' },
          { label: 'Canned Replies', icon: '💬', action: 'nav-canned-responses' },
          { label: 'Availability', icon: '🏖️', action: 'nav-buddy-availability' },
          { label: 'Resources', icon: '📚', action: 'nav-admin-resources' },
          { label: 'Referrals', icon: '🎁', action: 'nav-referral-dashboard' },
        ],
        admin: [
          { label: 'Dashboard', icon: '📊', action: 'nav-admin-dashboard' },
          { label: 'All Cases', icon: '📁', action: 'nav-admin-cases' },
          { label: 'Message Monitor', icon: '📬', action: 'nav-admin-inbox', badge: state.unreadCount },
          { label: 'Analytics', icon: '📈', action: 'nav-admin-analytics' },
          { label: 'Pipeline', icon: '🚀', action: 'nav-admin-pipeline' },
          { label: 'SLA Monitor', icon: '⏱️', action: 'nav-admin-sla' },
          { label: 'Re-Engagement', icon: '📢', action: 'nav-admin-reengagement' },
          { label: 'Escalations', icon: '🚨', action: 'nav-admin-escalations' },
          { label: 'Schedule', icon: '📅', action: 'nav-admin-schedule' },
          { label: 'Team', icon: '👥', action: 'nav-admin-team' },
          { label: 'Resources', icon: '📚', action: 'nav-admin-resources' },
          { label: 'Audit Log', icon: '📋', action: 'nav-audit-log' },
          { label: 'AI Chats', icon: '🤖', action: 'nav-kb-admin' },
          { label: 'Scorecard', icon: '🏆', action: 'nav-buddy-scorecard' },
          { label: 'Surveys', icon: '⭐', action: 'nav-survey-results' },
        ],
        practice_manager: [
          { label: 'Dashboard', icon: '📊', action: 'nav-admin-dashboard' },
          { label: 'All Cases', icon: '📁', action: 'nav-admin-cases' },
          { label: 'Analytics', icon: '📈', action: 'nav-admin-analytics' },
          { label: 'Pipeline', icon: '🚀', action: 'nav-admin-pipeline' },
          { label: 'Team', icon: '👥', action: 'nav-admin-team' },
        ],
        external_vet: [
          { label: 'My Cases', icon: '📁', action: 'nav-external-dashboard' },
          { label: 'Partner Clinic', icon: '🏥', action: 'nav-partner-clinic-dashboard' },
          { label: 'Knowledge Base', icon: '📚', action: 'nav-knowledge-base' },
        ],
        geneticist: [
          { label: 'Patients', icon: '🧬', action: 'nav-geneticist-dashboard' },
          { label: 'Profile', icon: '👤', action: 'nav-profile' },
        ],
      };

      const navs = navsByRole[state.profile.role] || [];
      let sidebarHtml = '<ul class="sidebar-nav" role="menubar" aria-label="Main navigation">';
      for (const nav of navs) {
        const isActive = nav.action === 'nav-' + state.view.split('-').slice(0, -1).join('-') || state.view.includes(nav.action.split('-')[1]);
        const badgeHtml = nav.badge ? `<span style="margin-left:auto;background:var(--red);color:white;border-radius:10px;font-size:10px;font-weight:700;padding:1px 6px;min-width:14px;text-align:center;" aria-label="${nav.badge} unread">${nav.badge}</span>` : '';
        sidebarHtml += `<li role="none"><a href="#" role="menuitem" class="sidebar-nav-link ${isActive ? 'active' : ''}" data-action="${nav.action}" ${nav.tab ? `data-tab="${nav.tab}"` : ''} ${isActive ? 'aria-current="page"' : ''} style="display:flex;align-items:center;gap:8px;"><span aria-hidden="true">${nav.icon}</span> ${nav.label}${badgeHtml}</a></li>`;
      }
      sidebarHtml += '</ul>';
      sidebarHtml += `
        <div class="sidebar-footer">
          <div class="sidebar-user" data-action="nav-profile" style="cursor:pointer;" title="Edit profile">
            ${renderAvatar(state.profile.avatar_initials, state.profile.avatar_color, 'sm')}
            <div>
              <div class="sidebar-user-name">${esc(state.profile.name)}</div>
              <div class="sidebar-user-role" style="font-size:11px;color:var(--text-secondary);">⚙️ Edit profile</div>
            </div>
          </div>
          <button data-action="signout" style="width:100%;margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:8px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;">Sign Out</button>
        </div>
      `;

      let topbarHtml = `
        <div class="topbar-logo"><svg width="140" height="36" viewBox="0 0 140 36" xmlns="http://www.w3.org/2000/svg"><text x="0" y="25" fill="white" font-size="20" font-weight="700" font-family="Georgia,serif" letter-spacing="0.5">Vet Buddies</text></svg></div>
        <div class="topbar-center">
          <button class="topbar-hamburger" data-action="toggle-sidebar" aria-label="Toggle navigation menu" aria-expanded="${state.sidebarOpen}">☰</button>
        </div>
        <div class="topbar-right">
          <button data-action="toggle-notifications" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;position:relative;padding:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;" title="Notifications">🔔${state.unreadCount > 0 ? `<span style="position:absolute;top:-4px;right:-6px;background:var(--red);color:white;border-radius:10px;font-size:10px;font-weight:700;padding:1px 5px;min-width:14px;text-align:center;">${state.unreadCount}</span>` : ''}</button>
          <div class="role-badge">${state.profile.role === 'admin' ? 'Supervising DVM' : state.profile.role.replace('_', ' ')}</div>
          ${renderAvatar(state.profile.avatar_initials, state.profile.avatar_color, 'sm')}
          <button class="topbar-signout" data-action="signout">Sign Out</button>
        </div>
        ${renderNotificationsPanel()}
      `;

      // Bottom nav items per role (mobile only — max 5)
      const bottomNavByRole = {
        client: [
          { label: 'Home', icon: '🏠', action: 'nav-client-dashboard' },
          { label: 'Messages', icon: '💬', action: 'nav-client-case', tab: 'messages', badge: state.clientUnreadCount || state.unreadCount },
          { label: 'Care Plan', icon: '📋', action: 'nav-client-case', tab: 'careplan' },
          { label: 'Knowledge Base', icon: '📚', action: 'nav-knowledge-base' },
          { label: 'Health Timeline', icon: '📊', action: 'nav-health-timeline' },
          { label: 'Referrals', icon: '🎁', action: 'nav-referral-dashboard' },
        ],
        vet_buddy: [
          { label: 'Dashboard', icon: '⭐', action: 'nav-buddy-dashboard' },
          { label: 'Inbox', icon: '📬', action: 'nav-buddy-inbox', badge: state.unreadCount },
          { label: 'Schedule', icon: '📅', action: 'nav-buddy-schedule' },
        ],
        admin: [
          { label: 'Dashboard', icon: '📊', action: 'nav-admin-dashboard' },
          { label: 'Cases', icon: '📁', action: 'nav-admin-cases' },
          { label: 'Inbox', icon: '📬', action: 'nav-admin-inbox', badge: state.unreadCount },
          { label: 'Team', icon: '👥', action: 'nav-admin-team' },
        ],
        external_vet: [
          { label: 'Cases', icon: '📁', action: 'nav-external-dashboard' },
          { label: 'Clinic', icon: '🏥', action: 'nav-partner-clinic-dashboard' },
        ],
      };

      const bottomNavItems = bottomNavByRole[state.profile.role] || [];
      let bottomNavHtml = '<nav class="bottom-nav" role="navigation" aria-label="Quick navigation">';
      for (const item of bottomNavItems) {
        const isActive = state.view.includes(item.action.replace('nav-', '').replace(/-/g, '-'));
        bottomNavHtml += `
          <button class="bottom-nav-item ${isActive ? 'active' : ''}" data-action="${item.action}" ${item.tab ? `data-tab="${item.tab}"` : ''}>
            <span class="bnav-icon">${item.icon}</span>
            ${item.badge ? `<span class="bnav-badge">${item.badge}</span>` : ''}
            <span class="bnav-label">${item.label}</span>
          </button>`;
      }
      bottomNavHtml += '</nav>';

      return `
        <header class="topbar" role="banner">${topbarHtml}</header>
        <div class="sidebar-backdrop ${state.sidebarOpen ? 'visible' : ''}" data-action="close-sidebar" aria-hidden="true"></div>
        <div class="app-container">
          <nav class="sidebar ${state.sidebarOpen ? 'open' : ''}" role="navigation" aria-label="Main navigation">${sidebarHtml}</nav>
          <main class="main-content" role="main">${content}</main>
        </div>
        ${bottomNavHtml}
      `;
    }


    // ═══ NEW FEATURE RENDER FUNCTIONS ═══
function renderKnowledgeBase() {
  const messages = state.kbMessages || [];

  const messagesHtml = messages.length > 0 ? messages.map(m => {
    const isUser = m.role === 'user';
    return `<div style="display:flex;${isUser ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}margin-bottom:12px;">
      <div style="max-width:80%;padding:12px 16px;border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${isUser ? 'var(--primary)' : 'white'};color:${isUser ? 'white' : 'var(--text)'};border:${isUser ? 'none' : '1px solid var(--border)'};font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">
        ${esc(m.content)}
      </div>
    </div>`;
  }).join('') : `
    <div style="text-align:center;padding:48px 24px;">
      <div style="font-size:48px;margin-bottom:12px;">🐾</div>
      <div style="font-size:18px;font-weight:600;color:#336026;margin-bottom:8px;">Hi! I'm your Vet Buddies assistant.</div>
      <div style="color:var(--text-secondary);line-height:1.6;max-width:400px;margin:0 auto;">Ask me anything about your pet's care, the Vet Buddies service, billing, or how to use the portal.</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:20px;">
        <button class="btn btn-secondary btn-small" data-action="kb-quick-ask" data-q="How does Vet Buddies work?" style="font-size:12px;">How does Vet Buddies work?</button>
        <button class="btn btn-secondary btn-small" data-action="kb-quick-ask" data-q="What's included in my plan?" style="font-size:12px;">What's included in my plan?</button>
        <button class="btn btn-secondary btn-small" data-action="kb-quick-ask" data-q="How do I upload medical records?" style="font-size:12px;">How do I upload records?</button>
      </div>
    </div>`;

  const loadingHtml = state.kbLoading ? `
    <div style="display:flex;justify-content:flex-start;margin-bottom:12px;">
      <div style="max-width:80%;padding:12px 16px;border-radius:16px 16px 16px 4px;background:white;border:1px solid var(--border);font-size:14px;color:var(--text-secondary);">
        <span class="kb-typing">Thinking</span>
      </div>
    </div>` : '';

  return renderLayout(`
    <div style="max-width:700px;margin:0 auto;display:flex;flex-direction:column;height:calc(100vh - 140px);padding:16px 16px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h1 style="font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:var(--dark);margin:0;">Ask Vet Buddies</h1>
          <p style="color:var(--text-secondary);font-size:13px;margin:2px 0 0;">Your AI assistant for pet care questions</p>
        </div>
        ${state.kbConversationId ? `<button class="btn btn-secondary btn-small" data-action="kb-new-chat" style="font-size:12px;">+ New Chat</button>` : ''}
      </div>

      <div id="kb-chat-messages" style="flex:1;overflow-y:auto;padding:8px 0;-webkit-overflow-scrolling:touch;">
        ${messagesHtml}
        ${loadingHtml}
      </div>

      <div style="padding:12px 0;border-top:1px solid var(--border);background:var(--bg-page);">
        <div style="display:flex;gap:8px;">
          <input type="text" id="kb-chat-input" data-field="kb-chat-input" placeholder="Ask a question about your pet's care..." style="flex:1;padding:12px 16px;border:1px solid var(--border);border-radius:24px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;" ${state.kbLoading ? 'disabled' : ''}>
          <button class="btn btn-primary" data-action="kb-send-message" style="border-radius:50%;width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;" ${state.kbLoading ? 'disabled' : ''}>&#x27A4;</button>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:8px;">AI responses are for general guidance. For specific medical advice, message your Vet Buddy.</div>
      </div>
    </div>
    <style>
      .kb-typing::after { content:'...'; animation: kbDots 1.2s infinite; }
      @keyframes kbDots { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} }
    </style>
  `);
}

function renderKbAdmin() {
  // Viewing a specific conversation
  if (state.kbViewingConvId && state._kbAdminMessages) {
    const conv = (state.kbConversations || []).find(c => c.id === state.kbViewingConvId);
    const msgs = state._kbAdminMessages || [];
    const messagesHtml = msgs.map(m => {
      const isUser = m.role === 'user';
      return `<div style="display:flex;${isUser ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}margin-bottom:12px;">
        <div style="max-width:80%;padding:12px 16px;border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${isUser ? '#e8f0e6' : 'white'};border:1px solid var(--border);font-size:14px;line-height:1.6;white-space:pre-wrap;">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">${isUser ? 'User' : 'AI Assistant'}</div>
          ${esc(m.content)}
          <div style="font-size:10px;color:var(--text-secondary);margin-top:6px;text-align:right;">${formatDateTime(m.created_at)}</div>
        </div>
      </div>`;
    }).join('');

    return renderLayout(`
      <div style="max-width:800px;margin:0 auto;padding:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <button class="btn btn-secondary btn-small" data-action="kb-admin-back">← Back</button>
          <div>
            <h1 style="font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:var(--dark);margin:0;">Conversation Log</h1>
            <div style="font-size:12px;color:var(--text-secondary);">${conv ? formatDateTime(conv.created_at) : ''} · ${msgs.length} messages</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;">${messagesHtml}</div>
        ${msgs.length === 0 ? '<div style="text-align:center;color:var(--text-secondary);padding:32px;">No messages in this conversation.</div>' : ''}
      </div>
    `);
  }

  // Conversation list
  const convs = state.kbConversations || [];
  const convsHtml = convs.length > 0 ? convs.map(c => `
    <div class="card" style="padding:14px;cursor:pointer;" data-action="kb-admin-view-conv" data-conv-id="${c.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.title || 'Untitled conversation')}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${formatDateTime(c.created_at)}</div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);flex-shrink:0;margin-left:12px;">View →</div>
      </div>
    </div>
  `).join('') : `
    <div class="empty-state">
      <div class="empty-state-icon">🤖</div>
      <div class="empty-state-title">No conversations yet</div>
      <div class="empty-state-text">Chatbot conversations from users will appear here.</div>
    </div>`;

  return renderLayout(`
    <div style="max-width:800px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:24px;">
        <h1 style="font-family:'Fraunces',serif;font-size:28px;font-weight:700;color:var(--dark);margin-bottom:4px;">AI Chatbot Log</h1>
        <p style="color:var(--text-secondary);font-size:14px;">Anonymous log of questions asked to the AI assistant. User identities are not shown.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${convsHtml}
      </div>
    </div>
  `);
}

function renderAuditLog() {
  const logs = state.auditLogs || [];
  const actionTypes = ['All', 'create', 'update', 'delete', 'view'];
  const entityTypes = ['All', 'case', 'pet', 'user', 'message', 'document'];

  const filteredLogs = logs.filter(log => {
    const matchesAction = !state.auditActionFilter || state.auditActionFilter === 'All' || log.action === state.auditActionFilter;
    const matchesEntity = !state.auditEntityFilter || state.auditEntityFilter === 'All' || log.entity_type === state.auditEntityFilter;
    return matchesAction && matchesEntity;
  });

  const actionColorMap = {
    'create': 'var(--green)',
    'update': 'var(--blue)',
    'delete': 'var(--red)',
    'view': '#999'
  };

  const auditPaged = paginate(filteredLogs, pagination.auditLog, 20);
  const logsTableHtml = auditPaged.items.length > 0 ? auditPaged.items.map(log => `
    <tr class="audit-row">
      <td style="padding: 12px; font-size: 13px; color: #336026;">${formatDateTime(log.created_at)}</td>
      <td style="padding: 12px; font-size: 13px;">
        <span style="font-weight: 600;">${esc(log.user?.name || 'Unknown')}</span>
        <span style="background: ${log.user?.role === 'admin' ? 'var(--admin-accent)' : log.user?.role === 'vet_buddy' ? 'var(--buddy-accent)' : 'var(--client-accent)'}; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${esc(log.user?.role?.replace('_', ' ') || 'User')}</span>
      </td>
      <td style="padding: 12px; font-size: 13px;">
        <span style="background: ${actionColorMap[log.action] || '#ccc'}; color: white; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px;">${log.action}</span>
      </td>
      <td style="padding: 12px; font-size: 13px; color: #336026; text-transform: capitalize;">${log.entity_type || '-'}</td>
      <td style="padding: 12px; font-size: 12px; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis;"><code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 11px;">${esc(JSON.stringify(log.details || {}).substring(0, 100))}...</code></td>
    </tr>
  `).join('') : `
    <tr><td colspan="5" style="padding: 32px; text-align: center; color: var(--text-secondary);">No audit logs found</td></tr>
  `;

  return renderLayout(`
    <div style="padding: 24px;">
      <h1 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: var(--dark); margin-bottom: 20px;">Audit Log</h1>

      <div class="card" style="margin-bottom: 24px;">
        <div style="padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-weight: 600; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Action Type</label>
            <select data-action="filter-audit" data-filter="action" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
              ${actionTypes.map(at => `<option value="${at}" ${state.auditActionFilter === at ? 'selected' : ''}>${at}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-weight: 600; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Entity Type</label>
            <select data-action="filter-audit" data-filter="entity" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
              ${entityTypes.map(et => `<option value="${et}" ${state.auditEntityFilter === et ? 'selected' : ''}>${et}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="overflow-x: auto;">
        <table class="audit-table" style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f9f9f9; border-bottom: 2px solid var(--border);">
            <tr>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #336026;">Time</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #336026;">User</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #336026;">Action</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #336026;">Entity</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #336026;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${logsTableHtml}
          </tbody>
        </table>
        ${renderPagination('auditLog', auditPaged.page, auditPaged.totalPages, auditPaged.total)}
      </div>
    </div>
  `);
}

function renderBuddyScorecard() {
  const buddies = (state.teamMembers || []).filter(m => m.role === 'vet_buddy');

  const scorecardCardsHtml = buddies.length > 0 ? buddies.map(buddy => {
    const gradeNum = buddy.performance_grade?.charCodeAt(0);
    const gradeColorMap = { 'A': '#2ecc71', 'B': '#3498db', 'C': '#f39c12', 'D': '#e74c3c', 'F': '#8B0000' };
    const gradeColor = gradeColorMap[buddy.performance_grade] || '#999';

    return `
      <div class="scorecard card" data-action="view-scorecard-detail" data-buddy-id="${buddy.id}" style="cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px; padding: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          ${renderAvatar(buddy.avatar_initials, buddy.avatar_color, 'md')}
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #336026;">${esc(buddy.name)}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${buddy.role.replace('_', ' ')}</div>
          </div>
          <div style="width: 70px; height: 70px; border-radius: 50%; background: ${gradeColor}; display: flex; align-items: center; justify-content: center; color: white; font-family: 'Fraunces', serif; font-size: 36px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            ${buddy.performance_grade || 'N/A'}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div style="background: #f9f9f9; padding: 8px; border-radius: 6px;">
            <div style="color: var(--text-secondary); font-weight: 500;">Cases</div>
            <div style="font-weight: 700; font-size: 16px; color: #336026;">${buddy.active_cases_count || 0}</div>
          </div>
          <div style="background: #f9f9f9; padding: 8px; border-radius: 6px;">
            <div style="color: var(--text-secondary); font-weight: 500;">Avg Rating</div>
            <div style="font-weight: 700; color: #336026;">⭐ ${buddy.avg_rating || 0}</div>
          </div>
          <div style="background: #f9f9f9; padding: 8px; border-radius: 6px;">
            <div style="color: var(--text-secondary); font-weight: 500;">Msgs/30d</div>
            <div style="font-weight: 700; font-size: 16px; color: #336026;">${buddy.messages_30d || 0}</div>
          </div>
          <div style="background: #f9f9f9; padding: 8px; border-radius: 6px;">
            <div style="color: var(--text-secondary); font-weight: 500;">Escalations</div>
            <div style="font-weight: 700; font-size: 16px; color: #336026;">${buddy.escalations_count || 0}</div>
          </div>
          <div style="grid-column: 1 / -1; background: #f9f9f9; padding: 8px; border-radius: 6px;">
            <div style="color: var(--text-secondary); font-weight: 500; margin-bottom: 4px;">Avg Response Time</div>
            <div style="font-weight: 700; color: #336026;">${buddy.avg_response_time || 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty-state">
      <div class="empty-state-icon">👥</div>
      <div class="empty-state-title">No buddies yet</div>
      <div class="empty-state-text">Team members will appear here once they're added to the system.</div>
    </div>
  `;

  return renderLayout(`
    <div style="padding: 24px;">
      <h1 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">Buddy Scorecard</h1>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">Track performance metrics for your vet buddy team.</p>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${scorecardCardsHtml}
      </div>
    </div>
  `);
}

function renderClientSurveyView() {
  const surveys = state.surveyResponses || [];
  const avgRating = surveys.length > 0 ? (surveys.reduce((sum, s) => sum + (s.rating || 0), 0) / surveys.length).toFixed(1) : 0;
  const responseRate = surveys.length > 0 ? Math.round((surveys.length / (state.totalClients || 1)) * 100) : 0;

  const surveyCardsHtml = surveys.length > 0 ? surveys.map(survey => `
    <div class="card" style="padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <div style="font-weight: 600; color: #336026;">${esc(survey.client?.name || 'Unknown Client')}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            🐾 ${esc(survey.pet?.name || 'Unknown Pet')} · 👥 ${esc(survey.buddy?.name || 'Unknown Buddy')}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 20px;">${'⭐'.repeat(survey.rating || 0)}</div>
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">${survey.rating || 0}/5</div>
        </div>
      </div>
      <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #336026; margin-bottom: 8px; line-height: 1.5;">
        "${esc(survey.feedback || 'No feedback provided')}"
      </div>
      <div style="font-size: 11px; color: var(--text-secondary);">${formatDate(survey.created_at)}</div>
    </div>
  `).join('') : `
    <div class="empty-state">
      <div class="empty-state-icon">⭐</div>
      <div class="empty-state-title">No survey responses yet</div>
      <div class="empty-state-text">Client feedback will appear here once they've completed surveys.</div>
    </div>
  `;

  return renderLayout(`
    <div style="padding: 24px;">
      <h1 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: var(--dark); margin-bottom: 24px;">Client Surveys</h1>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Average Rating</div>
          <div style="font-size: 28px; font-weight: 700; color: #336026;">⭐ ${avgRating}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Total Responses</div>
          <div style="font-size: 28px; font-weight: 700; color: #336026;">${surveys.length}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Response Rate</div>
          <div style="font-size: 28px; font-weight: 700; color: #336026;">${responseRate}%</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${surveyCardsHtml}
      </div>
    </div>
  `);
}

function renderHandoffNotesTab() {
  const handoffs = state.currentCase?.handoffs || [];
  const showForm = state.showHandoffForm || false;

  const handoffCardsHtml = handoffs.length > 0 ? handoffs.map(handoff => `
    <div class="card" style="padding: 16px; border-left: 4px solid var(--primary);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span style="font-weight: 600; color: #336026;">${esc(handoff.from_buddy?.name || 'Unknown')}</span>
          <span style="color: var(--text-secondary);">→</span>
          <span style="font-weight: 600; color: #336026;">${esc(handoff.to_buddy?.name || 'Unknown')}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">${formatDate(handoff.created_at)}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
        <div>
          <div style="font-weight: 600; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Active Issues</div>
          <div style="font-size: 13px; color: #336026; line-height: 1.4;">${esc(handoff.active_issues || 'None noted')}</div>
        </div>
        <div>
          <div style="font-weight: 600; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Watch Items</div>
          <div style="font-size: 13px; color: #336026; line-height: 1.4;">${esc(handoff.watch_items || 'None')}</div>
        </div>
        <div style="grid-column: 1 / -1;">
          <div style="font-weight: 600; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Client Preferences</div>
          <div style="font-size: 13px; color: #336026; line-height: 1.4;">${esc(handoff.client_preferences || 'No preferences noted')}</div>
        </div>
        <div style="grid-column: 1 / -1;">
          <div style="font-weight: 600; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Notes</div>
          <div style="font-size: 13px; color: #336026; line-height: 1.4;">${esc(handoff.notes || 'No additional notes')}</div>
        </div>
      </div>
    </div>
  `).join('') : '';

  const formHtml = showForm ? `
    <div class="card" style="padding: 16px; border: 2px solid var(--primary); margin-bottom: 16px;">
      <h3 style="font-weight: 600; margin-bottom: 12px; color: #336026;">Create New Handoff</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div>
          <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">From Buddy</label>
          <select id="handoff-from" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
            <option>Select buddy</option>
            ${(state.teamMembers || []).filter(m => m.role === 'vet_buddy').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">To Buddy</label>
          <select id="handoff-to" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
            <option>Select buddy</option>
            ${(state.teamMembers || []).filter(m => m.role === 'vet_buddy').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Active Issues</label>
        <textarea id="handoff-issues" placeholder="e.g., Ongoing infection concern, monitor closely" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 60px; font-family: 'DM Sans', sans-serif;"></textarea>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Watch Items</label>
        <textarea id="handoff-watch" placeholder="e.g., Monitor temperature daily for next week" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 60px; font-family: 'DM Sans', sans-serif;"></textarea>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Client Preferences</label>
        <textarea id="handoff-prefs" placeholder="e.g., Prefers email updates, morning call times only" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 60px; font-family: 'DM Sans', sans-serif;"></textarea>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Additional Notes</label>
        <textarea id="handoff-notes" placeholder="Any other important information..." style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 60px; font-family: 'DM Sans', sans-serif;"></textarea>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" data-action="save-handoff">Save Handoff</button>
        <button data-action="toggle-handoff-form" style="padding: 8px 16px; background: white; color: #336026; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
      </div>
    </div>
  ` : `
    <button class="btn-primary" data-action="toggle-handoff-form" style="margin-bottom: 16px;">+ Create Handoff</button>
  `;

  return `
    <div>
      <h3 style="font-weight: 600; color: #336026; margin-bottom: 16px;">Handoff Notes</h3>
      ${formHtml}
      ${handoffCardsHtml || `
        <div class="empty-state" style="padding: 32px;">
          <div class="empty-state-icon">🤝</div>
          <div class="empty-state-title">No handoffs yet</div>
          <div class="empty-state-text">Create a handoff note when transitioning this case to another buddy.</div>
        </div>
      `}
    </div>
  `;
}

function renderReferralDashboard() {
  const referralCode = state.profile?.referral_code || 'CODE123';
  const referrals = state.referrals || [];
  const stats = {
    total: referrals.length,
    converted: referrals.filter(r => r.status === 'converted').length,
    pending: referrals.filter(r => r.status === 'pending').length,
    rewards: state.profile?.referral_rewards || 0
  };

  const referralItemsHtml = referrals.length > 0 ? referrals.map(ref => {
    const statusColor = { 'converted': 'var(--green)', 'pending': 'var(--amber)', 'expired': '#999' };
    return `
      <div class="card" style="padding: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #336026;">${esc(ref.referred_client?.name || 'Unknown')}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${esc(ref.referred_client?.email || '')}</div>
        </div>
        <div style="text-align: right;">
          <span style="background: ${statusColor[ref.status] || '#999'}; color: white; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; text-transform: capitalize;">${ref.status}</span>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${formatDate(ref.created_at)}</div>
        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty-state" style="padding: 32px;">
      <div class="empty-state-icon">🔗</div>
      <div class="empty-state-title">No referrals yet</div>
      <div class="empty-state-text">Share your code to start earning rewards!</div>
    </div>
  `;

  return renderLayout(`
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">Referral Program</h1>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">Invite friends and earn rewards.</p>

      <div class="card referral-code-box" style="padding: 20px; background: linear-gradient(135deg, var(--primary), #336026); color: white; text-align: center; margin-bottom: 24px; border: none;">
        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Your Referral Code</div>
        <div style="font-family: monospace; font-size: 28px; font-weight: 700; margin-bottom: 12px; letter-spacing: 2px;">${referralCode}</div>
        <button class="btn-primary" data-action="copy-referral-code" style="background: white; color: #336026; border: none; margin-right: 8px;">📋 Copy Code</button>
        <button style="background: rgba(255,255,255,0.2); color: white; border: 1px solid white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">🔗 Share Link</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Total Referred</div>
          <div style="font-size: 24px; font-weight: 700; color: #336026;">${stats.total}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Converted</div>
          <div style="font-size: 24px; font-weight: 700; color: var(--green);">${stats.converted}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Pending</div>
          <div style="font-size: 24px; font-weight: 700; color: var(--amber);">${stats.pending}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 6px;">Rewards Earned</div>
          <div style="font-size: 24px; font-weight: 700; color: var(--primary);">$${stats.rewards}</div>
        </div>
      </div>

      <div class="card" style="padding: 16px;">
        <h3 style="font-weight: 600; margin-bottom: 12px; color: #336026;">Referral History</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${referralItemsHtml}
        </div>
      </div>
    </div>
  `);
}

function renderHealthTimeline() {
  const pet = state.activePet;
  const entries = state.healthTimelineEntries || [];

  const entryColorMap = {
    'vaccine': '#2ecc71',
    'vital': '#3498db',
    'medication': '#9b59b6',
    'appointment': '#f39c12'
  };

  const entryIconMap = {
    'vaccine': '💉',
    'vital': '📊',
    'medication': '💊',
    'appointment': '📅'
  };

  const timelineHtml = entries.length > 0 ? entries.map((entry, idx) => `
    <div style="display: flex; gap: 16px; position: relative; padding-bottom: 24px;">
      <div style="display: flex; flex-direction: column; align-items: center; width: 60px; flex-shrink: 0;">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${entryColorMap[entry.type] || '#999'}; border: 3px solid white; box-shadow: 0 0 0 2px ${entryColorMap[entry.type] || '#999'};"></div>
        ${idx < entries.length - 1 ? `<div style="width: 2px; height: 100%; background: var(--border); margin-top: 12px;"></div>` : ''}
      </div>
      <div style="flex: 1; padding-top: 4px;">
        <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 20px;">${entryIconMap[entry.type] || '📋'}</span>
            <span style="font-weight: 600; color: #336026;">${esc(entry.title || entry.type)}</span>
            <span style="background: ${entryColorMap[entry.type] || '#999'}; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: capitalize;">${entry.type}</span>
          </div>
          <div style="font-size: 13px; color: #336026; line-height: 1.5; margin-bottom: 8px;">${esc(entry.description || entry.content || 'No details')}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${formatDate(entry.date || entry.created_at)}</div>
        </div>
      </div>
    </div>
  `).join('') : `
    <div class="empty-state" style="padding: 48px 24px; text-align: center;">
      <div class="empty-state-icon">❤️</div>
      <div class="empty-state-title">Your pet's health journey starts here!</div>
      <div class="empty-state-text">Log vitals, medications, vaccines, and appointments to build a comprehensive health timeline.</div>
    </div>
  `;

  return renderLayout(`
    <div style="max-width: 700px; margin: 0 auto; padding: 24px;">
      <div style="margin-bottom: 28px;">
        <h1 style="font-family: 'Fraunces', serif; font-size: 32px; font-weight: 700; color: var(--dark); margin-bottom: 4px;">Health Timeline</h1>
        <p style="color: var(--text-secondary);">${pet ? `${SPECIES_EMOJI[pet.species?.toLowerCase()] || '🐾'} ${esc(pet.name)}` : 'No pet selected'}</p>
      </div>

      <div class="card" style="padding: 24px;">
        ${timelineHtml}
      </div>
    </div>
  `);
}

function renderLTOCountdownBanner() {
  const remaining = getLTOTimeRemaining();
  if (!remaining) return '';
  return `
    <div class="lto-banner" id="lto-countdown-banner">
      <div class="lto-banner-title">Limited Time Offer</div>
      <div class="lto-banner-subtitle">Lock in your discounted rate — offer ends soon!</div>
      <div class="lto-countdown" id="lto-countdown">
        <div class="lto-countdown-block">
          <div class="lto-countdown-value" id="lto-days">${remaining.days}</div>
          <div class="lto-countdown-label">Days</div>
        </div>
        <div class="lto-countdown-block">
          <div class="lto-countdown-value" id="lto-hours">${String(remaining.hours).padStart(2, '0')}</div>
          <div class="lto-countdown-label">Hours</div>
        </div>
        <div class="lto-countdown-block">
          <div class="lto-countdown-value" id="lto-minutes">${String(remaining.minutes).padStart(2, '0')}</div>
          <div class="lto-countdown-label">Minutes</div>
        </div>
        <div class="lto-countdown-block">
          <div class="lto-countdown-value" id="lto-seconds">${String(remaining.seconds).padStart(2, '0')}</div>
          <div class="lto-countdown-label">Seconds</div>
        </div>
      </div>
    </div>`;
}

// Live-update the LTO countdown every second without full re-render
let _ltoTimerInterval = null;
function startLTOCountdownTimer() {
  if (_ltoTimerInterval) clearInterval(_ltoTimerInterval);
  _ltoTimerInterval = setInterval(() => {
    const remaining = getLTOTimeRemaining();
    const daysEl = document.getElementById('lto-days');
    if (!daysEl) return; // countdown not in DOM
    if (!remaining) {
      clearInterval(_ltoTimerInterval);
      _ltoTimerInterval = null;
      render(); // LTO expired — re-render to remove offer UI
      return;
    }
    daysEl.textContent = remaining.days;
    document.getElementById('lto-hours').textContent = String(remaining.hours).padStart(2, '0');
    document.getElementById('lto-minutes').textContent = String(remaining.minutes).padStart(2, '0');
    document.getElementById('lto-seconds').textContent = String(remaining.seconds).padStart(2, '0');
  }, 1000);
}

function renderPricingModal() {
  const ltoActive = isLTOActive();
  const buddyPricing = getActivePricing('buddy');
  const buddyPlusPricing = getActivePricing('buddy_plus');

  const plans = [
    {
      name: 'Buddy',
      key: 'buddy',
      pricing: buddyPricing,
      priceId: buddyPricing.priceId,
      description: '/month',
      originalPrice: '$99',
      savings: '$79.01',
      features: ['1 check-in per month from your Vet Buddy', 'Digital Living Care Plan', 'Care coordination between vet visits'],
      popular: false
    },
    {
      name: 'Buddy+',
      key: 'buddy_plus',
      pricing: buddyPlusPricing,
      priceId: buddyPlusPricing.priceId,
      description: '/month',
      originalPrice: '$149',
      savings: '$119.01',
      features: ['1 check-in per week from your Vet Buddy', 'Digital Living Care Plan', 'Care coordination between vet visits'],
      popular: true
    },
    {
      name: 'Buddy VIP',
      key: 'buddy_vip',
      pricing: getActivePricing('buddy_vip'),
      priceId: CONFIG.STRIPE_PLANS.buddy_vip,
      description: '/month',
      originalPrice: null,
      savings: null,
      features: ['Weekly check-ins from your Vet Buddy', 'Monthly check-ins from a veterinarian', 'Digital Living Care Plan', 'Care coordination between vet visits'],
      popular: false
    }
  ];

  const ltoCountdownHtml = ltoActive ? renderLTOCountdownBanner() : '';

  const cardsHtml = plans.map(plan => {
    const p = plan.pricing;
    const pricingHtml = p.isLTO
      ? `<div class="lto-badge">Lock in this rate</div>
         <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
           <span class="lto-price-new">${p.price}</span>
           <span style="color: var(--text-secondary); font-size: 13px;">${plan.description}</span>
         </div>
         <div class="lto-price-original">${p.regularPrice}/month</div>
         <div class="lto-savings">Save $${(p.regularAmount - p.amount).toFixed(2)}/mo</div>`
      : `<div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
           <span style="font-size: 32px; font-weight: 700; color: #336026;">${p.price}</span>
           <span style="color: var(--text-secondary); font-size: 13px;">${plan.description}</span>
           ${plan.originalPrice ? `<span style="font-size: 16px; color: #999; text-decoration: line-through;">${plan.originalPrice}</span>` : ''}
         </div>
         ${plan.savings ? `<div style="font-size: 13px; font-weight: 600; color: #d44; margin-bottom: 4px;">Save ${plan.savings}/mo</div>` : ''}`;

    return `
    <div class="card" style="padding: 24px; display: flex; flex-direction: column; position: relative; ${plan.popular ? 'border: 2px solid var(--primary); box-shadow: 0 8px 24px rgba(104, 149, 98, 0.15);' : 'border: 1px solid var(--border);'} ${p.isLTO ? 'border-top: 3px solid #4F152F;' : ''}">
      ${plan.popular ? '<div style="position: absolute; top: -12px; right: 20px; background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;">Most Popular</div>' : ''}

      <div style="margin-bottom: 20px;">
        <h3 style="font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; color: #336026; margin-bottom: 4px;">${plan.name}</h3>
        ${pricingHtml}
      </div>

      <ul style="flex: 1; margin-bottom: 20px; list-style: none;">
        ${plan.features.map(feature => `
          <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; font-size: 13px; color: #336026;">
            <span style="color: var(--primary); font-weight: 700; margin-top: 2px;">✓</span>
            <span>${feature}</span>
          </li>
        `).join('')}
      </ul>

      <button class="btn-primary" data-action="checkout-stripe" data-price-id="${plan.priceId}" style="width: 100%; padding: 12px;">
        ${p.isLTO ? 'Lock In This Rate' : 'Get Started'}
      </button>
      ${p.isLTO ? '<div class="lto-lock-badge" style="justify-content:center;margin-top:8px;">🔒 Rate locked for your subscription</div>' : ''}
    </div>`;
  }).join('');

  return `
    <div class="pricing-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
      <div style="background: white; border-radius: 16px; max-width: 1000px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <div style="padding: 32px 24px; border-bottom: 1px solid var(--border); position: relative;">
          <button data-action="close-pricing" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #336026;">×</button>
          <h2 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: #336026; margin-bottom: 8px;">Choose Your Plan</h2>
          <p style="color: var(--text-secondary);">Pick the perfect Vet Buddies plan for your pet.</p>
        </div>
        <div style="padding: 32px 24px;">
          ${ltoCountdownHtml}
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
            ${cardsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSurveyModal() {
  return `
    <div class="survey-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="card" style="background: white; border-radius: 16px; padding: 40px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <button style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; cursor: pointer; color: #336026;" data-action="close-survey">×</button>

        <h2 style="font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; color: #336026; text-align: center; margin-bottom: 24px;">How was your experience?</h2>

        <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 24px;">
          ${[1, 2, 3, 4, 5].map(rating => `
            <button data-action="set-survey-rating" data-rating="${rating}" style="background: none; border: none; font-size: 32px; cursor: pointer; opacity: 0.4; transition: opacity 0.2s;">⭐</button>
          `).join('')}
        </div>

        <textarea id="survey-feedback" placeholder="Tell us what we could improve..." style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; min-height: 100px; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; resize: vertical;"></textarea>

        <div style="display: flex; gap: 8px;">
          <button class="btn-primary" data-action="submit-survey" style="flex: 1;">Submit</button>
          <button data-action="close-survey" style="flex: 1; padding: 10px; background: white; color: #336026; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function renderLightbox() {
  const image = state.lightboxImage || {};
  const url = image.url || '';
  const title = image.title || 'Image';

  return `
    <div class="lightbox-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1100;" data-action="close-lightbox">
      <button style="position: absolute; top: 20px; right: 20px; background: none; border: none; font-size: 32px; cursor: pointer; color: white;" data-action="close-lightbox">×</button>

      <div style="display: flex; align-items: center; justify-content: center; flex: 1; padding: 40px;">
        <img src="${esc(url)}" alt="${esc(title)}" style="max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 8px;">
      </div>

      <div style="color: white; text-align: center; padding: 20px; font-size: 14px;">
        ${esc(title)}
      </div>
    </div>
  `;
}

function renderDarkModeToggle() {
  const isDark = state.profile?.dark_mode || false;
  return `
    <button data-action="toggle-dark-mode" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 4px 8px;" title="Toggle dark mode">
      ${isDark ? '☀️' : '🌙'}
    </button>
  `;
}

function renderPetSwitcher(pets) {
  if (!pets || pets.length === 0) return '';

  const tabsHtml = pets.map((pet, idx) => {
    const emoji = SPECIES_EMOJI[pet.species?.toLowerCase()] || '🐾';
    const isActive = state.activePetIndex === idx;
    return `
      <button class="pet-tab ${isActive ? 'active' : ''}" data-action="switch-active-pet" data-index="${idx}" style="
        padding: 10px 16px;
        background: ${isActive ? 'var(--primary)' : 'white'};
        color: ${isActive ? 'white' : '#336026'};
        border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
        border-radius: 6px;
        font-weight: ${isActive ? '600' : '500'};
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      ">
        ${emoji} ${esc(pet.name)}
      </button>
    `;
  }).join('');

  return `
    <div style="display: flex; gap: 8px; overflow-x: auto; padding: 12px 0; margin-bottom: 16px;">
      ${tabsHtml}
    </div>
  `;
}

function renderAiReviewModal() {
  if (!state.showAiReviewModal || !state.aiExtractionResult) return '';
  const ext = state.aiExtractionResult;
  const checked = state.aiCheckedItems;

  const docTypeLabels = {
    lab_results: 'Lab Results', exam_notes: 'Exam Notes', vaccination_record: 'Vaccination Record',
    prescription: 'Prescription', surgical_report: 'Surgical Report', radiology: 'Radiology',
    dental: 'Dental', discharge_summary: 'Discharge Summary', referral: 'Referral', other: 'Medical Record'
  };
  const docTypeLabel = docTypeLabels[ext.document_type] || 'Medical Record';

  let itemsHtml = '';

  // Summary section (always shown, not a checkbox)
  if (ext.summary) {
    itemsHtml += `<div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:600;font-size:13px;color:#336026;margin-bottom:6px;">Summary</div>
      <div style="font-size:13px;color:var(--text-primary);line-height:1.5;">${esc(ext.summary)}</div>
    </div>`;
  }

  // Diagnoses
  if (ext.diagnoses?.length > 0) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Diagnoses</div>`;
    ext.diagnoses.forEach((d, i) => {
      const key = 'diag_' + i;
      itemsHtml += `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:${checked[key] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;margin-bottom:4px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="${key}" ${checked[key] ? 'checked' : ''} style="margin-top:2px;width:16px;height:16px;cursor:pointer;">
        <span style="font-size:13px;">${esc(d)}</span>
      </label>`;
    });
    itemsHtml += '</div>';
  }

  // Medications
  if (ext.medications?.length > 0) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">💊 Medications</div>`;
    ext.medications.forEach((m, i) => {
      const key = 'med_' + i;
      const details = [m.dose, m.frequency, m.start_date ? 'from ' + m.start_date : ''].filter(Boolean).join(' · ');
      itemsHtml += `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:${checked[key] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;margin-bottom:4px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="${key}" ${checked[key] ? 'checked' : ''} style="margin-top:2px;width:16px;height:16px;cursor:pointer;">
        <div><div style="font-size:13px;font-weight:500;">${esc(m.name)}</div>${details ? `<div style="font-size:11px;color:var(--text-secondary);">${esc(details)}</div>` : ''}</div>
      </label>`;
    });
    itemsHtml += '</div>';
  }

  // Vaccines
  if (ext.vaccines?.length > 0) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">💉 Vaccines</div>`;
    ext.vaccines.forEach((v, i) => {
      const key = 'vax_' + i;
      const details = [v.administered_date ? 'Given: ' + v.administered_date : '', v.due_date ? 'Due: ' + v.due_date : ''].filter(Boolean).join(' · ');
      itemsHtml += `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:${checked[key] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;margin-bottom:4px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="${key}" ${checked[key] ? 'checked' : ''} style="margin-top:2px;width:16px;height:16px;cursor:pointer;">
        <div><div style="font-size:13px;font-weight:500;">${esc(v.name)}</div>${details ? `<div style="font-size:11px;color:var(--text-secondary);">${esc(details)}</div>` : ''}</div>
      </label>`;
    });
    itemsHtml += '</div>';
  }

  // Vitals
  if (ext.vitals?.weight || ext.vitals?.temperature) {
    const vitalsText = [ext.vitals.weight ? ext.vitals.weight + ' lbs' : '', ext.vitals.temperature ? ext.vitals.temperature + '°F' : ''].filter(Boolean).join(' · ');
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📊 Vitals</div>
      <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${checked['vitals'] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="vitals" ${checked['vitals'] ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
        <span style="font-size:13px;">${esc(vitalsText)}</span>
      </label>
    </div>`;
  }

  // Care Goals
  if (ext.care_goals?.length > 0) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🎯 Care Goals</div>`;
    ext.care_goals.forEach((g, i) => {
      const key = 'goal_' + i;
      itemsHtml += `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:${checked[key] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;margin-bottom:4px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="${key}" ${checked[key] ? 'checked' : ''} style="margin-top:2px;width:16px;height:16px;cursor:pointer;">
        <span style="font-size:13px;">${esc(g)}</span>
      </label>`;
    });
    itemsHtml += '</div>';
  }

  // Pet Profile Additions
  if (ext.pet_profile_additions) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📋 Pet Profile Update</div>
      <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:${checked['profile'] ? 'rgba(42,157,143,0.08)' : '#f9f9f9'};border-radius:6px;cursor:pointer;">
        <input type="checkbox" class="ai-item-check" data-key="profile" ${checked['profile'] ? 'checked' : ''} style="margin-top:2px;width:16px;height:16px;cursor:pointer;">
        <span style="font-size:13px;">${esc(ext.pet_profile_additions)}</span>
      </label>
    </div>`;
  }

  // Recommendations (display-only, not checkboxes)
  if (ext.recommendations?.length > 0) {
    itemsHtml += `<div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Vet Recommendations</div>`;
    ext.recommendations.forEach(r => {
      itemsHtml += `<div style="padding:6px 12px;font-size:13px;color:var(--text-primary);">• ${esc(r)}</div>`;
    });
    itemsHtml += '</div>';
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return `
    <div class="ai-review-overlay" data-action="skip-ai-extraction" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;">
      <div class="ai-review-card" onclick="event.stopPropagation()" style="background:white;border-radius:16px;padding:28px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;">
        <button style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;color:#336026;" data-action="skip-ai-extraction">×</button>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#336026,#689562);display:flex;align-items:center;justify-content:center;font-size:22px;color:white;">🤖</div>
          <div>
            <h2 style="font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:#336026;margin:0;">AI Medical Record Analysis</h2>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${esc(docTypeLabel)}${ext.document_date ? ' — ' + ext.document_date : ''} · ${esc(state.aiExtractionDocName)}</div>
          </div>
        </div>

        ${itemsHtml}

        <div style="display:flex;gap:8px;margin-top:20px;position:sticky;bottom:0;background:white;padding-top:12px;border-top:1px solid var(--border);">
          <button class="btn btn-primary" data-action="apply-ai-extraction" style="flex:1;padding:12px;">${checkedCount > 0 ? `Apply ${checkedCount} Item${checkedCount !== 1 ? 's' : ''} to Care Plan` : 'Nothing Selected'}</button>
          <button class="btn btn-secondary" data-action="skip-ai-extraction" style="flex:0 0 auto;padding:12px 20px;">Skip</button>
        </div>

        <div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">AI-extracted data should be reviewed for accuracy. Powered by Claude.</div>
      </div>
    </div>
  `;
}

function renderNotifSettings() {
  const settings = state.notificationSettings || {};
  const pushSupported = 'Notification' in window;
  const pushPermission = pushSupported ? Notification.permission : 'denied';
  const pushBlocked = pushPermission === 'denied' && pushSupported;

  return `
    <div class="notif-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="card" style="background: white; border-radius: 16px; padding: 32px; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); position: relative;">
        <button style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; cursor: pointer; color: #336026;" data-action="close-notif-settings">×</button>

        <h2 style="font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; color: #336026; margin-bottom: 24px;">Notification Preferences</h2>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: ${pushPermission === 'granted' ? 'rgba(42,157,143,0.08)' : '#f9f9f9'}; border-radius: 8px; ${pushBlocked ? 'opacity:0.6;' : ''}">
            <div>
              <div style="font-weight: 600; color: #336026;">Push notifications</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${pushBlocked ? 'Blocked — enable in browser settings' : pushPermission === 'granted' ? 'Enabled — you\'ll get alerts even when the app is in the background' : 'Get alerts when you have new messages'}</div>
            </div>
            ${pushBlocked
              ? '<input type="checkbox" disabled style="cursor: not-allowed; width: 18px; height: 18px;">'
              : `<input type="checkbox" class="notif-toggle" data-setting="push_enabled" ${settings.push_enabled || pushPermission === 'granted' ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">`}
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <div>
              <div style="font-weight: 600; color: #336026;">Email on new message</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Get notified by email</div>
            </div>
            <input type="checkbox" class="notif-toggle" data-setting="email_messages" ${settings.email_messages ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <div>
              <div style="font-weight: 600; color: #336026;">Email on escalation</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">High-priority alerts</div>
            </div>
            <input type="checkbox" class="notif-toggle" data-setting="email_escalations" ${settings.email_escalations ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: ${settings.sms_enabled ? 'rgba(42,157,143,0.08)' : '#f9f9f9'}; border-radius: 8px;">
            <div>
              <div style="font-weight: 600; color: #336026;">SMS notifications</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Receive text messages for urgent alerts and appointment reminders</div>
              ${settings.sms_enabled ? `<div style="font-size:11px;color:var(--green);margin-top:4px;">Phone: ${esc(settings.sms_phone || '')}</div>` : ''}
            </div>
            <input type="checkbox" class="notif-toggle" data-setting="sms_enabled" ${settings.sms_enabled ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
          </div>
          ${!settings.sms_enabled ? '' : `
          <div style="padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Phone Number</label>
            <input type="tel" data-field="sms-phone" value="${esc(settings.sms_phone || '')}" placeholder="+1 (555) 123-4567" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" aria-label="SMS phone number">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Include country code. Standard message rates may apply.</div>
          </div>`}

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <div>
              <div style="font-weight: 600; color: #336026;">Weekly digest email</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Summary of activity</div>
            </div>
            <input type="checkbox" class="notif-toggle" data-setting="weekly_digest" ${settings.weekly_digest ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
          </div>

          <div style="padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <div style="font-weight: 600; color: #336026; margin-bottom: 4px;">Quiet hours</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Suppress sounds and push notifications during these hours. Urgent messages always get through.</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="time" data-field="quiet-hours-start" value="${esc(settings.quiet_hours_start || '')}" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" aria-label="Quiet hours start">
              <span style="color:var(--text-secondary);font-size:13px;">to</span>
              <input type="time" data-field="quiet-hours-end" value="${esc(settings.quiet_hours_end || '')}" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;" aria-label="Quiet hours end">
              ${settings.quiet_hours_start && settings.quiet_hours_end ? `<span style="font-size:11px;color:var(--green);margin-left:4px;">Active</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 24px;">
          <button class="btn-primary" data-action="save-notif-settings" style="flex: 1;">Save Preferences</button>
          <button data-action="close-notif-settings" style="flex: 1; padding: 10px; background: white; color: #336026; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function render2FASetup() {
  const is2FAEnabled = state.profile?.two_factor_enabled || false;

  const content = is2FAEnabled ? `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <div style="font-weight: 600; color: var(--green); margin-bottom: 16px;">Two-Factor Authentication Enabled</div>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Your account is protected with 2FA.</p>
      <button data-action="disable-2fa" style="background: var(--red); color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">Disable 2FA</button>
    </div>
  ` : `
    <div style="padding: 20px;">
      <h3 style="font-weight: 600; color: #336026; margin-bottom: 12px;">Set up Two-Factor Authentication</h3>
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">Add an extra layer of security to your account with a one-time password from an authenticator app.</p>

      <div style="background: #f9f9f9; border: 1px solid var(--border); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 80px; margin-bottom: 8px;">📱</div>
        <div style="color: var(--text-secondary); font-size: 12px;">2FA setup will generate a QR code here</div>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Enter verification code</label>
        <input type="text" id="2fa-code" placeholder="000000" maxlength="6" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 18px; text-align: center; letter-spacing: 4px;" />
      </div>

      <button data-action="enable-2fa" class="btn-primary" style="width: 100%; margin-bottom: 8px;">Enable 2FA</button>
    </div>
  `;

  return `
    <div class="two-fa-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="card" style="background: white; border-radius: 16px; max-width: 420px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; color: #336026;">Two-Factor Auth</h2>
          <button style="background: none; border: none; font-size: 24px; cursor: pointer; color: #336026;" data-action="close-2fa">×</button>
        </div>
        ${content}
      </div>
    </div>
  `;
}

function renderPartnerClinicDashboard() {
  const cases = state.cases || [];
  const activeCases = cases.filter(c => c.status !== 'closed');
  const stats = {
    sharedCases: cases.length,
    activeCases: activeCases.length,
    pendingReviews: cases.filter(c => c.pending_review).length,
  };

  // Case selector options for visit summary form
  const caseOptions = cases.map(c => {
    const pet = c.pets || {};
    return `<option value="${c.id}">${esc(pet.name || 'Unknown')} — ${esc(c.client?.name || 'Unknown Client')}</option>`;
  }).join('');

  // Care plan display for currently selected case
  let carePlanHtml = '';
  if (state.carePlan?.content) {
    const cp = typeof state.carePlan.content === 'string' ? JSON.parse(state.carePlan.content) : state.carePlan.content;
    const goals = cp.active_care_goals || [];
    const milestones = cp.milestones || [];
    carePlanHtml = `
      ${goals.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-weight:600;font-size:13px;margin-bottom:8px;">Active Care Goals</div>
        ${goals.map(g => `<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:6px;font-size:13px;">
          <div style="font-weight:500;">${esc(g.title || g.goal || '')}</div>
          ${g.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${esc(g.notes)}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}
      ${milestones.length > 0 ? `<div><div style="font-weight:600;font-size:13px;margin-bottom:8px;">Milestones</div>
        ${milestones.map(m => `<div style="padding:6px 12px;font-size:13px;color:var(--text-secondary);">✅ ${esc(m.title || m.text || '')}</div>`).join('')}
      </div>` : ''}
      ${goals.length === 0 && milestones.length === 0 ? '<p style="color:var(--text-secondary);font-size:13px;">No care plan details available for this case.</p>' : ''}
    `;
  } else {
    carePlanHtml = '<p style="color:var(--text-secondary);font-size:13px;line-height:1.5;">Select a case below to view its care plan, or no care plan has been created yet.</p>';
  }

  const caseCardsHtml = cases.length > 0 ? cases.map(c => {
    const pet = c.pets || {};
    const emoji = SPECIES_EMOJI[pet.species?.toLowerCase()] || '🐾';
    const statusColor = c.status === 'active' ? 'var(--green)' : c.status === 'closed' ? '#999' : 'var(--amber)';
    return `
      <div class="card" style="padding: 16px; cursor: pointer; transition: all 0.2s;" data-action="view-case-detail" data-case-id="${c.id}">
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          ${renderPetPhoto(pet, 'thumb')}
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #336026;">${emoji} ${esc(pet.name) || 'Unknown'}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${esc(c.client?.name) || 'Unknown Client'}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:4px;"></span>${esc(c.status) || 'Active'}</div>
          </div>
          ${c.pending_review ? '<span style="background: var(--amber); color: white; font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 4px;">Review Pending</span>' : ''}
        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty-state" style="padding: 32px;">
      <div class="empty-state-icon">🏥</div>
      <div class="empty-state-title">No shared cases yet</div>
      <div class="empty-state-text">Cases will appear here once they're shared with your clinic.</div>
    </div>
  `;

  return renderLayout(`
    <div style="padding: 24px;">
      <h1 style="font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; color: var(--dark); margin-bottom: 24px;">Partner Clinic Dashboard</h1>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Cases Shared</div>
          <div style="font-size: 28px; font-weight: 700; color: #336026;">${stats.sharedCases}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Active</div>
          <div style="font-size: 28px; font-weight: 700; color: var(--green);">${stats.activeCases}</div>
        </div>
        <div class="card" style="padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Pending Reviews</div>
          <div style="font-size: 28px; font-weight: 700; color: var(--amber);">${stats.pendingReviews}</div>
        </div>
      </div>

      <div class="card" style="padding: 16px; margin-bottom: 24px;">
        <h3 style="font-weight: 600; color: #336026; margin-bottom: 12px;">Push Visit Summary</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Select Case</label>
            <select id="visit-case-id" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: 'DM Sans', sans-serif;">
              <option value="">— Select a patient —</option>
              ${caseOptions}
            </select>
          </div>
          <div>
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Visit Date</label>
            <input type="date" id="visit-date" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Visit Type</label>
            <select id="visit-type" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: 'DM Sans', sans-serif;">
              <option value="wellness">Wellness Check</option>
              <option value="sick">Sick Visit</option>
              <option value="followup">Follow-Up</option>
              <option value="emergency">Emergency</option>
              <option value="surgery">Surgery / Procedure</option>
              <option value="dental">Dental</option>
              <option value="vaccination">Vaccination</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Summary</label>
            <textarea id="visit-summary" placeholder="Briefly summarize the visit findings and diagnosis..." style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 80px; font-family: 'DM Sans', sans-serif;"></textarea>
          </div>
          <div>
            <label style="font-weight: 500; font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Recommendations</label>
            <textarea id="visit-recommendations" placeholder="Any recommendations, follow-ups, or medication changes..." style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; min-height: 80px; font-family: 'DM Sans', sans-serif;"></textarea>
          </div>
          <button class="btn-primary" data-action="push-visit-summary" style="padding:10px 20px;">Submit Visit Summary</button>
        </div>
      </div>

      <div class="card" style="padding: 16px; margin-bottom: 24px;">
        <h3 style="font-weight: 600; color: #336026; margin-bottom: 12px;">Living Care Plan (Read-Only)</h3>
        ${carePlanHtml}
      </div>

      <h2 style="font-weight: 600; color: #336026; margin-bottom: 12px;">Shared Cases</h2>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${caseCardsHtml}
      </div>
    </div>
  `);
}

function renderMedRefillAlerts(medications) {
  if (!medications || medications.length === 0) return '';

  const alertsHtml = medications.map(med => {
    const daysUntil = med.days_until_refill || 0;
    let severity = 'amber';
    if (daysUntil < 0) severity = 'red';
    if (daysUntil > 7) return '';

    const severityColor = severity === 'red' ? 'var(--red)' : 'var(--amber)';
    const icon = severity === 'red' ? '⚠️' : '⏰';

    return `
      <div style="background: ${severityColor}; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span style="font-size: 18px;">${icon}</span>
          <div>
            <div style="font-weight: 600;">${esc(med.name)}</div>
            <div style="font-size: 12px; opacity: 0.9;">${esc(med.dosage) || ''} · ${daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : daysUntil + ' days left'}</div>
          </div>
        </div>
        <button data-action="dismiss-refill-alert" data-med-id="${med.id}" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 12px;">✕</button>
      </div>
    `;
  }).filter(Boolean).join('');

  return alertsHtml || '';
}

function renderVaccineDueAlerts(vaccines) {
  if (!vaccines || vaccines.length === 0) return '';

  const alertsHtml = vaccines.map(vaccine => {
    const dueDate = new Date(vaccine.due_date);
    const today = new Date();
    const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntil > 30 && daysUntil > 0) return '';

    let severity = 'amber';
    if (daysUntil < 0) severity = 'red';

    const severityColor = severity === 'red' ? 'var(--red)' : 'var(--amber)';
    const icon = severity === 'red' ? '⚠️' : '💉';

    return `
      <div style="background: ${severityColor}; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 18px;">${icon}</span>
          <div>
            <div style="font-weight: 600;">${esc(vaccine.name)}</div>
            <div style="font-size: 12px; opacity: 0.9;">Due: ${formatDate(vaccine.due_date)} · ${daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : 'Due in ' + daysUntil + ' days'}</div>
          </div>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  return alertsHtml || '';
}

    // ── Co-Owner Render Functions ──────────────────────────
    function renderCoOwnerSection(petId) {
      const pet = state.currentCase?.pets;
      const isOwner = pet && pet.owner_id === state.profile.id;
      const isCoOwner = state.petCoOwners.some(co => co.user_id === state.profile.id && co.status === 'accepted');
      const canManage = isOwner || isCoOwner || state.profile.role === 'admin';

      let html = '<div class="co-owner-section"><h3>👥 Pet Owners</h3>';
      html += '<div class="co-owner-list">';

      // Show primary owner
      if (pet?.owner) {
        const initials = (pet.owner.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        html += `<div class="co-owner-item">
          <div class="co-owner-info">
            <div class="co-owner-avatar">${initials}</div>
            <div><div class="co-owner-name">${esc(pet.owner.name) || 'Unknown'}</div></div>
          </div>
          <span class="co-owner-badge owner">Primary Owner</span>
        </div>`;
      }

      // Show co-owners
      for (const co of state.petCoOwners) {
        const name = co.user?.name || co.invited_email;
        const initials = (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const statusBadge = co.status === 'accepted'
          ? '<span class="co-owner-badge accepted">Co-Owner</span>'
          : '<span class="co-owner-badge pending">Pending</span>';
        const removeBtn = canManage ? `<button class="btn-ghost" data-action="remove-co-owner" data-co-owner-id="${co.id}" style="font-size:12px; color:#ef4444; padding:4px 8px;">Remove</button>` : '';
        html += `<div class="co-owner-item">
          <div class="co-owner-info">
            <div class="co-owner-avatar">${initials}</div>
            <div>
              <div class="co-owner-name">${esc(name)}</div>
              ${co.user?.name ? '<div class="co-owner-email">' + esc(co.invited_email) + '</div>' : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${statusBadge}
            ${removeBtn}
          </div>
        </div>`;
      }
      html += '</div>';

      // Invite form (if user can manage)
      if (canManage) {
        html += `<div class="co-owner-invite-form">
          <input type="email" id="co-owner-email-input" placeholder="Enter email to invite co-owner..." value="${esc(state.coOwnerInviteEmail) || ''}">
          <button class="btn-primary" data-action="send-co-owner-invite" data-pet-id="${petId}" style="padding:8px 16px; font-size:13px;">Invite</button>
        </div>`;
      }

      html += '</div>';
      return html;
    }

    function renderPendingCoOwnerInvites() {
      if (!state.pendingCoOwnerInvites || state.pendingCoOwnerInvites.length === 0) return '';
      let html = '';
      for (const inv of state.pendingCoOwnerInvites) {
        const petName = inv.pet?.name || 'a pet';
        const petSpecies = inv.pet?.species || '';
        const inviterName = inv.inviter?.name || 'Someone';
        html += `<div class="co-owner-invite-banner">
          <h4>🐾 You've been invited as a co-owner!</h4>
          <p style="margin:0; font-size:14px; color:#4b5563;">
            <strong>${esc(inviterName)}</strong> invited you to co-own <strong>${esc(petName)}</strong>${petSpecies ? ' (' + esc(petSpecies) + ')' : ''}.
            You'll have full access to their care plan, messages, and appointments.
          </p>
          <div class="invite-actions">
            <button class="btn-primary" data-action="accept-co-owner-invite" data-invite-id="${inv.id}" style="padding:8px 16px; font-size:13px;">Accept</button>
            <button class="btn-secondary" data-action="decline-co-owner-invite" data-invite-id="${inv.id}" style="padding:8px 16px; font-size:13px;">Decline</button>
          </div>
        </div>`;
      }
      return html;
    }

    function render() {
      const app = document.getElementById('app');
      let html = '';

      // Auth screens always take priority regardless of user state
      if (state.view === 'signup') {
        html = renderSignup();
        app.innerHTML = html;
        return;
      }
      if (state.view === 'login' || !state.user) {
        html = renderLogin();
        app.innerHTML = html;
        return;
      }

      // Role gate: redirect to correct home if view doesn't match role
      const role = state.profile?.role;
      const isAdminView = state.view.startsWith('admin-') || state.view === 'audit-log' || state.view === 'buddy-scorecard' || state.view === 'survey-results' || state.view === 'kb-admin';
      const isBuddyView = state.view.startsWith('buddy-') || state.view === 'touchpoint-templates' || state.view === 'canned-responses' || state.view === 'buddy-availability';
      if (isAdminView && role !== 'admin' && role !== 'practice_manager') {
        navigate(role === 'client' ? 'client-dashboard' : role === 'vet_buddy' ? 'buddy-dashboard' : 'login');
        app.innerHTML = '';
        return;
      }
      if (isBuddyView && role !== 'vet_buddy' && role !== 'admin') {
        navigate(role === 'client' ? 'client-dashboard' : 'login');
        app.innerHTML = '';
        return;
      }

      {
        switch (state.view) {
          case 'client-dashboard':
            html = renderClientDashboard();
            break;
          case 'add-pet':
            html = renderAddPetForm();
            break;
          case 'client-case':
            html = renderBuddyCase();
            break;
          case 'buddy-dashboard':
            html = renderBuddyDashboard();
            break;
          case 'buddy-inbox':
            html = renderBuddyInbox();
            break;
          case 'buddy-case':
            html = renderBuddyCase();
            break;
          case 'admin-dashboard':
            html = renderAdminDashboard();
            break;
          case 'admin-cases':
            html = renderAdminCases();
            break;
          case 'admin-inbox':
            html = renderAdminInbox();
            break;
          case 'admin-escalations':
            html = renderAdminEscalations();
            break;
          case 'admin-schedule':
            html = renderAdminSchedule();
            break;
          case 'admin-team':
            html = renderAdminTeam();
            break;
          case 'admin-resources':
            html = renderAdminResources();
            break;
          case 'external-dashboard':
            html = renderExternalDashboard();
            break;
          case 'external-case':
            html = renderBuddyCase();
            break;
          case 'geneticist-dashboard':
            html = renderGeneticistDashboard();
            break;
          case 'geneticist-case':
            html = renderGeneticistCase();
            break;
          case 'profile-settings':
            html = renderProfileSettings();
            break;
          case 'onboarding':
            html = renderOnboarding();
            break;
          case 'login':
            html = renderLogin();
            break;
          case 'signup':
            html = renderSignup();
            break;
          // ── NEW VIEWS ──────────────────────────────────────
          case 'health-summary':
            html = renderHealthSummary();
            break;
          case 'referral':
            html = renderReferralPage();
            break;
          case 'care-team-invite':
            html = renderCareTeamInviteLanding();
            break;
          case 'buddy-availability':
            html = renderBuddyAvailabilityPage();
            break;
          case 'canned-responses':
            html = renderCannedResponsesPage();
            break;
          case 'touchpoint-templates':
            html = renderTouchpointTemplatesPage();
            break;
          case 'admin-analytics':
            html = renderAdminAnalytics();
            break;
          case 'admin-pipeline':
            html = renderOnboardingPipeline();
            break;
          case 'admin-sla':
            html = renderSLATracker();
            break;
          case 'admin-reengagement':
            html = renderReEngagementAlerts();
            break;
          case 'admin-create-case':
            html = renderAdminCaseCreation();
            break;
          case 'knowledge-base':
            if (state._kbLoaded || state.kbLoading) {
              html = renderKnowledgeBase();
            } else {
              state._kbLoaded = true;
              loadKbConversation().then(function(){ app.innerHTML = renderKnowledgeBase(); attachEventListeners(); scrollKbToBottom(); });
              app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
              attachEventListeners(); return;
            }
            break;
          case 'kb-admin':
            loadKbAdminConversations().then(function(){ app.innerHTML = renderKbAdmin(); attachEventListeners(); });
            app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
            attachEventListeners(); return;
          case 'audit-log':
            loadAuditLog().then(function(){ state.auditLogs = state.auditLog; app.innerHTML = renderAuditLog(); attachEventListeners(); });
            app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
            attachEventListeners(); return;
          case 'buddy-scorecard':
            html = renderBuddyScorecard();
            break;
          case 'survey-results':
            loadAllSurveys().then(function(){ app.innerHTML = renderClientSurveyView(); attachEventListeners(); });
            app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
            attachEventListeners(); return;
          case 'referral-dashboard':
            ensureReferralCode().then(function(){ return loadReferralStats(); }).then(function(){ app.innerHTML = renderReferralDashboard(); attachEventListeners(); });
            app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
            attachEventListeners(); return;
          case 'health-timeline':
            if (state.cases.length > 0) {
              var htPet = state.cases[state.activePetIndex]?.pets;
              if (htPet) loadHealthTimeline(htPet.id).then(function(){ app.innerHTML = renderHealthTimeline(); attachEventListeners(); });
            }
            app.innerHTML = renderLayout('<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>');
            attachEventListeners(); return;
          case 'partner-clinic-dashboard':
            html = renderPartnerClinicDashboard();
            break;
          default:
            html = '<div class="empty-state"><div class="empty-state-text">Unknown view</div></div>';
        }
      }

      app.innerHTML = html;

      // ── Post-render hooks ──────────────────────────────────
      // LTO countdown timer — start ticking if countdown is visible
      if (document.getElementById('lto-countdown-banner')) {
        startLTOCountdownTimer();
      }
      // Chart.js — destroy existing instances before recreating to prevent memory leaks
      if (!window._chartInstances) window._chartInstances = {};
      function createChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        if (window._chartInstances[canvasId]) {
          window._chartInstances[canvasId].destroy();
          delete window._chartInstances[canvasId];
        }
        const chart = new Chart(canvas, config);
        window._chartInstances[canvasId] = chart;
        return chart;
      }

      // Chart.js — load on demand, then render charts
      if (document.getElementById('vitals-chart') || document.getElementById('signups-chart') || document.getElementById('tiers-chart')) {
        ensureChartJS().then(() => {
          if (document.getElementById('vitals-chart') && state.petVitals.length >= 2) {
            const pts = state.petVitals.filter(v => v.weight).slice(0, 10).reverse();
            createChart('vitals-chart', { type: 'line', data: { labels: pts.map(v => formatDate(v.recorded_at)), datasets: [{ label: 'Weight', data: pts.map(v => parseFloat(v.weight) || 0), borderColor: '#689562', tension: 0.3, fill: false }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } }, responsive: true, maintainAspectRatio: false }});
          }
          if (document.getElementById('signups-chart') && state.analyticsData) {
            const d = state.analyticsData;
            const weekBuckets = {};
            for (const u of d.recentSignups || []) { const w = new Date(u.created_at); w.setDate(w.getDate() - w.getDay()); const k = w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); weekBuckets[k] = (weekBuckets[k] || 0) + 1; }
            const wl = Object.keys(weekBuckets).slice(-8);
            createChart('signups-chart', { type: 'bar', data: { labels: wl, datasets: [{ label: 'Signups', data: wl.map(k => weekBuckets[k]), backgroundColor: '#689562' }] }, options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }});
          }
          if (document.getElementById('tiers-chart')) {
            const tierCounts = {}; for (const c of state.cases) { const t = c.subscription_tier || 'None'; tierCounts[t] = (tierCounts[t] || 0) + 1; }
            createChart('tiers-chart', { type: 'doughnut', data: { labels: Object.keys(tierCounts), datasets: [{ data: Object.values(tierCounts), backgroundColor: ['#689562','#336026','#2ecc71','#3498db','#f39c12'] }] }, options: { responsive: true, maintainAspectRatio: false }});
          }
        }).catch(err => console.warn('Chart.js load failed:', err));
      }

      // Typing indicator — broadcast presence on input in chat
      const _typingInput = document.querySelector('[data-field="message-input"]');
      if (_typingInput && state.realtimeChannel) {
        _typingInput.addEventListener('input', () => {
          sendTypingPresence(true);
          clearTimeout(state._typingTimeout);
          state._typingTimeout = setTimeout(() => sendTypingPresence(false), 3000);
        });
      }

      // KB chat — scroll to bottom after re-render
      if (state.view === 'knowledge-base') { scrollKbToBottom(); }

      // Show billing success toast once after Stripe redirect
      if (state._billingSuccessToast && state.profile) {
        delete state._billingSuccessToast;
        setTimeout(() => showToast('🎉 Subscription activated! Welcome aboard.', 'success'), 300);
      }

      // PWA install prompt — cross-browser (throttled: once per session, max once per 7 days)
      const _pwaDismissedSession = sessionStorage.getItem('pwa-dismissed');
      const _pwaDismissedDate = localStorage.getItem('pwa-dismissed-date');
      const _pwaWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const _pwaThrottled = _pwaDismissedDate && parseInt(_pwaDismissedDate) > _pwaWeekAgo;
      if (state.profile && !_pwaDismissedSession && !_pwaThrottled && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
        const banner = document.getElementById('pwa-banner');
        if (!banner) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          const isSafariDesktop = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !isIOS;
          const hasNativePrompt = !!state.pwaInstallPrompt;

          let bannerHTML = '';
          if (hasNativePrompt) {
            // Chrome, Edge, Opera, Samsung Internet — native install
            bannerHTML = `<span style="font-size:24px;">🐾</span><div class="pwa-banner-text"><strong>Install Vet Buddies</strong>Get quick access from your home screen</div><button class="btn btn-primary btn-small" id="pwa-install-btn">Install</button><button class="btn btn-secondary btn-small" id="pwa-dismiss-btn">\u2715</button>`;
          } else if (isIOS) {
            // iOS Safari — share sheet instructions
            bannerHTML = `<span style="font-size:24px;">🐾</span><div class="pwa-banner-text"><strong>Install Vet Buddies</strong>Tap <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin:0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then <strong>"Add to Home Screen"</strong></div><button class="btn btn-secondary btn-small" id="pwa-dismiss-btn">\u2715</button>`;
          } else if (isSafariDesktop) {
            // macOS Safari 17+ — File > Add to Dock
            bannerHTML = `<span style="font-size:24px;">🐾</span><div class="pwa-banner-text"><strong>Install Vet Buddies</strong>Go to <strong>File \u2192 Add to Dock</strong> to install</div><button class="btn btn-secondary btn-small" id="pwa-dismiss-btn">\u2715</button>`;
          } else {
            // Firefox or other — generic add-to-homescreen
            bannerHTML = `<span style="font-size:24px;">🐾</span><div class="pwa-banner-text"><strong>Install Vet Buddies</strong>Open your browser menu and choose <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong></div><button class="btn btn-secondary btn-small" id="pwa-dismiss-btn">\u2715</button>`;
          }

          const b = document.createElement('div');
          b.id = 'pwa-banner'; b.className = 'pwa-banner';
          b.innerHTML = bannerHTML;
          document.body.appendChild(b);
          document.getElementById('pwa-install-btn')?.addEventListener('click', () => { state.pwaInstallPrompt.prompt(); state.pwaInstallPrompt = null; b.remove(); });
          document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('pwa-dismissed-date', Date.now().toString()); b.remove(); });
        }
      }

      // Scope guardrail — trigger word detection for Buddy compose area
      if (state.profile?.role === 'vet_buddy') {
        const msgInput = document.querySelector('[data-field="message-input"]');
        const scopeWarning = document.getElementById('scope-warning');
        if (msgInput && scopeWarning) {
          msgInput.addEventListener('input', () => {
            const triggerWords = /\b(diagnos[ei]s?|prescri(?:be|ption)|medication|mg|dose|dosage)\b/i;
            scopeWarning.style.display = triggerWords.test(msgInput.value) ? 'block' : 'none';
          });
        }
      }
      // Modal overlays
      setTimeout(function(){var mh='';
        if(state.showLightbox&&typeof renderLightbox==='function')mh+=renderLightbox();
        if(state.showSurvey&&typeof renderSurveyModal==='function')mh+=renderSurveyModal();
        if(state.showPricingModal&&typeof renderPricingModal==='function')mh+=renderPricingModal();
        if(state.showNotifSettings&&typeof renderNotifSettings==='function')mh+=renderNotifSettings();
        if(state.show2FA&&typeof render2FASetup==='function')mh+=render2FASetup();
        if(state.showAiReviewModal&&typeof renderAiReviewModal==='function')mh+=renderAiReviewModal();
        if(state.showPushPromptBanner)mh+=`<div style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:1100;background:linear-gradient(135deg,#336026,#689562);color:white;border-radius:12px;padding:14px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.2);display:flex;align-items:center;gap:12px;max-width:480px;width:90%;animation:notifSlideIn 0.3s ease-out;"><span style="font-size:20px;">🔔</span><div style="flex:1;"><div style="font-weight:600;font-size:14px;">Your Buddy just sent a message!</div><div style="font-size:12px;opacity:0.9;margin-top:2px;">Enable notifications so you never miss one.</div></div><button data-action="enable-push-from-toast" style="background:white;color:#336026;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Enable</button><button data-action="dismiss-push-toast" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:18px;cursor:pointer;padding:0 4px;">×</button></div>`;
        if(state._showPasswordReset)mh+=`<div class="broadcast-overlay" data-action="close-password-reset"><div class="broadcast-card" onclick="event.stopPropagation()" style="max-width:400px;"><div style="font-family:'Fraunces',serif;font-size:18px;font-weight:600;margin-bottom:16px;">🔒 Set New Password</div><div class="form-group"><label>New Password</label><input type="password" data-field="reset-new-password" placeholder="Enter new password (min 6 characters)" style="width:100%;"></div><div class="form-group"><label>Confirm Password</label><input type="password" data-field="reset-confirm-password" placeholder="Confirm new password" style="width:100%;"></div><div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-primary" data-action="save-new-password" style="flex:1;">Update Password</button><button class="btn btn-secondary" data-action="close-password-reset">Cancel</button></div></div></div>`;
        var mc=document.getElementById('modal-overlay-container');if(mc)mc.remove();
        if(mh){var c=document.createElement('div');c.id='modal-overlay-container';c.innerHTML=mh;document.body.appendChild(c);}
      },50);
    }

    let listenersAttached = false;
    function attachEventListeners() {
      if (listenersAttached) return;
      listenersAttached = true;
      document.addEventListener('click', async e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        // Forms (signin, signup) are handled by the submit event listener below.
        // If we called e.preventDefault() here it would swallow the submit event.
        if (target.tagName === 'FORM') return;
        e.preventDefault();

        const action = target.dataset.action;

        // Auto-close sidebar on mobile when any nav action fires
        if (action && action.startsWith('nav-') && window.innerWidth <= 768) {
          state.sidebarOpen = false;
        }

        // ═══ NEW FEATURE INLINE ACTIONS (before switch) ═══
        if (action === 'toggle-dark-mode') { toggleDarkMode(); return; }
        if (action === 'toggle-faq') { var aid=target.dataset.articleId; var ael=document.querySelector('.kb-article[data-article-id="'+aid+'"]'); if(ael){var ac=ael.querySelector('.kb-article-content');var ai=ael.querySelector('.kb-toggle-icon');if(ac)ac.style.display=ac.style.display==='none'?'block':'none';if(ai)ai.textContent=ac&&ac.style.display==='none'?'+':'\u2212';} return; }
        if (action === 'filter-faq-category') { state.faqCategory=target.dataset.category||'All'; render(); return; }
        if (action === 'kb-send-message') {
          const input = document.getElementById('kb-chat-input');
          if (input && input.value.trim()) { sendKbMessage(input.value); input.value = ''; }
          return;
        }
        if (action === 'kb-quick-ask') {
          const q = target.dataset.q;
          if (q) sendKbMessage(q);
          return;
        }
        if (action === 'kb-new-chat') {
          state.kbConversationId = null;
          state.kbMessages = [];
          state._kbLoaded = true;
          render();
          return;
        }
        if (action === 'kb-admin-view-conv') {
          const convId = target.dataset.convId;
          if (convId) {
            state.kbViewingConvId = convId;
            loadKbConversationMessages(convId).then(msgs => {
              state._kbAdminMessages = msgs;
              render();
            });
          }
          return;
        }
        if (action === 'kb-admin-back') {
          state.kbViewingConvId = null;
          state._kbAdminMessages = null;
          render();
          return;
        }
        if (action === 'open-lightbox') { state.showLightbox=true;state.lightboxUrl=target.dataset.url||'';state.lightboxTitle=target.dataset.title||'';var mc=document.getElementById('modal-overlay-container');if(mc)mc.remove();if(typeof renderLightbox==='function'){var c=document.createElement('div');c.id='modal-overlay-container';c.innerHTML=renderLightbox();document.body.appendChild(c);}return; }
        if (action === 'close-lightbox') { state.showLightbox=false;var mc=document.getElementById('modal-overlay-container');if(mc)mc.remove();return; }
        if (action === 'show-survey') { state.showSurvey=true;state.surveyRating=0;render();return; }
        if (action === 'set-survey-rating') { state.surveyRating=parseInt(target.dataset.rating||'0');document.querySelectorAll('.survey-star').forEach(function(s){s.textContent=parseInt(s.dataset.rating)<=state.surveyRating?'\u2605':'\u2606';s.style.color=parseInt(s.dataset.rating)<=state.surveyRating?'#f39c12':'#ccc';});return; }
        if (action === 'submit-survey') { var fb=document.querySelector('[data-field="survey-feedback"]')?.value||'';if(!state.surveyRating){showToast('Please select a rating','error');return;}saveSurvey(state.caseId,state.currentCase?.assigned_buddy_id,state.surveyRating,fb).then(function(){state.showSurvey=false;showToast('Thank you for your feedback!','success');render();});return; }
        if (action === 'close-survey') { state.showSurvey=false;render();return; }
        if (action === 'toggle-handoff-form') { state.showHandoffForm=!state.showHandoffForm;render();return; }
        if (action === 'save-handoff') { var tbid=document.querySelector('[data-field="handoff-to-buddy"]')?.value;if(!tbid){showToast('Select receiving Buddy','error');return;}saveHandoffNote(state.caseId,tbid,{active_issues:document.querySelector('[data-field="handoff-active-issues"]')?.value||'',watch_items:document.querySelector('[data-field="handoff-watch-items"]')?.value||'',client_preferences:document.querySelector('[data-field="handoff-client-prefs"]')?.value||'',additional_notes:document.querySelector('[data-field="handoff-notes"]')?.value||''}).then(function(){state.showHandoffForm=false;showToast('Handoff saved!','success');loadHandoffNotes(state.caseId).then(function(){render();});});return; }
        if (action === 'copy-referral-code') { navigator.clipboard.writeText(state.profile?.referral_code||'').then(function(){showToast('Copied!','success');});return; }
        if (action === 'close-password-reset') { state._showPasswordReset=false;render();return; }
        if (action === 'toggle-mute-case') { var cid=target.dataset.caseId;if(!cid)return;var muted=state.notificationSettings.muted_case_ids||[];if(muted.includes(cid)){state.notificationSettings.muted_case_ids=muted.filter(function(id){return id!==cid;});showToast('Notifications unmuted for this case','success');}else{state.notificationSettings.muted_case_ids=[].concat(muted,[cid]);showToast('Notifications muted for this case','info');}saveNotificationSettings().catch(function(){});render();return; }
        if (action === 'save-new-password') { var np=document.querySelector('[data-field="reset-new-password"]')?.value||'';var cp=document.querySelector('[data-field="reset-confirm-password"]')?.value||'';if(np.length<8){showToast('Password must be at least 8 characters','error');return;}if(np!==cp){showToast('Passwords do not match','error');return;}sb.auth.updateUser({password:np}).then(function(r){if(r.error)throw r.error;state._showPasswordReset=false;showToast('Password updated successfully!','success');render();}).catch(function(e){showToast(e.message||'Failed to update password','error');});return; }
        if (action === 'download-ics') { var apt=state.appointments.find(function(a){return a.id===target.dataset.appointmentId;});if(apt){var ics=generateICS(apt,state.currentCase?.pets?.name||'Pet');var b=new Blob([ics],{type:'text/calendar'});var u=URL.createObjectURL(b);var dl=document.createElement('a');dl.href=u;dl.download='vet-buddies-appt.ics';dl.click();URL.revokeObjectURL(u);showToast('Calendar event downloaded!','success');}return; }
        if (action === 'export-care-plan-pdf') { if(state.carePlan&&state.currentCase){showToast('Generating PDF...','info');ensureJsPDF().then(function(){return generateCarePlanPDF(state.carePlan,state.currentCase);}).then(function(bu){var url=URL.createObjectURL(bu);var dl=document.createElement('a');dl.href=url;dl.download='care-plan-'+(state.currentCase.pets?.name||'pet')+'.pdf';dl.click();URL.revokeObjectURL(url);showToast('PDF downloaded!','success');}).catch(function(){showToast('PDF failed','error');});}return; }
        if (action === 'checkout-stripe') { var pid=target.dataset.priceId;if(!pid)return;showToast('Redirecting...','info');var origin=window.location.origin;var checkoutPayload={price_id:pid,success_url:origin+'/?billing=success',cancel_url:origin+'/'};if(isLTOActive()){checkoutPayload.lto_initiated_at=new Date().toISOString();checkoutPayload.lto_locked_rate=true;}callEdgeFunction('stripe-checkout',checkoutPayload).then(function(r){if(r?.url)window.location.href=r.url;}).catch(function(err){showToast(err.message||'Checkout failed','error');});return; }
        if (action === 'show-pricing') { state.showPricingModal=true;render();return; }
        if (action === 'close-pricing') { state.showPricingModal=false;render();return; }
        if (action === 'show-notif-settings') { state.showNotifSettings=true;state.showNotifications=false;render();return; }
        if (action === 'close-notif-settings') { state.showNotifSettings=false;render();return; }
        if (action === 'save-notif-settings') {
          // Read all checkbox states from the modal
          document.querySelectorAll('.notif-toggle').forEach(function(el) {
            const setting = el.dataset.setting;
            if (setting) state.notificationSettings[setting] = el.checked;
          });
          // Capture SMS phone number if SMS is enabled
          const smsPhoneInput = document.querySelector('[data-field="sms-phone"]');
          if (smsPhoneInput) {
            const phone = smsPhoneInput.value.trim().replace(/[^\d+]/g, '');
            if (state.notificationSettings.sms_enabled && (!phone || phone.length < 10)) {
              showToast('Please enter a valid phone number for SMS notifications', 'error');
              return;
            }
            state.notificationSettings.sms_phone = phone;
          }
          // Capture quiet hours
          const qhStart = document.querySelector('[data-field="quiet-hours-start"]');
          const qhEnd = document.querySelector('[data-field="quiet-hours-end"]');
          if (qhStart) state.notificationSettings.quiet_hours_start = qhStart.value || '';
          if (qhEnd) state.notificationSettings.quiet_hours_end = qhEnd.value || '';
          // If push was toggled on and permission not yet granted, request it
          if (state.notificationSettings.push_enabled && ('Notification' in window) && Notification.permission !== 'granted') {
            await requestNotificationPermission();
            state.notificationSettings.push_enabled = Notification.permission === 'granted';
          }
          await saveNotificationSettings();
          state.showNotifSettings = false;
          render();
          return;
        }
        if (action === 'enable-push-from-toast') {
          state.showPushPromptBanner = false;
          await requestNotificationPermission();
          render();
          return;
        }
        if (action === 'dismiss-push-toast') {
          state.showPushPromptBanner = false;
          render();
          return;
        }
        if (action === 'enable-push-notifications') {
          state.showPushPromptBanner = false;
          state.showPushPromptInPanel = false;
          await requestNotificationPermission();
          render();
          return;
        }
        if (action === 'mark-all-notifications-read') {
          try {
            if (state.profile.role === 'client') {
              const clientCaseIds = (state.cases || []).map(c => c.id);
              if (clientCaseIds.length) {
                await sb.from('messages').update({ is_read_by_client: true }).neq('sender_role', 'client').eq('is_read_by_client', false).in('case_id', clientCaseIds);
              }
              state.clientUnreadCount = 0;
            } else if (state.profile.role === 'admin') {
              await sb.from('messages').update({ is_read_by_staff: true, read_at: new Date().toISOString() }).eq('is_read_by_staff', false).eq('sender_role', 'client');
            } else if (state.profile.role === 'vet_buddy') {
              const buddyCaseIds = (state.cases || []).map(c => c.id);
              if (buddyCaseIds.length) {
                await sb.from('messages').update({ is_read_by_buddy: true, read_at: new Date().toISOString() }).eq('is_read_by_buddy', false).eq('sender_role', 'client').in('case_id', buddyCaseIds);
              }
            }
            state.unreadCount = 0;
            state.inboxMessages = [];
            state.showNotifications = false;
            showToast('All notifications marked as read', 'success');
            render();
          } catch(e) { console.error(e); showToast('Failed to mark read', 'error'); }
          return;
        }
        if (action === 'show-2fa') { state.show2FA=true;render();return; }
        if (action === 'close-2fa') { state.show2FA=false;render();return; }

        switch (action) {
          case 'care-team-invite-signup':
            navigate('signup');
            break;
          case 'care-team-invite-login':
            navigate('login');
            break;
          case 'nav-login':
            navigate('login');
            break;
          case 'nav-signup':
            navigate('signup');
            break;
          case 'onboarding-next':
            state.onboardingStep = (state.onboardingStep || 1) + 1;
            if (state.onboardingStep === 2) loadAvailableBuddies();
            render();
            break;
          case 'save-onboarding-concern': {
            const concern = document.querySelector('[data-field="onboarding-concern"]')?.value.trim();
            if (concern && state.caseId) {
              try {
                // Load or init the living plan and seed the first goal
                await loadCarePlan(state.caseId);
                const lp = state.carePlan?.living_plan || emptyLivingCarePlan();
                lp.active_care_goals.push({
                  goal_text: concern,
                  set_by_owner: true,
                  created_at: new Date().toISOString(),
                  reviewed_at: null,
                  status: 'active',
                  dvm_reviewed: false,
                });
                const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
                if (state.carePlan?.id) {
                  await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
                } else {
                  await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
                }
              } catch(err) { console.error('Failed to save onboarding concern:', err); }
            }
            await loadCases();
            navigate('client-dashboard');
            break;
          }
          case 'nav-add-pet':
            window._pendingPetPhoto = null;
            window._pendingPetPhotoDataUrl = null;
            navigate('add-pet');
            break;
          case 'trigger-photo-upload': {
            const inp = document.getElementById('pet-photo-input');
            if (inp) inp.click();
            break;
          }
          case 'change-pet-photo': {
            const inp2 = document.getElementById('change-photo-input');
            if (inp2) inp2.click();
            break;
          }
          case 'save-care-story': {
            const storyVal = document.querySelector('[data-field="pet-care-story"]')?.value || '';
            const storyPetId = target.dataset.petId;
            if (!storyPetId) break;
            try {
              await sb.from('pets').update({ care_story: storyVal }).eq('id', storyPetId);
              // Update local state
              const idx2 = state.cases.findIndex(c => c.pets?.id === storyPetId);
              if (idx2 >= 0 && state.cases[idx2].pets) state.cases[idx2].pets.care_story = storyVal;
              showToast('Story saved', 'success');
            } catch(err) { showToast('Failed to save story', 'error'); }
            break;
          }
          case 'toggle-legacy-mode': {
            const legacyPetId = target.dataset.petId;
            const newLegacy = target.dataset.currentLegacy !== 'true';
            if (!legacyPetId) break;
            try {
              await sb.from('pets').update({ legacy_mode: newLegacy }).eq('id', legacyPetId);
              const idx3 = state.cases.findIndex(c => c.pets?.id === legacyPetId);
              if (idx3 >= 0 && state.cases[idx3].pets) state.cases[idx3].pets.legacy_mode = newLegacy;
              showToast(newLegacy ? 'Memorial mode activated' : 'Memorial mode deactivated', 'success');
              render();
            } catch(err) { showToast('Failed to update memorial mode', 'error'); }
            break;
          }
          // ── Care Team & Community Handlers ──
          case 'toggle-invite-helper':
            state._showInviteHelper = !state._showInviteHelper;
            render();
            break;
          case 'send-helper-invite': {
            const hEmail = document.querySelector('[data-field="helper-invite-email"]')?.value?.trim();
            const hMsg = document.querySelector('[data-field="helper-invite-msg"]')?.value?.trim() || '';
            const hCaseId = target.dataset.caseId;
            const hPetId = target.dataset.petId;
            if (!hEmail || !hCaseId) { showToast('Email is required', 'error'); break; }
            // Check helper cap
            const hCap = getHelperCap(hCaseId);
            const hCurrent = (state._careTeamMembers || []).filter(m => m.role === 'helper').length;
            if (hCap !== Infinity && hCurrent >= hCap) { showToast(`Helper limit reached (${hCap}). Upgrade for more.`, 'error'); break; }
            try {
              await sb.from('pending_invites').insert({
                email: hEmail,
                role: 'helper',
                case_id: hCaseId,
                invited_by: state.profile.id,
                first_name: '',
                last_name: '',
                message: hMsg,
                token: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)),
              });
              state._showInviteHelper = false;
              showToast(`Invite sent to ${hEmail}`, 'success');
              // Award pet XP for inviting
              try { await awardCareXP(hPetId, 'team_member_invited'); } catch(_) {}
              render();
            } catch(err) { showToast('Failed to send invite', 'error'); }
            break;
          }
          case 'open-care-team-invite': {
            const ctCaseId = target.dataset.caseId;
            const ctPetId = target.dataset.petId;
            const ctPetName = target.dataset.petName || '';
            const ctPetBreed = target.dataset.petBreed || '';
            const ctOwnerName = target.dataset.ownerName || state.profile?.name || '';
            showModal(`Invite to ${ctPetName}'s care team`, `
              <div class="form-group"><label>Name</label><input type="text" data-field="ct-invite-name" placeholder="First and last name" class="form-input"></div>
              <div class="form-group"><label>Email</label><input type="email" data-field="ct-invite-email" placeholder="friend@example.com" class="form-input"></div>
              <div class="form-group"><label>How do they help?</label><input type="text" data-field="ct-invite-how" placeholder="e.g. walks ${esc(ctPetName)} on Tuesdays" class="form-input"></div>
              <div style="margin-top:12px; padding:12px; background:#f9f9f9; border-radius:8px; font-size:13px; color:var(--text-secondary); line-height:1.5;">
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:6px; color:var(--text-secondary);">Invite preview</div>
                <em>"Hey <span data-preview="ct-name">___</span>, I've added you to ${esc(ctPetName)}'s care team on Vet Buddies. ${esc(ctPetName)} is a ${esc(ctPetBreed)} who <span data-preview="ct-how">___</span>. With Vet Buddies, you can see ${esc(ctPetName)}'s care plan, log check-ins, and stay connected with their Vet Buddy. — ${esc(ctOwnerName)}"</em>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:8px;">You'll earn referral credit if they subscribe.</div>
            `, `
              <button class="btn btn-primary" data-action="send-care-team-invite" data-case-id="${ctCaseId}" data-pet-id="${ctPetId}" data-pet-name="${esc(ctPetName)}" data-pet-breed="${esc(ctPetBreed)}" data-owner-name="${esc(ctOwnerName)}">Send Invite</button>
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            `);
            // Live-update the preview as user types
            setTimeout(() => {
              const nameInput = document.querySelector('[data-field="ct-invite-name"]');
              const howInput = document.querySelector('[data-field="ct-invite-how"]');
              const namePreview = document.querySelector('[data-preview="ct-name"]');
              const howPreview = document.querySelector('[data-preview="ct-how"]');
              if (nameInput && namePreview) nameInput.addEventListener('input', () => { namePreview.textContent = nameInput.value || '___'; });
              if (howInput && howPreview) howInput.addEventListener('input', () => { howPreview.textContent = howInput.value || '___'; });
            }, 50);
            break;
          }
          case 'send-care-team-invite': {
            const ctName = document.querySelector('[data-field="ct-invite-name"]')?.value?.trim();
            const ctEmail = document.querySelector('[data-field="ct-invite-email"]')?.value?.trim();
            const ctHow = document.querySelector('[data-field="ct-invite-how"]')?.value?.trim() || '';
            const ctCaseId2 = target.dataset.caseId;
            const ctPetId2 = target.dataset.petId;
            if (!ctName) { showToast('Name is required', 'error'); break; }
            if (!ctEmail) { showToast('Email is required', 'error'); break; }
            // Check if this email is already a co-owner
            const existingCoOwner = (state.petCoOwners || []).find(co => (co.user?.email || co.invited_email || '').toLowerCase() === ctEmail.toLowerCase());
            if (existingCoOwner) { showToast('This person is already a co-owner', 'error'); break; }
            const nameParts = ctName.split(/\s+/);
            const ctFirst = nameParts[0] || '';
            const ctLast = nameParts.slice(1).join(' ') || '';
            try {
              const ctToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
              await sb.from('pending_invites').insert({
                email: ctEmail,
                role: 'caregiver',
                case_id: ctCaseId2,
                invited_by: state.profile.id,
                first_name: ctFirst,
                last_name: ctLast,
                message: ctHow,
                token: ctToken,
                invite_source: 'care_team',
              });
              closeModal();
              showToast(`Invite sent to ${ctFirst}. You'll earn referral credit when they join.`, 'success');
              try { await awardCareXP(ctPetId2, 'team_member_invited'); } catch(_) {}
              // Reload care profile to refresh pending invites
              const activePetId = state.cases[state.activePetIndex || 0]?.pets?.id;
              if (activePetId) await loadPetCareProfile(activePetId);
              render();
            } catch(err) {
              console.error('Care team invite failed:', err);
              showToast('Failed to send invite', 'error');
            }
            break;
          }
          case 'resend-care-team-invite': {
            const rInviteId = target.dataset.inviteId;
            const rEmail = target.dataset.email;
            if (!rInviteId) break;
            try {
              // Update created_at to "resend" (resets the invite timestamp)
              await sb.from('pending_invites').update({ created_at: new Date().toISOString() }).eq('id', rInviteId);
              showToast(`Invite resent to ${rEmail || 'recipient'}`, 'success');
            } catch(err) {
              showToast('Failed to resend invite', 'error');
            }
            break;
          }
          case 'show-tier-gate': {
            const feature = target.dataset.feature;
            showToast(TIER_UPGRADE_COPY[feature]?.desc || 'Upgrade to unlock this feature', 'info');
            break;
          }
          case 'toggle-post-care-request':
            state._showPostCareRequest = !state._showPostCareRequest;
            render();
            break;
          case 'save-care-request': {
            const crTitle = document.querySelector('[data-field="cr-title"]')?.value?.trim();
            const crType = document.querySelector('[data-field="cr-type"]')?.value || 'other';
            const crDesc = document.querySelector('[data-field="cr-desc"]')?.value?.trim() || '';
            const crNeeded = document.querySelector('[data-field="cr-needed-by"]')?.value || null;
            const crLocation = document.querySelector('[data-field="cr-location"]')?.value?.trim() || null;
            const crPrivate = document.querySelector('[data-field="cr-private"]')?.checked || false;
            const crPetId = target.dataset.petId;
            if (!crTitle) { showToast('Title is required', 'error'); break; }
            try {
              await sb.from('care_requests').insert({
                pet_id: crPetId,
                owner_id: state.profile.id,
                title: crTitle,
                description: crDesc,
                request_type: crType,
                needed_by: crNeeded ? new Date(crNeeded).toISOString() : null,
                location_hint: crLocation,
                is_private: crPrivate,
                xp_reward: getUserTier() === 'buddy_vip' ? 35 : 25,
              });
              state._showPostCareRequest = false;
              try { await awardCareXP(crPetId, 'care_request_posted'); } catch(_) {}
              showToast('Care request posted!', 'success');
              await loadPetCareProfile(crPetId);
              render();
            } catch(err) { showToast('Failed to post request', 'error'); }
            break;
          }
          case 'claim-care-request': {
            const reqId = target.dataset.requestId;
            if (!reqId) break;
            try {
              await sb.from('care_requests').update({
                status: 'claimed',
                claimed_by: state.profile.id,
                claimed_at: new Date().toISOString(),
              }).eq('id', reqId);
              try { await awardCommunityXP(state.profile.id, 'care_request_claimed'); } catch(_) {}
              showToast('You offered to help! The owner will be notified.', 'success');
              await loadPetCareProfile(getCurrentPetId());
              render();
            } catch(err) { showToast('Failed to claim request', 'error'); }
            break;
          }
          case 'complete-care-request': {
            const compReqId = target.dataset.requestId;
            const claimerId = target.dataset.claimerId;
            if (!compReqId) break;
            try {
              await sb.from('care_requests').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
              }).eq('id', compReqId);
              // Award community XP to the helper
              if (claimerId) {
                try { await awardCommunityXP(claimerId, 'care_request_completed'); } catch(_) {}
                // Increment assists_received for the owner
                const { data: ownerStats } = await sb.from('user_care_stats').select('*').eq('user_id', state.profile.id).maybeSingle();
                if (ownerStats) {
                  await sb.from('user_care_stats').update({ assists_received: (ownerStats.assists_received || 0) + 1, updated_at: new Date().toISOString() }).eq('user_id', state.profile.id);
                } else {
                  await sb.from('user_care_stats').insert({ user_id: state.profile.id, assists_received: 1 });
                }
              }
              showToast('Request completed! Helper has been recognized.', 'success');
              await loadPetCareProfile(getCurrentPetId());
              render();
            } catch(err) { showToast('Failed to complete request', 'error'); }
            break;
          }
          case 'start-free-trial': {
            target.textContent = 'Setting up…';
            target.disabled = true;
            try {
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);
              const { error } = await sb.from('users').update({
                subscription_status: 'trialing',
                trial_ends_at: trialEnd.toISOString(),
              }).eq('id', state.profile.id);
              if (error) throw error;
              state.profile.subscription_status = 'trialing';
              state.profile.trial_ends_at = trialEnd.toISOString();
              showToast(`🎉 Your ${TRIAL_DURATION_DAYS}-day free trial has started!`, 'success');
              loadAvailableBuddies().then(() => { state.onboardingStep = 2; render(); });

            } catch (err) {
              showToast(err.message || 'Could not start trial', 'error');
              target.textContent = 'Start My Free Trial →';
              target.disabled = false;
            }
            break;
          }
          case 'subscribe': {
            const priceId = target.dataset.priceId;
            if (!priceId) break;
            target.textContent = 'Loading…';
            target.disabled = true;
            try {
              const origin = window.location.origin;
              const checkoutBody = {
                price_id: priceId,
                success_url: `${origin}/?billing=success`,
                cancel_url: `${origin}/`,
              };
              if (isLTOActive()) {
                checkoutBody.lto_initiated_at = new Date().toISOString();
                checkoutBody.lto_locked_rate = true;
              }
              const { url } = await callEdgeFunction('stripe-checkout', checkoutBody);
              window.location.href = url;
            } catch (err) {
              showToast(err.message || 'Could not start checkout', 'error');
              target.textContent = 'Subscribe';
              target.disabled = false;
            }
            break;
          }
          case 'manage-billing': {
            const origText = target.textContent;
            target.textContent = 'Loading…';
            target.disabled = true;
            try {
              const { url } = await callEdgeFunction('stripe-billing-portal', {
                return_url: window.location.href,
              });
              window.location.href = url;
            } catch (err) {
              showToast(err.message || 'Could not open billing portal', 'error');
              target.textContent = origText;
              target.disabled = false;
            }
            break;
          }
          case 'select-buddy': {
            state.selectedBuddyId = target.closest('[data-buddy-id]')?.dataset.buddyId || null;
            render();
            break;
          }
          case 'save-new-pet-and-finish':
          case 'save-new-pet': {
            const petName = document.querySelector('[data-field="new-pet-name"]')?.value?.trim();
            const petSpecies = document.querySelector('[data-field="new-pet-species"]')?.value || 'Dog';
            const petBreed = document.querySelector('[data-field="new-pet-breed"]')?.value?.trim() || null;
            const onboardingConcern = document.querySelector('[data-field="onboarding-concern"]')?.value?.trim() || '';
            if (!petName) { showToast('Please enter a pet name', 'error'); break; }
            // Prevent duplicate submissions — disable button while saving
            const origBtnText = target.textContent;
            target.textContent = 'Saving…';
            target.disabled = true;
            try {
              const insertData = { name: petName, species: petSpecies, owner_id: state.profile.id };
              if (petBreed) insertData.breed = petBreed;
              const { data: newPet, error: petErr } = await sb.from('pets').insert(insertData).select('id').single();
              if (petErr) throw petErr;
              // Upload photo if one was selected
              if (window._pendingPetPhoto) {
                try {
                  await uploadPetPhoto(window._pendingPetPhoto, newPet.id);
                } catch(photoErr) {
                  console.warn('Photo upload failed (pet still saved):', photoErr);
                }
                window._pendingPetPhoto = null;
                window._pendingPetPhotoDataUrl = null;
              }
              // Auto-create a case for this pet with full Living Care Plan
              const priceId = state.profile.subscription_tier_stripe;
              const plan = priceId ? STRIPE_PLANS.find(p => p.id === priceId) : null;
              const caseTier = plan?.tier || 'Buddy';
              const caseInsert = {
                pet_id: newPet.id,
                status: 'Active',
                subscription_tier: caseTier,
                created_at: new Date().toISOString(),
              };
              if (state.selectedBuddyId) caseInsert.assigned_buddy_id = state.selectedBuddyId;
              const { data: newCase, error: caseErr } = await sb.from('cases').insert(caseInsert).select('id').single();
              if (caseErr) throw caseErr;

              // Create Living Care Plan — include onboarding concern as first care goal if provided
              const carePlanData = {
                case_id: newCase.id,
                summary: `${petName} · ${petSpecies}${petBreed ? ' · ' + petBreed : ''}`,
                updated_at: new Date().toISOString(),
              };
              if (onboardingConcern) {
                const lp = { pet_profile: '', care_team: [], active_care_goals: [{ goal_text: onboardingConcern, set_by_owner: true, status: 'active' }], engagement_log: [], milestones: [] };
                carePlanData.content = JSON.stringify(lp);
              }
              await sb.from('care_plans').insert(carePlanData);

              // Create timeline entry to notify admin of new case
              await sb.from('timeline_entries').insert({
                case_id: newCase.id,
                author_id: state.profile.id,
                type: 'update',
                content: state.selectedBuddyId
                  ? `New pet "${petName}" added — case created with ${caseTier} tier. Client chose ${state.availableBuddies.find(b => b.id === state.selectedBuddyId)?.name || 'a buddy'} as their Buddy.`
                  : `New pet "${petName}" added — case created with ${caseTier} tier. Pending buddy assignment.`,
                is_client_visible: false,
                created_at: new Date().toISOString(),
              });

              showToast(`${petName} added and care case created! 🐾`, 'success');
              await loadCases();
              // Mark first visit for welcome banner
              state._showWelcomeBanner = true;
              // Go straight to dashboard (no more steps 3-5)
              navigate('client-dashboard');
            } catch (err) {
              console.error('Add pet error:', err);
              showToast(err.message || 'Failed to add pet', 'error');
              target.textContent = origBtnText;
              target.disabled = false;
            }
            break;
          }
          case 'nav-client-dashboard':
            await loadCases();
            navigate('client-dashboard');
            break;
          case 'nav-subscribe':
            state.showPricingModal = true;
            render();
            break;
          case 'nav-client-case':
            if (state.cases.length > 0) {
              // Support explicit case-id from dashboard quick-nav buttons
              const targetCaseId = target.dataset.caseId;
              if (targetCaseId) {
                state.caseId = targetCaseId;
                const idx = state.cases.findIndex(c => c.id === targetCaseId);
                if (idx >= 0) state.activePetIndex = idx;
              } else {
                state.caseId = state.cases[state.activePetIndex || 0]?.id || state.cases[0].id;
              }
              if (target.dataset.tab) state.caseTab = target.dataset.tab;
              state.showAddAppt = false; state.editingApptId = null; state.showAddTimeline = false; state.showRaiseEscalation = false;
              // Load case first (needed for petId), then everything else in parallel
              await loadCase(state.caseId);
              const petId = state.currentCase?.pets?.id;
              await Promise.all([
                loadCarePlan(state.caseId),
                loadMessages(state.caseId),
                loadTimeline(state.caseId),
                loadAppointments(state.caseId),
                loadDocuments(state.caseId),
                loadGeneticInsights(state.caseId),
                (state.caseTab === 'medications' && petId) ? loadPetMedications(petId) : Promise.resolve(),
                (state.caseTab === 'vaccines' && petId) ? loadPetVaccines(petId) : Promise.resolve(),
                petId ? loadPetCoOwners(petId) : Promise.resolve(),
                petId ? loadPetCareProfile(petId).catch(() => {}) : Promise.resolve(),
              ]);
              subscribeToMessages(state.caseId);
              navigate('client-case');
            }
            break;
          case 'dismiss-welcome':
            state._showWelcomeBanner = false;
            render();
            break;
          case 'send-co-owner-invite': {
            const emailInput = document.getElementById('co-owner-email-input');
            const inviteEmail = emailInput ? emailInput.value.trim() : '';
            const invitePetId = target.dataset.petId;
            if (!inviteEmail || !inviteEmail.includes('@')) { showToast('Please enter a valid email address.', 'error'); break; }
            if (inviteEmail === state.user.email) { showToast('You cannot invite yourself.', 'error'); break; }
            await inviteCoOwner(invitePetId, inviteEmail);
            state.coOwnerInviteEmail = '';
            render();
            break;
          }
          case 'accept-co-owner-invite':
            await acceptCoOwnerInvite(target.dataset.inviteId);
            break;
          case 'decline-co-owner-invite':
            await declineCoOwnerInvite(target.dataset.inviteId);
            break;
          case 'remove-co-owner': {
            if (confirm('Remove this co-owner? They will lose access to this pet.')) {
              await removeCoOwner(target.dataset.coOwnerId);
              render();
            }
            break;
          }
          // ── Resource management ──
          case 'toggle-add-resource':
            state.showAddResource = !state.showAddResource;
            render();
            break;
          case 'save-resource': {
            const resTitle = document.querySelector('[data-field="res-title"]')?.value?.trim();
            const resDesc = document.querySelector('[data-field="res-desc"]')?.value?.trim();
            const resUrl = document.querySelector('[data-field="res-url"]')?.value?.trim();
            const resIcon = document.querySelector('[data-field="res-icon"]')?.value?.trim() || '📄';
            if (!resTitle) { showToast('Please enter a resource title', 'error'); break; }
            try {
              await sb.from('admin_resources').insert({
                title: resTitle, description: resDesc, url: resUrl || null, icon: resIcon, created_by: state.profile.id
              });
              state.showAddResource = false;
              showToast('Resource saved!', 'success');
              render();
            } catch(err) { showToast('Failed to save resource: ' + err.message, 'error'); }
            break;
          }
          // ── External vet: view case detail ──
          case 'view-case-detail': {
            const vcCaseId = target.dataset.caseId;
            if (vcCaseId) {
              state.caseId = vcCaseId;
              await loadCase(vcCaseId);
              await loadCarePlan(vcCaseId);
              await loadMessages(vcCaseId);
              subscribeToMessages(vcCaseId);
              navigate('external-case');
            }
            break;
          }
          // ── Buddy scorecard detail ──
          case 'view-scorecard-detail':
            // Scorecard cards are informational — no-op for now
            break;
          // ── Partner clinic: push visit summary ──
          case 'push-visit-summary': {
            const visitCaseId = document.getElementById('visit-case-id')?.value || state.caseId || (state.cases[0]?.id);
            const visitDate = document.getElementById('visit-date')?.value;
            const visitType = document.getElementById('visit-type')?.value || 'other';
            const visitSummary = document.getElementById('visit-summary')?.value?.trim();
            const visitRecs = document.getElementById('visit-recommendations')?.value?.trim();
            if (!visitCaseId) { showToast('Please select a case', 'error'); break; }
            if (!visitSummary) { showToast('Please enter a visit summary', 'error'); break; }
            try {
              const visitTypeLabels = { wellness: 'Wellness Check', sick: 'Sick Visit', followup: 'Follow-Up', emergency: 'Emergency', surgery: 'Surgery/Procedure', dental: 'Dental', vaccination: 'Vaccination', other: 'Visit' };
              const typeLabel = visitTypeLabels[visitType] || 'Visit';
              await sb.from('timeline_entries').insert({
                case_id: visitCaseId,
                type: 'note',
                content: `🏥 External Vet ${typeLabel}` + (visitDate ? ` — ${visitDate}` : '') + `:\n${visitSummary}` + (visitRecs ? `\n\nRecommendations: ${visitRecs}` : ''),
                author_id: state.profile.id,
                is_client_visible: true,
                created_at: new Date().toISOString()
              });
              // Also post a message to the case so the buddy is notified
              await sb.from('messages').insert({
                case_id: visitCaseId,
                sender_id: state.profile.id,
                content: `🏥 **External Vet ${typeLabel}**${visitDate ? ' (' + visitDate + ')' : ''}\n\n${visitSummary}${visitRecs ? '\n\n**Recommendations:** ' + visitRecs : ''}`,
                sender_role: state.profile.role || 'external_vet',
                thread_type: 'staff',
                created_at: new Date().toISOString()
              });
              showToast('Visit summary submitted and care team notified!', 'success');
              // Clear form
              const summaryEl = document.getElementById('visit-summary');
              const recsEl = document.getElementById('visit-recommendations');
              if (summaryEl) summaryEl.value = '';
              if (recsEl) recsEl.value = '';
              render();
            } catch(err) { showToast('Failed to submit summary: ' + err.message, 'error'); }
            break;
          }
          // ── Dismiss refill alert ──
          case 'dismiss-refill-alert': {
            const medEl = target.closest('[data-action="dismiss-refill-alert"]');
            if (medEl) {
              medEl.parentElement?.removeChild(medEl);
            }
            break;
          }
          // ── Save new case (admin) ──
          case 'save-new-case': {
            const ncClientId = document.querySelector('[data-field="new-case-client"]')?.value;
            const ncPetName = document.querySelector('[data-field="new-case-pet-name"]')?.value?.trim();
            const ncSpecies = document.querySelector('[data-field="new-case-pet-species"]')?.value;
            const ncBreed = document.querySelector('[data-field="new-case-pet-breed"]')?.value?.trim();
            const ncTier = document.querySelector('[data-field="new-case-tier"]')?.value;
            const ncBuddyId = document.querySelector('[data-field="new-case-buddy"]')?.value;
            if (!ncClientId) { showToast('Please select a client', 'error'); break; }
            if (!ncPetName) { showToast('Please enter a pet name', 'error'); break; }
            try {
              const { data: newPet, error: petErr } = await sb.from('pets').insert({
                name: ncPetName, species: ncSpecies || 'Dog', breed: ncBreed || null, owner_id: ncClientId
              }).select().single();
              if (petErr) throw petErr;
              const { error: caseErr } = await sb.from('cases').insert({
                pet_id: newPet.id,
                assigned_buddy_id: ncBuddyId || null,
                status: 'Active',
                subscription_tier: ncTier || 'Buddy'
              });
              if (caseErr) throw caseErr;
              showToast('Case created for ' + ncPetName + '!', 'success');
              await loadCases();
              await loadTeamMembers();
              navigate('admin-cases');
            } catch(err) { showToast('Failed to create case: ' + err.message, 'error'); }
            break;
          }
          case 'switch-active-pet': {
            const newIdx = parseInt(target.dataset.idx || '0');
            state.activePetIndex = Math.max(0, Math.min(newIdx, state.cases.length - 1));
            // Reload care plan + appointments + care profile for the newly selected pet
            const switchedCase = state.cases[state.activePetIndex];
            if (switchedCase) {
              Promise.all([loadCarePlan(switchedCase.id), loadAppointments(switchedCase.id), loadPetCareProfile(switchedCase.pets?.id), loadTimeline(switchedCase.id)]).then(() => render());
            }
            render();
            break;
          }
          case 'nav-buddy-dashboard':
            await loadCases();
            await loadBuddyAllAppointments();
            navigate('buddy-dashboard');
            break;
          case 'nav-buddy-case':
            state.caseId = target.dataset.caseId;
            await loadCase(state.caseId);
            await loadCarePlan(state.caseId);
            await loadMessages(state.caseId);
            await loadTimeline(state.caseId);
            await loadTouchpoints(state.caseId);
            await loadAppointments(state.caseId);
            try { await loadPetCareProfile(state.currentCase?.pets?.id); } catch(_) {}
            subscribeToMessages(state.caseId);
            navigate('buddy-case');
            break;
          case 'nav-admin-dashboard':
            await loadCases();
            await loadEscalations();
            navigate('admin-dashboard');
            break;
          case 'nav-knowledge-base': navigate('knowledge-base'); break;
          case 'nav-kb-admin': navigate('kb-admin'); break;
          case 'nav-audit-log': navigate('audit-log'); break;
          case 'nav-buddy-scorecard': navigate('buddy-scorecard'); break;
          case 'nav-survey-results': navigate('survey-results'); break;
          case 'nav-referral-dashboard':
            if (!hasFeatureAccess('referral_dashboard')) { showToast('Upgrade to Buddy+ to access the referral dashboard', 'info'); break; }
            navigate('referral-dashboard'); break;
          case 'nav-health-timeline':
            if (!hasFeatureAccess('health_timeline')) { showToast('Upgrade to Buddy+ to access the health timeline', 'info'); break; }
            navigate('health-timeline'); break;
          case 'nav-partner-clinic-dashboard': navigate('partner-clinic-dashboard'); break;
          case 'nav-admin-cases':
            await loadCases();
            await loadTeamMembers();
            navigate('admin-cases');
            break;
          case 'nav-admin-case':
            state.caseId = target.dataset.caseId;
            state.caseTab = 'careplan';
            state.showAddAppt = false;
            state.showAddTimeline = false;
            state.showRaiseEscalation = false;
            await loadCases();
            await loadTeamMembers();
            await loadCase(state.caseId);
            await loadCarePlan(state.caseId);
            await loadMessages(state.caseId);
            await loadTimeline(state.caseId);
            await loadTouchpoints(state.caseId);
            await loadAppointments(state.caseId);
            subscribeToMessages(state.caseId);
            navigate('admin-cases');
            break;
          case 'nav-buddy-inbox':
            await loadCases();
            await loadUnreadCount();
            await loadAllUnreadMessages();
            navigate('buddy-inbox');
            break;
          case 'nav-admin-inbox':
            await loadCases();
            await loadUnreadCount();
            await loadAllUnreadMessages();
            navigate('admin-inbox');
            break;
          case 'nav-admin-escalations':
            await loadEscalations();
            navigate('admin-escalations');
            break;
          case 'nav-buddy-schedule': {
            // Ensure cases are loaded before deriving case IDs
            if (!state.cases.length) await loadCases();
            const buddyCaseIds = (state.cases || []).map(c => c.id);
            if (buddyCaseIds.length) {
              const { data: buddyAppts } = await sb.from('appointments').select('*').in('case_id', buddyCaseIds).order('scheduled_at', { ascending: true });
              state.appointments = buddyAppts || [];
            } else {
              state.appointments = [];
            }
            navigate('admin-schedule'); // reuses admin schedule view
            break;
          }
          case 'nav-admin-schedule': {
            const { data: allAppts } = await sb.from('appointments').select('*').order('scheduled_at', { ascending: true });
            state.appointments = allAppts || [];
            navigate('admin-schedule');
            break;
          }
          case 'nav-admin-team':
            await loadTeamMembers();
            navigate('admin-team');
            break;
          case 'nav-admin-resources':
            await loadResources();
            navigate('admin-resources');
            break;
          case 'nav-external-dashboard':
            await loadCases();
            navigate('external-dashboard');
            break;
          case 'nav-geneticist-dashboard':
            await loadGeneticistCases();
            navigate('geneticist-dashboard');
            break;
          case 'nav-geneticist-case': {
            state.caseId = target.dataset.caseId;
            state.geneticCaseTab = target.dataset.tab || 'overview';
            await loadCase(state.caseId);
            await loadCarePlan(state.caseId);
            await loadDocuments(state.caseId);
            await loadPetMedications(state.currentCase?.pets?.id);
            await loadPetVaccines(state.currentCase?.pets?.id);
            await loadGeneticInsights(state.caseId);
            navigate('geneticist-case');
            break;
          }
          case 'save-genetic-insight': {
            const caseId = target.dataset.caseId;
            const title = document.querySelector('[data-field="insight-title"]')?.value?.trim() || 'Genetic Insights';
            const content = document.querySelector('[data-field="insight-content"]')?.value?.trim();
            if (!content) { showToast('Please enter insight content', 'error'); break; }
            const riskFlags = (document.querySelector('[data-field="insight-risks"]')?.value || '')
              .split(',').map(s => s.trim()).filter(Boolean);
            const recs = (document.querySelector('[data-field="insight-recs"]')?.value || '')
              .split('\n').map(s => s.trim()).filter(Boolean);
            try {
              const existing = (state.geneticInsights || []).find(g => g.case_id === caseId);
              if (existing) {
                await sb.from('genetic_insights').update({
                  title, content, breed_risk_flags: riskFlags, recommendations: recs, updated_at: new Date().toISOString()
                }).eq('id', existing.id);
              } else {
                await sb.from('genetic_insights').insert({
                  case_id: caseId, authored_by: state.profile.id,
                  title, content, breed_risk_flags: riskFlags, recommendations: recs
                });
              }
              await loadGeneticInsights(caseId);
              showToast('Genetic insights saved', 'success');
              render();
            } catch(err) { showToast('Save failed: ' + (err.message || 'Error'), 'error'); }
            break;
          }
          case 'toggle-genetic-case-tab':
            state.geneticCaseTab = target.dataset.tab || 'overview';
            render();
            break;
          case 'nav-external-case':
            state.caseId = target.dataset.caseId;
            await loadCase(state.caseId);
            await loadCarePlan(state.caseId);
            await loadMessages(state.caseId);
            await loadTimeline(state.caseId);
            subscribeToMessages(state.caseId);
            navigate('external-case');
            break;
          case 'back-to-case-list':
            state.currentCase = null;
            state.caseId = null;
            render();
            break;
          case 'select-case':
            state.caseId = target.dataset.caseId;
            state.caseTab = 'careplan';
            state.showAddAppt = false;
            state.showAddTimeline = false;
            state.showRaiseEscalation = false;
            state.showEditPet = false;
            state.showInviteVet = false;
            try { await loadCase(state.caseId); } catch(e) { console.error('loadCase failed:', e); }
            try { await loadCarePlan(state.caseId); } catch(e) { console.error('loadCarePlan failed:', e); }
            try { await loadMessages(state.caseId); } catch(e) { console.error('loadMessages failed:', e); }
            try { await loadTimeline(state.caseId); } catch(e) { console.error('loadTimeline failed:', e); }
            try { await loadTouchpoints(state.caseId); } catch(e) { console.error('loadTouchpoints failed:', e); }
            try { await loadAppointments(state.caseId); } catch(e) { console.error('loadAppointments failed:', e); }
            try { await loadDocuments(state.caseId); } catch(e) { console.error('loadDocuments failed:', e); }
            try { await loadGeneticInsights(state.caseId); } catch(e) { console.error('loadGeneticInsights failed:', e); }
            try { if (state.currentCase?.pet_id) await loadPetCoOwners(state.currentCase.pet_id); } catch(e) { console.error('loadPetCoOwners failed:', e); }
            subscribeToMessages(state.caseId);
            logAudit('view', 'case', state.caseId, { pet: state.currentCase?.pets?.name });
            render();
            break;
          case 'edit-careplan-section':
            target.closest('.care-plan-section').classList.toggle('edit-mode');
            target.closest('.care-plan-section').classList.toggle('view-mode');
            break;
          case 'cancel-careplan-section':
            target.closest('.care-plan-section').classList.remove('edit-mode');
            target.closest('.care-plan-section').classList.add('view-mode');
            break;
          case 'save-careplan-section':
            try {
              const sectionKey = target.dataset.section;
              const fieldValue = document.querySelector(`[data-field="section-${sectionKey}"]`)?.value || '';
              const updateData = { [sectionKey]: fieldValue, updated_by: state.profile?.id || null, updated_at: new Date().toISOString() };
              let saveError;
              if (state.carePlan?.id) {
                const { error } = await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
                saveError = error;
              } else {
                const { error } = await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
                saveError = error;
              }
              if (saveError) throw saveError;
              await sb.from('timeline_entries').insert({
                case_id: state.caseId,
                author_id: state.profile?.id,
                type: 'update',
                content: `Living Care Plan section "${sectionKey}" updated`,
                is_client_visible: false,
                created_at: new Date().toISOString(),
              });
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Living Care Plan saved', 'success');
              render();
            } catch (err) {
              console.error('Care plan save error:', err);
              showToast(err.message || 'Failed to save Living Care Plan', 'error');
            }
            break;
          case 'log-checkin':
            const checkInType = target.dataset.type || 'buddy';
            await sb.from('touchpoints').insert({
              case_id: target.dataset.caseId,
              type: checkInType,
              completed_at: new Date().toISOString(),
              completed_by: state.profile.id,
            });
            await loadTouchpoints(state.caseId);
            try { await awardCareXP(getCurrentPetId(), 'touchpoint_completed'); } catch(_) {}
            showToast('Check-in logged', 'success');
            render();
            break;
          case 'escalation-ack':
            if (!['admin', 'vet_buddy'].includes(state.profile.role)) { showToast('Permission denied', 'error'); break; }
            try {
              await sb.from('escalations').update({ status: 'acknowledged' }).eq('id', target.dataset.escalationId);
              await loadEscalations();
              showToast('Escalation acknowledged', 'success');
              render();
            } catch(err) { showToast('Failed to update escalation', 'error'); }
            break;
          case 'escalation-resolve':
            if (!['admin', 'vet_buddy'].includes(state.profile.role)) { showToast('Permission denied', 'error'); break; }
            try {
              await sb.from('escalations').update({ status: 'resolved', resolved_by: state.profile.id, resolved_at: new Date().toISOString() }).eq('id', target.dataset.escalationId);
              await loadEscalations();
              showToast('Escalation resolved', 'success');
              render();
            } catch(err) { showToast('Failed to resolve escalation', 'error'); }
            break;
          // Appointment booking
          case 'new-appointment':
            showToast('Open a case to schedule an appointment', 'info');
            await loadCases();
            await loadTeamMembers();
            navigate('admin-cases');
            break;
          case 'toggle-add-appt':
            state.showAddAppt = !state.showAddAppt;
            render();
            break;
          case 'save-appointment': {
            const title = document.querySelector('[data-field="appt-title"]')?.value.trim();
            const dateVal = document.querySelector('[data-field="appt-date"]')?.value;
            const type = document.querySelector('[data-field="appt-type"]')?.value || 'Video Call';
            const videoUrl = document.querySelector('[data-field="appt-video-url"]')?.value.trim() || null;
            const notes = document.querySelector('[data-field="appt-notes"]')?.value.trim() || null;
            if (!title || !dateVal) { showToast('Title and date are required', 'error'); break; }
            if (new Date(dateVal) < new Date()) { showToast('Cannot schedule appointments in the past', 'error'); break; }
            try {
              const { error } = await sb.from('appointments').insert({ case_id: state.caseId, title, scheduled_at: new Date(dateVal).toISOString(), type, notes, video_url: videoUrl });
              if (error) throw error;
              await sb.from('timeline_entries').insert({ case_id: state.caseId, author_id: state.profile.id, type: 'appointment', content: `Appointment scheduled: ${title} on ${formatDate(dateVal)}`, is_client_visible: true });
              state.showAddAppt = false;
              await loadAppointments(state.caseId);
              await loadTimeline(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'appointment_logged'); } catch(_) {}
              showToast('Appointment scheduled', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save appointment', 'error'); }
            break;
          }
          case 'edit-appointment': {
            state.editingApptId = target.dataset.apptId;
            state.showAddAppt = false;
            render();
            break;
          }
          case 'cancel-edit-appt':
            state.editingApptId = null;
            render();
            break;
          case 'save-edit-appointment': {
            const title = document.querySelector('[data-field="edit-appt-title"]')?.value.trim();
            const dateVal = document.querySelector('[data-field="edit-appt-date"]')?.value;
            const type = document.querySelector('[data-field="edit-appt-type"]')?.value || 'Video Call';
            const videoUrl = document.querySelector('[data-field="edit-appt-video-url"]')?.value.trim() || null;
            const notes = document.querySelector('[data-field="edit-appt-notes"]')?.value.trim() || null;
            if (!title || !dateVal) { showToast('Title and date are required', 'error'); break; }
            try {
              const { error } = await sb.from('appointments').update({ title, scheduled_at: new Date(dateVal).toISOString(), type, notes, video_url: videoUrl }).eq('id', state.editingApptId);
              if (error) throw error;
              await sb.from('timeline_entries').insert({ case_id: state.caseId, author_id: state.profile.id, type: 'appointment', content: `Appointment updated: ${title} on ${formatDate(dateVal)}`, is_client_visible: true });
              state.editingApptId = null;
              await loadAppointments(state.caseId);
              await loadTimeline(state.caseId);
              showToast('Appointment updated', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to update appointment', 'error'); }
            break;
          }
          case 'cancel-appointment': {
            const apptId = target.dataset.apptId;
            const appt = state.appointments.find(a => a.id === apptId);
            if (!appt) break;
            if (!confirm(`Cancel appointment "${appt.title}"? This cannot be undone.`)) break;
            try {
              const { error } = await sb.from('appointments').update({ status: 'cancelled' }).eq('id', apptId);
              if (error) throw error;
              await sb.from('timeline_entries').insert({ case_id: state.caseId, author_id: state.profile.id, type: 'appointment', content: `Appointment cancelled: ${appt.title}`, is_client_visible: true });
              await loadAppointments(state.caseId);
              await loadTimeline(state.caseId);
              showToast('Appointment cancelled', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to cancel appointment', 'error'); }
            break;
          }
          // Timeline entry
          case 'toggle-add-timeline':
            state.showAddTimeline = !state.showAddTimeline;
            render();
            break;
          case 'save-timeline-entry': {
            const type = document.querySelector('[data-field="timeline-type"]')?.value || 'note';
            const content = document.querySelector('[data-field="timeline-content"]')?.value.trim();
            const isVisible = document.querySelector('[data-field="timeline-client-visible"]')?.checked ?? true;
            if (!content) { showToast('Please enter content', 'error'); break; }
            try {
              const { error } = await sb.from('timeline_entries').insert({ case_id: state.caseId, author_id: state.profile.id, type, content, is_client_visible: isVisible });
              if (error) throw error;
              state.showAddTimeline = false;
              await loadTimeline(state.caseId);
              showToast('Timeline entry added', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save entry', 'error'); }
            break;
          }
          // Escalation
          case 'toggle-raise-escalation':
            state.showRaiseEscalation = !state.showRaiseEscalation;
            render();
            break;
          case 'save-escalation': {
            const reason = document.querySelector('[data-field="escalation-reason"]')?.value.trim();
            const escType = document.querySelector('[data-field="escalation-type"]')?.value || 'clinical';
            const incidentNotes = document.querySelector('[data-field="incident-notes"]')?.value.trim() || '';
            if (!reason) { showToast('Please describe the escalation reason', 'error'); break; }
            if (escType === 'adverse_outcome' && !incidentNotes) { showToast('Incident notes are required for adverse outcome escalations', 'error'); break; }
            try {
              const insertData = { case_id: state.caseId, raised_by: state.profile.id, reason, status: 'Open', escalation_type: escType };
              if (incidentNotes) insertData.incident_notes = incidentNotes;
              const { error } = await sb.from('escalations').insert(insertData);
              if (error) throw error;
              const typeLabel = escType === 'adverse_outcome' ? '🔴 Adverse Outcome' : 'Clinical Question';
              await sb.from('timeline_entries').insert({ case_id: state.caseId, author_id: state.profile.id, type: 'escalation', content: `Escalation raised (${typeLabel}): ${reason}`, is_client_visible: false });
              logAudit('create', 'escalation', state.caseId, { reason, type: escType, case_id: state.caseId });
              // Adverse outcome: attempt immediate notification to Dr. Rodgers
              if (escType === 'adverse_outcome') {
                try {
                  await callEdgeFunction('notify-dvm', {
                    type: 'adverse_outcome',
                    case_id: state.caseId,
                    reason,
                    incident_notes: incidentNotes,
                    raised_by: state.profile.name,
                    pet_name: state.currentCase?.pets?.name || 'Unknown',
                  });
                } catch(notifyErr) {
                  console.warn('DVM notification attempt:', notifyErr);
                  // Notification is best-effort — escalation is still saved
                  showToast('⚠️ Escalation saved but could not send immediate notification to Dr. Rodgers. Please contact him directly.', 'warning');
                }
              }
              state.showRaiseEscalation = false;
              await loadTimeline(state.caseId);
              showToast('Escalation raised', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to raise escalation', 'error'); }
            break;
          }
          // ── Living Care Plan actions ──
          case 'toggle-add-care-team':
            state.showAddCareTeam = !state.showAddCareTeam;
            render();
            break;
          case 'save-care-team-member': {
            const name = document.querySelector('[data-field="ct-name"]')?.value.trim();
            if (!name) { showToast('Provider name is required', 'error'); break; }
            const member = {
              name,
              role: document.querySelector('[data-field="ct-role"]')?.value.trim() || '',
              clinic: document.querySelector('[data-field="ct-clinic"]')?.value.trim() || '',
              phone: document.querySelector('[data-field="ct-phone"]')?.value.trim() || '',
              email: document.querySelector('[data-field="ct-email"]')?.value.trim() || '',
            };
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.care_team.push(member);
              const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
              if (state.carePlan?.id) {
                await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
              } else {
                await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
              }
              state.showAddCareTeam = false;
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Provider added to care team', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save provider', 'error'); }
            break;
          }
          case 'remove-care-team': {
            const idx = parseInt(target.dataset.index);
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.care_team.splice(idx, 1);
              await sb.from('care_plans').update({ content: JSON.stringify(lp), updated_at: new Date().toISOString() }).eq('id', state.carePlan.id);
              await loadCarePlan(state.caseId);
              showToast('Provider removed', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to remove provider', 'error'); }
            break;
          }
          case 'toggle-add-goal':
            state.showAddGoal = !state.showAddGoal;
            render();
            break;
          case 'save-new-goal': {
            const goalText = document.querySelector('[data-field="goal-text"]')?.value.trim();
            if (!goalText) { showToast('Please enter a goal', 'error'); break; }
            const setByOwner = document.querySelector('[data-field="goal-set-by-owner"]')?.checked || false;
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.active_care_goals.push({ goal_text: goalText, set_by_owner: setByOwner, created_at: new Date().toISOString(), reviewed_at: null, status: 'active', dvm_reviewed: false });
              const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
              if (state.carePlan?.id) {
                await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
              } else {
                await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
              }
              state.showAddGoal = false;
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Care goal added', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save goal', 'error'); }
            break;
          }
          case 'toggle-goal-status': {
            const gIdx = parseInt(target.dataset.index);
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.active_care_goals[gIdx].status = lp.active_care_goals[gIdx].status === 'completed' ? 'active' : 'completed';
              await sb.from('care_plans').update({ content: JSON.stringify(lp), updated_at: new Date().toISOString() }).eq('id', state.carePlan.id);
              await loadCarePlan(state.caseId);
              showToast('Goal status updated', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to update goal', 'error'); }
            break;
          }
          case 'request-dvm-review': {
            const rIdx = parseInt(target.dataset.index);
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.active_care_goals[rIdx].reviewed_at = new Date().toISOString();
              lp.active_care_goals[rIdx].dvm_reviewed = true;
              await sb.from('care_plans').update({ content: JSON.stringify(lp), updated_at: new Date().toISOString() }).eq('id', state.carePlan.id);
              await loadCarePlan(state.caseId);
              showToast('DVM review marked — Dr. Rodgers has been notified', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to request DVM review', 'error'); }
            break;
          }
          case 'toggle-add-log-entry':
            state.showAddLogEntry = !state.showAddLogEntry;
            render();
            break;
          case 'save-log-entry': {
            const entryText = document.querySelector('[data-field="log-entry-text"]')?.value.trim();
            if (!entryText) { showToast('Please enter a log entry', 'error'); break; }
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.engagement_log.push({ entry_text: entryText, created_by: state.profile?.name, created_at: new Date().toISOString() });
              const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
              if (state.carePlan?.id) {
                await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
              } else {
                await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
              }
              state.showAddLogEntry = false;
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Engagement logged', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save log entry', 'error'); }
            break;
          }
          case 'toggle-add-milestone':
            state.showAddMilestone = !state.showAddMilestone;
            render();
            break;
          case 'save-milestone': {
            const title = document.querySelector('[data-field="milestone-title"]')?.value.trim();
            if (!title) { showToast('Please enter a milestone title', 'error'); break; }
            const desc = document.querySelector('[data-field="milestone-desc"]')?.value.trim() || '';
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp.milestones_and_wins.push({ title, description: desc, created_by: state.profile?.name, created_at: new Date().toISOString() });
              const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
              if (state.carePlan?.id) {
                await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
              } else {
                await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
              }
              state.showAddMilestone = false;
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Milestone saved — way to go! 🎉', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save milestone', 'error'); }
            break;
          }
          case 'export-care-plan': {
            const lp = state.carePlan?.living_plan || emptyLivingCarePlan();
            const petName = state.currentCase?.pets?.name || 'Pet';
            let text = `LIVING CARE PLAN — ${petName}\nExported ${new Date().toLocaleDateString()}\n${'═'.repeat(40)}\n\n`;
            text += `PET PROFILE\n${lp.pet_profile || 'Not yet filled in'}\n\n`;
            text += `CARE TEAM\n${lp.care_team.length ? lp.care_team.map(c => `• ${c.name} (${c.role}) — ${c.clinic || ''} ${c.phone || ''} ${c.email || ''}`).join('\n') : 'No providers added yet'}\n\n`;
            text += `ACTIVE CARE GOALS\n${lp.active_care_goals.length ? lp.active_care_goals.map(g => `• [${g.status}] ${g.goal_text}`).join('\n') : 'No goals set yet'}\n\n`;
            text += `ENGAGEMENT LOG\n${lp.engagement_log.length ? lp.engagement_log.map(e => `• ${e.created_at ? new Date(e.created_at).toLocaleDateString() : ''} — ${e.entry_text}`).join('\n') : 'No entries yet'}\n\n`;
            text += `MILESTONES & WINS\n${lp.milestones_and_wins.length ? lp.milestones_and_wins.map(m => `🌟 ${m.title}${m.description ? ' — ' + m.description : ''}`).join('\n') : 'No milestones yet'}\n`;
            // Copy to clipboard and offer download
            try {
              await navigator.clipboard.writeText(text);
              showToast('Living Care Plan copied to clipboard — paste it anywhere to share!', 'success');
            } catch(e) {
              // Fallback: download as text file
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `Living-Care-Plan-${petName}.txt`; a.click();
              URL.revokeObjectURL(url);
              showToast('Living Care Plan downloaded', 'success');
            }
            break;
          }
          case 'save-living-plan-section': {
            const sectionKey = target.dataset.section;
            const fieldValue = document.querySelector(`[data-field="section-${sectionKey}"]`)?.value || '';
            try {
              const lp = state.carePlan.living_plan || emptyLivingCarePlan();
              lp[sectionKey] = fieldValue;
              const updateData = { content: JSON.stringify(lp), updated_by: state.profile?.id, updated_at: new Date().toISOString() };
              if (state.carePlan?.id) {
                await sb.from('care_plans').update(updateData).eq('id', state.carePlan.id);
              } else {
                await sb.from('care_plans').insert({ case_id: state.caseId, ...updateData });
              }
              await loadCarePlan(state.caseId);
              try { await awardCareXP(getCurrentPetId(), 'care_plan_updated'); } catch(_) {}
              showToast('Living Care Plan saved', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save Living Care Plan', 'error'); }
            break;
          }
          // Profile settings
          case 'nav-profile':
            navigate('profile-settings');
            break;
          case 'pick-avatar-color':
            state.profile.avatar_color = target.dataset.color;
            render();
            break;
          case 'initiate-transition': {
            state.showTransitionPanel = true;
            state.transitionBuddyId = target.dataset.memberId;
            state.transitionBuddyName = target.dataset.memberName || 'Buddy';
            render();
            break;
          }
          case 'cancel-transition':
            state.showTransitionPanel = false;
            state.transitionBuddyId = null;
            render();
            break;
          case 'save-transition': {
            const notes = document.querySelector('[data-field="transition-notes"]')?.value.trim();
            const overlap = document.querySelector('[data-field="transition-overlap"]')?.value || '4';
            if (!notes) { showToast('Please add transition notes before proceeding', 'error'); break; }
            try {
              // Add transition notes to each case assigned to this buddy
              const buddyCases = state.cases.filter(c => c.assigned_buddy_id === state.transitionBuddyId);
              for (const c of buddyCases) {
                await sb.from('timeline_entries').insert({
                  case_id: c.id,
                  author_id: state.profile.id,
                  type: 'update',
                  content: `🔄 Buddy Transition initiated. Overlap period: ${overlap} weeks. Notes: ${notes}`,
                  is_client_visible: false,
                  created_at: new Date().toISOString(),
                });
              }
              state.showTransitionPanel = false;
              state.transitionBuddyId = null;
              showToast(`Transition initiated for ${state.transitionBuddyName} — ${buddyCases.length} case(s) flagged. Overlap period: ${overlap} weeks.`, 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to initiate transition', 'error'); }
            break;
          }
          case 'deactivate-buddy': {
            const memberId = target.dataset.memberId;
            const caseCount = state.cases.filter(c => c.assigned_buddy_id === memberId).length;
            if (caseCount > 0) {
              showToast('Cannot deactivate — this Buddy still has active cases. Initiate a transition first.', 'error');
              break;
            }
            if (!confirm('Deactivate this Buddy? They will lose portal access but their case history is preserved.')) break;
            try {
              await sb.from('users').update({ role: 'deactivated' }).eq('id', memberId);
              await loadTeamMembers();
              showToast('Buddy deactivated. Case history preserved.', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to deactivate', 'error'); }
            break;
          }
          case 'save-profile': {
            const name = document.querySelector('[data-field="profile-name"]')?.value.trim();
            const bio = document.querySelector('[data-field="profile-bio"]')?.value.trim() || null;
            const responseTime = document.querySelector('[data-field="profile-response-time"]')?.value.trim() || null;
            if (!name) { showToast('Name is required', 'error'); break; }
            try {
              const updates = { name, avatar_color: state.profile.avatar_color };
              if (bio !== null) updates.bio = bio;
              if (responseTime !== null) updates.response_time = responseTime;
              // Regenerate initials from name
              updates.avatar_initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              const { error } = await sb.from('users').update(updates).eq('id', state.profile.id);
              if (error) throw error;
              Object.assign(state.profile, updates);
              showToast('Profile updated', 'success');
              render();
            } catch(err) { showToast(err.message || 'Failed to save profile', 'error'); }
            break;
          }
          case 'cancel-profile': {
            const roleRoutes = { client: 'client-dashboard', vet_buddy: 'buddy-dashboard', admin: 'admin-dashboard', external_vet: 'external-dashboard', geneticist: 'geneticist-dashboard' };
            navigate(roleRoutes[state.profile.role] || 'client-dashboard');
            break;
          }
          case 'delete-account': {
            // Two-step confirmation to prevent accidental deletion
            const confirmText = 'DELETE';
            showModal('Delete Account', `
              <p style="margin-bottom:12px;">This will permanently delete your account and all associated data including:</p>
              <ul style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                <li>All your pets and their care plans</li>
                <li>Messages and conversation history</li>
                <li>Medical documents and records</li>
                <li>Subscription and billing data</li>
              </ul>
              <p style="font-weight:600;margin-bottom:8px;">Type <strong>DELETE</strong> to confirm:</p>
              <input type="text" id="delete-confirm-input" placeholder="Type DELETE" style="width:100%;margin-bottom:4px;">
            `, `
              <button class="btn" id="confirm-delete-btn" style="background:var(--red);color:white;border:none;" disabled>Delete My Account</button>
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            `);
            // Enable button only when user types DELETE
            setTimeout(() => {
              const inp = document.getElementById('delete-confirm-input');
              const btn = document.getElementById('confirm-delete-btn');
              if (inp && btn) {
                inp.addEventListener('input', () => { btn.disabled = inp.value.trim() !== confirmText; });
                btn.addEventListener('click', async () => {
                  if (inp.value.trim() !== confirmText) return;
                  btn.textContent = 'Deleting...';
                  btn.disabled = true;
                  try {
                    // Cancel Stripe subscription if active
                    if (state.profile.stripe_customer_id) {
                      try { await callEdgeFunction('stripe-billing-portal', { return_url: window.location.origin }); } catch(_) {}
                    }
                    // Delete user data in order (respecting foreign keys)
                    const userId = state.profile.id;
                    const petIds = (state.cases || []).map(c => c.pets?.id).filter(Boolean);
                    const caseIds = (state.cases || []).map(c => c.id);

                    if (caseIds.length > 0) {
                      await Promise.all([
                        sb.from('messages').delete().in('case_id', caseIds),
                        sb.from('timeline_entries').delete().in('case_id', caseIds),
                        sb.from('touchpoints').delete().in('case_id', caseIds),
                        sb.from('appointments').delete().in('case_id', caseIds),
                        sb.from('case_documents').delete().in('case_id', caseIds),
                        sb.from('case_notes').delete().in('case_id', caseIds),
                        sb.from('care_plans').delete().in('case_id', caseIds),
                        sb.from('escalations').delete().in('case_id', caseIds),
                        sb.from('case_access').delete().in('case_id', caseIds),
                        sb.from('client_surveys').delete().in('case_id', caseIds),
                        sb.from('genetic_insights').delete().in('case_id', caseIds),
                      ]);
                      await sb.from('cases').delete().in('id', caseIds);
                    }
                    if (petIds.length > 0) {
                      await Promise.all([
                        sb.from('pet_vitals').delete().in('pet_id', petIds),
                        sb.from('pet_medications').delete().in('pet_id', petIds),
                        sb.from('pet_vaccines').delete().in('pet_id', petIds),
                        sb.from('pet_care_level').delete().in('pet_id', petIds),
                        sb.from('pet_badges').delete().in('pet_id', petIds),
                        sb.from('pet_co_owners').delete().in('pet_id', petIds),
                        sb.from('care_requests').delete().in('pet_id', petIds),
                      ]);
                      await sb.from('pets').delete().in('id', petIds);
                    }
                    await Promise.all([
                      sb.from('kb_messages').delete().in('conversation_id', (await sb.from('kb_conversations').select('id').eq('user_id', userId)).data?.map(c => c.id) || []),
                      sb.from('notification_preferences').delete().eq('user_id', userId),
                      sb.from('push_subscriptions').delete().eq('user_id', userId),
                      sb.from('user_care_stats').delete().eq('user_id', userId),
                      sb.from('user_badges').delete().eq('user_id', userId),
                      sb.from('pending_invites').delete().eq('invited_by', userId),
                    ]);
                    await sb.from('kb_conversations').delete().eq('user_id', userId);
                    await sb.from('users').delete().eq('id', userId);

                    closeModal();
                    await sb.auth.signOut({ scope: 'local' });
                    state.user = null;
                    state.profile = null;
                    navigate('login');
                    render();
                    showToast('Your account has been deleted.', 'success');
                  } catch(err) {
                    console.error('Account deletion error:', err);
                    showToast('Failed to delete account: ' + (err.message || 'Unknown error'), 'error');
                    btn.textContent = 'Delete My Account';
                    btn.disabled = false;
                  }
                });
              }
            }, 100);
            break;
          }
          case 'open-resource': {
            const resCard = target.closest('.resource-card');
            const resTitle = resCard?.querySelector('.resource-title')?.textContent;
            const resIcon = resCard?.querySelector('.resource-icon')?.textContent;
            if (resTitle && RESOURCE_DOCUMENTS[resTitle]) {
              showResourceDocument(resTitle, resIcon);
            } else {
              showToast('Resource document not available', 'info');
            }
            break;
          }

          // ── Attach file in messages ──
          case 'attach-file':
            document.getElementById('msg-file-input')?.click();
            break;

          // ── Document vault ──
          case 'trigger-doc-upload':
            document.getElementById('doc-upload-input')?.click();
            break;
          case 'toggle-genetic-flag': {
            const docId = target.dataset.docId;
            const isGenetic = target.dataset.isGenetic === '1';
            if (!docId) break;
            try {
              await sb.from('case_documents').update({ is_genetic: !isGenetic }).eq('id', docId);
              await loadDocuments(state.caseId);
              showToast(!isGenetic ? '🧬 Marked as genetic record — Dr. El Hamidi Hay can now access this case' : 'Genetic flag removed', 'success');
              render();
            } catch(err) { showToast('Update failed: ' + (err.message || 'Error'), 'error'); }
            break;
          }
          case 'delete-doc': {
            const docId = target.dataset.docId;
            if (!docId) break;
            try {
              await sb.from('case_documents').delete().eq('id', docId);
              await loadDocuments(state.caseId);
              showToast('File deleted', 'success');
              render();
            } catch(err) { showToast('Delete failed', 'error'); }
            break;
          }

          // ── AI Medical Record Extraction ──
          case 'apply-ai-extraction': {
            if (!state.aiExtractionResult) break;
            target.disabled = true;
            target.textContent = 'Applying...';
            try {
              await applyAiExtraction();
            } catch (err) {
              showToast('Failed to apply: ' + (err.message || 'Error'), 'error');
              target.disabled = false;
              target.textContent = 'Apply to Care Plan';
            }
            break;
          }
          case 'skip-ai-extraction':
            state.showAiReviewModal = false;
            state.aiExtractionResult = null;
            state.aiExtractionDocId = null;
            state.aiCheckedItems = {};
            render();
            break;
          case 'ai-analyze-doc': {
            const docId = target.dataset.docId;
            const doc = (state.documents || []).find(d => d.id === docId);
            if (!doc || !state.caseId) break;
            state.aiExtractionInProgress = true;
            render();
            try {
              await triggerAiExtraction(doc, state.caseId);
            } catch (err) {
              showToast('AI analysis failed: ' + (err.message || 'Error'), 'error');
              state.aiExtractionInProgress = false;
              render();
            }
            break;
          }

          // ── Toggle case tabs (load docs when switching to files) ──

          // ── Pet profile editing ──
          case 'toggle-edit-pet':
            state.showEditPet = !state.showEditPet;
            render();
            break;
          case 'save-pet-profile': {
            const petId = target.dataset.petId;
            if (!petId) break;
            try {
              const weight = document.querySelector('[data-field="pet-weight"]')?.value.trim() || null;
              const dob = document.querySelector('[data-field="pet-dob"]')?.value || null;
              const notes = document.querySelector('[data-field="pet-notes"]')?.value.trim() || null;
              const { error } = await sb.from('pets').update({ weight, dob, notes }).eq('id', petId);
              if (error) throw error;
              state.showEditPet = false;
              await loadCase(state.caseId);
              showToast('Pet profile updated! 🐾', 'success');
              render();
            } catch(err) { showToast('Failed to save: ' + (err.message || 'Error'), 'error'); }
            break;
          }

          case 'delete-pet': {
            const petId = target.dataset.petId;
            const petName = target.dataset.petName || 'this pet';
            if (!petId) break;
            if (!confirm(`Are you sure you want to remove ${petName}? This will permanently delete all of ${petName}'s data including messages, care plans, appointments, and medical records. This cannot be undone.`)) break;
            // Double-confirm for safety
            if (!confirm(`This is permanent. Type OK to confirm you want to delete ${petName} and all associated data.`)) break;
            try {
              const { error } = await sb.from('pets').delete().eq('id', petId);
              if (error) throw error;
              // Clean up state
              state.showEditPet = false;
              state.currentCase = null;
              state.caseId = null;
              state.appointments = [];
              state.messages = [];
              if (state.realtimeChannel) { sb.removeChannel(state.realtimeChannel); state.realtimeChannel = null; }
              // Reload cases and navigate back
              await loadCases();
              if (state.cases.length > 0) {
                state.activePetIndex = 0;
                navigate('client-dashboard');
              } else {
                navigate('client-dashboard');
              }
              showToast(`${petName} has been removed`, 'success');
              render();
            } catch(err) { showToast('Failed to delete: ' + (err.message || 'Error'), 'error'); }
            break;
          }

          // ── Notifications ──
          case 'toggle-notifications':
            state.showNotifications = !state.showNotifications;
            if (state.showNotifications) {
              await loadAllUnreadMessages(); // also syncs state.unreadCount
            }
            render();
            // Close panel when clicking outside
            if (state.showNotifications) {
              setTimeout(() => {
                const handler = function(e) {
                  if (!e.target.closest('.notif-panel') && !e.target.closest('[data-action="toggle-notifications"]')) {
                    state.showNotifications = false;
                    render();
                    document.removeEventListener('click', handler);
                  }
                };
                document.addEventListener('click', handler);
              }, 100);
            }
            break;

          // ── Broadcast messaging ──
          case 'toggle-broadcast':
            state.showBroadcast = !state.showBroadcast;
            render();
            break;
          case 'close-broadcast':
            state.showBroadcast = false;
            render();
            break;
          case 'show-grant-trial':
            if (state.profile?.role !== 'admin') { showToast('Not authorized', 'error'); break; }
            state.showGrantTrial = true;
            render();
            break;
          case 'close-grant-trial':
            state.showGrantTrial = false;
            render();
            break;
          case 'confirm-grant-trial': {
            const trialEmail = document.querySelector('[data-field="grant-trial-email"]')?.value.trim();
            if (!trialEmail) { showToast('Please enter a client email', 'error'); break; }
            target.textContent = 'Granting…';
            target.disabled = true;
            try {
              const { data: clientUser, error: findErr } = await sb.from('users').select('id, name, subscription_status').eq('email', trialEmail).single();
              if (findErr || !clientUser) throw new Error('No client found with that email');
              if (clientUser.subscription_status === 'active') { showToast(`${esc(clientUser.name || trialEmail)} already has an active subscription`, 'error'); target.textContent = `Grant ${TRIAL_DURATION_DAYS}-Day Trial`; target.disabled = false; break; }
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);
              const { error: updateErr } = await sb.from('users').update({
                subscription_status: 'trialing',
                trial_ends_at: trialEnd.toISOString(),
              }).eq('id', clientUser.id);
              if (updateErr) throw updateErr;
              state.showGrantTrial = false;
              showToast(`🎉 ${TRIAL_DURATION_DAYS}-day trial granted to ${clientUser.name || trialEmail}!`, 'success');
              render();
            } catch (err) {
              showToast(err.message || 'Could not grant trial', 'error');
              target.textContent = `Grant ${TRIAL_DURATION_DAYS}-Day Trial`;
              target.disabled = false;
            }
            break;
          }
          case 'send-broadcast': {
            if (state.profile?.role !== 'admin') { showToast('Not authorized', 'error'); break; }
            const msg = document.querySelector('[data-field="broadcast-message"]')?.value.trim();
            const tierFilter = document.querySelector('[data-field="broadcast-tier"]')?.value || 'all';
            const scheduleDate = document.querySelector('[data-field="broadcast-schedule"]')?.value;
            if (!msg) { showToast('Message is required', 'error'); break; }

            // If scheduled for later, store and set a timer
            if (scheduleDate) {
              const scheduledTime = new Date(scheduleDate);
              if (scheduledTime <= new Date()) { showToast('Scheduled time must be in the future', 'error'); break; }
              const delay = scheduledTime.getTime() - Date.now();
              const broadcastData = { msg, tierFilter, senderId: state.profile.id, role: state.profile.role };
              // Store scheduled broadcast in state
              if (!state.scheduledBroadcasts) state.scheduledBroadcasts = [];
              const broadcastEntry = { ...broadcastData, scheduledAt: scheduledTime.toISOString(), id: Date.now().toString() };
              state.scheduledBroadcasts.push(broadcastEntry);
              // Set timer to execute
              setTimeout(async () => {
                try {
                  const targetCases = broadcastData.tierFilter === 'all' ? state.cases : state.cases.filter(c => c.subscription_tier === broadcastData.tierFilter);
                  let sent = 0;
                  for (const c of targetCases) {
                    await sb.from('messages').insert({ case_id: c.id, sender_id: broadcastData.senderId, content: `📢 [Broadcast] ${broadcastData.msg}`, sender_role: broadcastData.role, thread_type: 'client', created_at: new Date().toISOString() });
                    sent++;
                  }
                  showToast(`Scheduled broadcast sent to ${sent} cases! 📢`, 'success');
                  // Remove from scheduled list
                  if (state.scheduledBroadcasts) state.scheduledBroadcasts = state.scheduledBroadcasts.filter(b => b.id !== broadcastEntry.id);
                  render();
                } catch(err) { showToast('Scheduled broadcast failed: ' + (err.message || 'Error'), 'error'); }
              }, delay);
              state.showBroadcast = false;
              showToast(`Broadcast scheduled for ${formatDate(scheduledTime.toISOString())} ⏰`, 'success');
              render();
              break;
            }

            // Send immediately
            try {
              const targetCases = tierFilter === 'all' ? state.cases : state.cases.filter(c => c.subscription_tier === tierFilter);
              let sent = 0;
              for (const c of targetCases) {
                await sb.from('messages').insert({ case_id: c.id, sender_id: state.profile.id, content: `📢 [Broadcast] ${msg}`, sender_role: state.profile.role, thread_type: 'client', created_at: new Date().toISOString() });
                sent++;
              }
              state.showBroadcast = false;
              showToast(`Broadcast sent to ${sent} cases! 📢`, 'success');
              render();
            } catch(err) { showToast('Broadcast failed: ' + (err.message || 'Error'), 'error'); }
            break;
          }

          // ── Satisfaction rating ──
          case 'rate-touchpoint': {
            const tpId = target.dataset.tpId;
            const rating = parseInt(target.dataset.rating);
            if (!tpId || !rating) break;
            try {
              await sb.from('touchpoints').update({ satisfaction_rating: rating }).eq('id', tpId);
              await loadTouchpoints(state.caseId);
              showToast(`Thanks for your feedback! ${'⭐'.repeat(rating)}`, 'success');
              render();
            } catch(err) { showToast('Failed to save rating', 'error'); }
            break;
          }

          // ── External vet invite ──
          case 'toggle-invite-vet':
            state.showInviteVet = !state.showInviteVet;
            render();
            break;
          case 'save-invite-vet': {
            const inviteCaseId = target.dataset.caseId;
            const firstName = document.querySelector('[data-field="invite-first"]')?.value.trim();
            const lastName = document.querySelector('[data-field="invite-last"]')?.value.trim();
            const email = document.querySelector('[data-field="invite-email"]')?.value.trim();
            const inviteMsg = document.querySelector('[data-field="invite-message"]')?.value.trim() || null;
            if (!email || !firstName) { showToast('First name and email are required', 'error'); break; }
            try {
              await sb.from('pending_invites').insert({
                case_id: inviteCaseId,
                email,
                first_name: firstName,
                last_name: lastName || null,
                message: inviteMsg,
                invited_by: state.profile.id,
              });
              state.showInviteVet = false;
              showToast(`Invite sent to ${firstName} (${email}) 👩‍⚕️`, 'success');
              render();
            } catch(err) { showToast('Failed to send invite: ' + (err.message || 'Error'), 'error'); }
            break;
          }

          // ── Admin CSV export ──
          case 'export-csv': {
            const rows = [['Pet', 'Species', 'Owner', 'Buddy', 'Tier', 'Status', 'Updated']];
            for (const c of state.cases) {
              rows.push([
                c.pets?.name || '',
                c.pets?.species || '',
                c.pets?.owner?.name || '',
                c.assigned_buddy?.name || '',
                c.subscription_tier || '',
                c.status || '',
                c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '',
              ]);
            }
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vet-buddies-cases-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('CSV downloaded ⬇️', 'success');
            break;
          }

          // ── NEW FEATURE HANDLERS ────────────────────────────

          // NAV: new pages
          case 'nav-health-summary':
            if (state.caseId) {
              await Promise.all([
                loadPetMedications(state.currentCase?.pets?.id),
                loadPetVaccines(state.currentCase?.pets?.id),
                loadCarePlan(state.caseId),
              ]);
            }
            navigate('health-summary');
            break;
          case 'nav-referral':
            await ensureReferralCode();
            navigate('referral');
            break;
          case 'nav-buddy-availability':
            await loadBuddyAvailability();
            navigate('buddy-availability');
            break;
          case 'nav-canned-responses':
            await loadCannedResponses();
            navigate('canned-responses');
            break;
          case 'nav-touchpoint-templates':
            await loadTouchpointTemplates();
            navigate('touchpoint-templates');
            break;
          case 'nav-admin-analytics':
            await loadAnalytics();
            navigate('admin-analytics');
            break;
          case 'nav-admin-pipeline':
            await loadCases();
            navigate('admin-pipeline');
            break;
          case 'nav-admin-sla':
            await loadCases();
            navigate('admin-sla');
            break;
          case 'nav-admin-reengagement':
            await loadCases();
            navigate('admin-reengagement');
            break;
          case 'nav-admin-create-case': {
            // Load clients list for the dropdown
            const { data: clientsList } = await sb.from('users').select('id, name, email').eq('role', 'client').order('name');
            state.allClients = clientsList || [];
            await loadTeamMembers();
            navigate('admin-create-case');
            break;
          }

          // CASE TAB: lazy-load new tabs
          case 'switch-case-tab':
            state.caseTab = target.dataset.tab;
            if (state.caseTab === 'files' && state.caseId) await loadDocuments(state.caseId);
            if (state.caseTab === 'medications' && state.currentCase?.pets?.id) await loadPetMedications(state.currentCase.pets.id);
            if (state.caseTab === 'vitals' && state.currentCase?.pets?.id) await loadPetVitals(state.currentCase.pets.id);
            if (state.caseTab === 'vaccines' && state.currentCase?.pets?.id) await loadPetVaccines(state.currentCase.pets.id);
            if (state.caseTab === 'notes' && state.caseId) await loadCaseNotes(state.caseId);
            if (state.caseTab === 'touchpoints' && state.caseId) await loadTouchpoints(state.caseId);
            render();
            if (state.caseTab === 'messages') scrollMessagesToBottom();
            break;

          // MEDICATIONS
          case 'toggle-add-med':
            state.showAddMed = !state.showAddMed;
            render();
            break;
          case 'save-medication': {
            const name = document.querySelector('[data-field="med-name"]')?.value?.trim();
            const dose = document.querySelector('[data-field="med-dose"]')?.value?.trim();
            const frequency = document.querySelector('[data-field="med-frequency"]')?.value?.trim();
            const startDate = document.querySelector('[data-field="med-start"]')?.value;
            const endDate = document.querySelector('[data-field="med-end"]')?.value;
            if (!name) { showToast('Medication name required', 'error'); break; }
            if (name.length > 200) { showToast('Medication name is too long', 'error'); break; }
            if (dose && !/^[\d.,]+\s*[a-zA-Z/%]*$/.test(dose)) { showToast('Dose format looks invalid (e.g. "250mg", "5ml")', 'error'); break; }
            if (endDate && startDate && new Date(endDate) < new Date(startDate)) { showToast('End date cannot be before start date', 'error'); break; }
            target.disabled = true;
            try {
              await sb.from('pet_medications').insert({ pet_id: target.dataset.petId, case_id: target.dataset.caseId, name, dose, frequency, start_date: startDate || null, end_date: endDate || null, added_by: state.profile.id });
              await loadPetMedications(target.dataset.petId);
              try { await awardCareXP(target.dataset.petId, 'medication_logged'); } catch(_) {}
              try { await logCareTeamActivity(target.dataset.petId, 'logged a medication: ' + name); } catch(_) {}
              state.showAddMed = false;
              showToast('Medication added', 'success');
              render();
            } catch (err) { showToast('Failed to add medication', 'error'); target.disabled = false; }
            break;
          }
          case 'deactivate-med': {
            try {
              await sb.from('pet_medications').update({ is_active: false }).eq('id', target.dataset.medId);
              await loadPetMedications(state.currentCase?.pets?.id);
              showToast('Medication discontinued', 'success');
              render();
            } catch (err) { showToast('Failed to update medication', 'error'); }
            break;
          }

          // VITALS
          case 'toggle-add-vitals':
            state.showAddVitals = !state.showAddVitals;
            render();
            break;
          case 'save-vitals': {
            const weight = document.querySelector('[data-field="vital-weight"]')?.value?.trim();
            const temp = document.querySelector('[data-field="vital-temp"]')?.value?.trim();
            const vNotes = document.querySelector('[data-field="vital-notes"]')?.value?.trim();
            if (!weight && !temp) { showToast('Enter at least one value', 'error'); break; }
            if (weight && (isNaN(parseFloat(weight)) || parseFloat(weight) <= 0 || parseFloat(weight) > 2000)) { showToast('Weight must be a number between 0 and 2000 lbs', 'error'); break; }
            if (temp && (isNaN(parseFloat(temp)) || parseFloat(temp) < 90 || parseFloat(temp) > 115)) { showToast('Temperature must be between 90°F and 115°F', 'error'); break; }
            target.disabled = true;
            try {
              await sb.from('pet_vitals').insert({ pet_id: target.dataset.petId, weight: weight || null, temperature: temp || null, notes: vNotes || null, recorded_by: state.profile.id });
              await loadPetVitals(target.dataset.petId);
              try { await awardCareXP(target.dataset.petId, 'vital_recorded'); } catch(_) {}
              try { await logCareTeamActivity(target.dataset.petId, 'logged a vitals check' + (weight ? ': ' + weight + ' lbs' : '')); } catch(_) {}
              state.showAddVitals = false;
              showToast('Vitals recorded', 'success');
              render();
            } catch (err) { showToast('Failed to record vitals', 'error'); target.disabled = false; }
            break;
          }

          // VACCINES
          case 'toggle-add-vaccine':
            state.showAddVaccine = !state.showAddVaccine;
            render();
            break;
          case 'save-vaccine': {
            const vName = document.querySelector('[data-field="vaccine-name"]')?.value?.trim();
            const vDate = document.querySelector('[data-field="vaccine-date"]')?.value;
            const vDue = document.querySelector('[data-field="vaccine-due"]')?.value;
            const vNotes2 = document.querySelector('[data-field="vaccine-notes"]')?.value?.trim();
            if (!vName) { showToast('Vaccine name required', 'error'); break; }
            if (vName.length > 200) { showToast('Vaccine name is too long', 'error'); break; }
            if (vDate && new Date(vDate) > new Date()) { showToast('Administration date cannot be in the future', 'error'); break; }
            if (vDue && vDate && new Date(vDue) <= new Date(vDate)) { showToast('Next due date must be after administration date', 'error'); break; }
            target.disabled = true;
            try {
              await sb.from('pet_vaccines').insert({ pet_id: target.dataset.petId, name: vName, administered_date: vDate || null, due_date: vDue || null, notes: vNotes2 || null, added_by: state.profile.id });
              await loadPetVaccines(target.dataset.petId);
              try { await awardCareXP(target.dataset.petId, 'vaccine_recorded'); } catch(_) {}
              try { await logCareTeamActivity(target.dataset.petId, 'recorded a vaccine: ' + vName); } catch(_) {}
              state.showAddVaccine = false;
              showToast('Vaccine added', 'success');
              render();
            } catch (err) { showToast('Failed to add vaccine', 'error'); target.disabled = false; }
            break;
          }

          // CASE NOTES
          case 'toggle-add-note':
            state.showAddNote = !state.showAddNote;
            render();
            break;
          case 'save-case-note': {
            const noteContent = document.querySelector('[data-field="note-content"]')?.value?.trim();
            if (!noteContent) { showToast('Note cannot be empty', 'error'); break; }
            try {
              await sb.from('case_notes').insert({ case_id: target.dataset.caseId, content: noteContent, created_by: state.profile.id });
              await loadCaseNotes(target.dataset.caseId);
              state.showAddNote = false;
              showToast('Note saved', 'success');
              render();
            } catch (err) { showToast('Failed to save note', 'error'); }
            break;
          }

          // BUDDY AVAILABILITY
          case 'toggle-availability':
            state.showAvailability = !state.showAvailability;
            render();
            break;
          case 'save-availability': {
            const aStart = document.querySelector('[data-field="avail-start"]')?.value;
            const aEnd = document.querySelector('[data-field="avail-end"]')?.value;
            const aReason = document.querySelector('[data-field="avail-reason"]')?.value?.trim();
            if (!aStart || !aEnd) { showToast('Please set start and end dates', 'error'); break; }
            try {
              await sb.from('buddy_availability').insert({ buddy_id: state.profile.id, start_date: aStart, end_date: aEnd, reason: aReason || null });
              await loadBuddyAvailability();
              state.showAvailability = false;
              showToast('Time off saved', 'success');
              render();
            } catch (err) { showToast('Failed to save availability', 'error'); }
            break;
          }
          case 'delete-availability': {
            await sb.from('buddy_availability').delete().eq('id', target.dataset.availId);
            await loadBuddyAvailability();
            showToast('Removed', 'success');
            render();
            break;
          }

          // TOUCHPOINT TEMPLATES
          case 'use-template': {
            const tmpl = state.touchpointTemplates.find(t => t.id === target.dataset.templateId);
            if (tmpl) {
              state.caseTab = 'touchpoints';
              navigate(state.view);
              setTimeout(() => { const ta = document.querySelector('[data-field="touchpoint-note"]'); if (ta) { ta.value = tmpl.content; ta.focus(); } }, 100);
            }
            break;
          }

          // CANNED RESPONSES
          case 'toggle-canned-responses':
            state.showCannedResponses = !state.showCannedResponses;
            if (state.showCannedResponses) await loadCannedResponses();
            render();
            if (state.caseTab === 'messages') scrollMessagesToBottom();
            break;
          case 'insert-canned': {
            const cannedContent = decodeURIComponent(target.dataset.content || '');
            const msgInputEl = document.querySelector('[data-field="message-input"]');
            if (msgInputEl) { msgInputEl.value = cannedContent; msgInputEl.focus(); }
            state.showCannedResponses = false;
            render();
            break;
          }
          case 'delete-canned': {
            await sb.from('canned_responses').delete().eq('id', target.dataset.cannedId);
            await loadCannedResponses();
            showToast('Deleted', 'success');
            render();
            break;
          }
          case 'show-add-canned': {
            showModal('Add Canned Response', `
              <div class="form-group"><label>Shortcut (e.g. /thanks)</label><input type="text" id="canned-shortcut-input" placeholder="/thanks" style="width:100%;"></div>
              <div class="form-group"><label>Response text</label><textarea id="canned-content-input" placeholder="Thank you for the update!" style="width:100%;height:80px;"></textarea></div>
            `, `
              <button class="btn btn-primary" id="save-canned-btn">Save</button>
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            `);
            setTimeout(() => {
              document.getElementById('save-canned-btn')?.addEventListener('click', async () => {
                const sc = document.getElementById('canned-shortcut-input')?.value?.trim();
                const ct = document.getElementById('canned-content-input')?.value?.trim();
                if (!sc || !ct) { showToast('Both fields are required', 'error'); return; }
                await sb.from('canned_responses').insert({ shortcut: sc, content: ct, created_by: state.profile.id });
                await loadCannedResponses();
                closeModal();
                showToast('Canned response saved', 'success');
                render();
              });
            }, 50);
            break;
          }

          // THREAD SWITCHER
          case 'switch-thread':
            state.messageThread = target.dataset.thread || 'client';
            render();
            scrollMessagesToBottom();
            break;

          // VOICE MEMO
          case 'toggle-voice-record': {
            const btn = document.getElementById('voice-record-btn');
            if (!window._mediaRecorder) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);
                const chunks = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = async () => {
                  const blob = new Blob(chunks, { type: 'audio/webm' });
                  window._pendingAttachment = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                  stream.getTracks().forEach(t => t.stop());
                  window._mediaRecorder = null;
                  render();
                  showToast('Voice memo ready to send', 'success');
                };
                recorder.start();
                window._mediaRecorder = recorder;
                if (btn) btn.classList.add('recording');
              } catch (err) { showToast('Microphone access denied', 'error'); }
            } else {
              window._mediaRecorder.stop();
              if (btn) btn.classList.remove('recording');
            }
            break;
          }
          case 'toggle-urgency':
            state.urgencyToggle = !state.urgencyToggle;
            render();
            break;
          case 'clear-attachment':
            window._pendingAttachment = null;
            render();
            break;
          case 'clear-voice':
            window._pendingVoice = null;
            window._pendingAttachment = null;
            render();
            break;

          // SEND MESSAGE — updated to include thread_type
          case 'send-message': {
            // Gate write actions for expired trial (read-only mode)
            if (state.profile?.role === 'client' && !hasWriteAccess(state.profile)) {
              showToast('Subscribe to a plan to send messages to your Buddy.', 'error');
              break;
            }
            const msgInput = document.querySelector('[data-field="message-input"]');
            const content = msgInput?.value.trim();
            const hasAttachment = !!window._pendingAttachment;
            if ((!content && !hasAttachment) || !state.caseId) break;
            target.disabled = true;
              try {
                let attachmentUrl = null, attachmentName = null;
                if (window._pendingAttachment) {
                  const file = window._pendingAttachment;
                  const path = `messages/${state.caseId}/${Date.now()}_${file.name}`;
                  const { error: upErr } = await sb.storage.from('case-files').upload(path, file, { upsert: false });
                  if (upErr) throw upErr;
                  const { data: urlData } = await sb.storage.from('case-files').createSignedUrl(path, 60 * 60 * 24 * 7); // 7-day signed URL
                  attachmentUrl = urlData.signedUrl;
                  attachmentName = file.name;
                  window._pendingAttachment = null;
                }
                const threadType = state.messageThread || 'client';
                const isUrgentMsg = state.urgencyToggle || false;
                const { data: newMsg, error: msgErr } = await sb.from('messages').insert({
                  case_id: state.caseId,
                  sender_id: state.profile.id,
                  content: content || '',
                  sender_role: state.profile.role,
                  attachment_url: attachmentUrl,
                  attachment_name: attachmentName,
                  thread_type: threadType,
                  is_urgent: isUrgentMsg,
                  created_at: new Date().toISOString(),
                }).select('id, case_id, sender_id, content, sender_role, is_read_by_staff, is_read_by_buddy, is_read_by_client, thread_type, read_at, created_at, attachment_url, attachment_name, is_urgent').single();
                if (msgErr) throw msgErr;
                state.messages.push({ ...newMsg, sender: { id: state.profile.id, name: state.profile.name, role: state.profile.role, avatar_initials: state.profile.avatar_initials, avatar_color: state.profile.avatar_color } });
                try { await awardCareXP(getCurrentPetId(), 'message_sent'); } catch(_) {}
                try { await logCareTeamActivity(getCurrentPetId(), 'sent a message'); } catch(_) {}
                logAudit('create', 'message', newMsg.id, { case_id: state.caseId, role: state.profile.role });
                if (msgInput) msgInput.value = '';
                state.urgencyToggle = false;
                state.showCannedResponses = false;
                sendTypingPresence(false);
                clearTimeout(state._typingTimeout);
                render();
                scrollMessagesToBottom();
                // Update last_client_message_at when client sends a message
                if (state.profile.role === 'client') {
                  await sb.from('cases').update({ last_client_message_at: new Date().toISOString() }).eq('id', state.caseId);
                }
                // Trigger push notification to the other party (best-effort, don't block)
                callEdgeFunction('send-push-notification', {
                  sender_id: state.profile.id,
                  sender_role: state.profile.role,
                  case_id: state.caseId,
                  content: content || '',
                  sender_name: state.profile.name,
                }).catch(e => console.warn('Push notification failed:', e));
                // Mark client messages as read only for the responding role
                if (state.profile.role === 'admin') {
                  await sb.from('messages').update({ is_read_by_staff: true, read_at: new Date().toISOString() }).eq('case_id', state.caseId).eq('sender_role', 'client').eq('is_read_by_staff', false);
                } else if (state.profile.role === 'vet_buddy') {
                  await sb.from('messages').update({ is_read_by_buddy: true, read_at: new Date().toISOString() }).eq('case_id', state.caseId).eq('sender_role', 'client').eq('is_read_by_buddy', false);
                }
              } catch (err) {
                console.error(err);
                showToast('Failed to send message', 'error');
                target.disabled = false;
              }
            break;
          }

          // QUICK QUESTION
          case 'send-quick-question': {
            showModal('Quick Question', `
              <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Short questions get faster responses from your Buddy.</p>
              <textarea id="quick-question-input" placeholder="What's your question?" style="width:100%;height:80px;" maxlength="500"></textarea>
            `, `
              <button class="btn btn-primary" id="send-qq-btn">Send</button>
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            `);
            setTimeout(() => {
              document.getElementById('quick-question-input')?.focus();
              document.getElementById('send-qq-btn')?.addEventListener('click', async () => {
                const qq = document.getElementById('quick-question-input')?.value?.trim();
                if (!qq) { showToast('Please enter a question', 'error'); return; }
                closeModal();
                try {
                  await sb.from('messages').insert({ case_id: state.caseId, sender_id: state.profile.id, content: `❓ Quick Question: ${qq}`, sender_role: state.profile.role, message_type: 'quick_question', thread_type: 'client', created_at: new Date().toISOString() });
                  await loadMessages(state.caseId);
                  try { await awardCareXP(getCurrentPetId(), 'message_sent'); } catch(_) {}
                  showToast('Quick question sent!', 'success');
                  render();
                  scrollMessagesToBottom();
                } catch (err) { showToast('Failed to send', 'error'); }
              });
            }, 50);
            break;
          }

          // VIDEO CALL AUTO-LINK
          case 'generate-video-link': {
            const roomId = `vetbuddies-${state.caseId?.substring(0,8)}-${Date.now()}`;
            const videoUrl = `https://meet.jit.si/${roomId}`;
            const apptId = target.dataset.apptId;
            if (apptId) {
              await sb.from('appointments').update({ video_url: videoUrl }).eq('id', apptId);
              await loadAppointments(state.caseId);
              showToast('Video link generated!', 'success');
              render();
            }
            break;
          }

          // PAGINATION
          case 'paginate': {
            const key = target.dataset.key;
            const page = parseInt(target.dataset.page);
            if (key && pagination.hasOwnProperty(key) && !isNaN(page)) {
              pagination[key] = page;
              render();
            }
            break;
          }

          // READ RECEIPTS — mark client messages as read when staff opens case
          // (happens in loadMessages above, but also on explicit action)
          case 'mark-messages-read': {
            if (state.caseId && state.profile.role === 'admin') {
              await sb.from('messages').update({ is_read_by_staff: true, read_at: new Date().toISOString() }).eq('case_id', state.caseId).eq('sender_role', 'client').eq('is_read_by_staff', false);
              await loadUnreadCount();
              render();
            } else if (state.caseId && state.profile.role === 'vet_buddy') {
              await sb.from('messages').update({ is_read_by_buddy: true, read_at: new Date().toISOString() }).eq('case_id', state.caseId).eq('sender_role', 'client').eq('is_read_by_buddy', false);
              await loadUnreadCount();
              render();
            }
            break;
          }

          case 'forgot-password': {
            const email = document.querySelector('[data-field="signin-email"]')?.value?.trim();
            if (email) {
              // Email already filled in — send reset directly
              try {
                const { error } = await sb.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + '/?reset=true',
                });
                if (error) throw error;
                showToast('Password reset email sent — check your inbox!', 'success');
              } catch (err) {
                showToast(err.message || 'Failed to send reset email', 'error');
              }
            } else {
              // No email in the field — show modal to enter email
              showModal('Reset Password', `
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Enter your email address and we'll send you a reset link.</p>
                <input type="email" id="reset-email-input" placeholder="you@example.com" style="width:100%;">
              `, `
                <button class="btn btn-primary" id="send-reset-btn">Send Reset Link</button>
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              `);
              setTimeout(() => {
                document.getElementById('reset-email-input')?.focus();
                document.getElementById('send-reset-btn')?.addEventListener('click', async () => {
                  const addr = document.getElementById('reset-email-input')?.value?.trim();
                  if (!addr) { showToast('Please enter your email', 'error'); return; }
                  try {
                    const { error } = await sb.auth.resetPasswordForEmail(addr, {
                      redirectTo: window.location.origin + '/?reset=true',
                    });
                    if (error) throw error;
                    closeModal();
                    showToast('Password reset email sent — check your inbox!', 'success');
                  } catch (err) {
                    showToast(err.message || 'Failed to send reset email', 'error');
                  }
                });
              }, 50);
            }
            break;
          }
          case 'signout':
            await handleSignOut();
            break;
          case 'toggle-sidebar':
            state.sidebarOpen = !state.sidebarOpen;
            render();
            break;
          case 'close-sidebar':
            state.sidebarOpen = false;
            render();
            break;
        }
      });

      // Handle form submission
      document.addEventListener('submit', async e => {
        if (e.target.dataset.action === 'signin') {
          await handleSignIn(e);
        } else if (e.target.dataset.action === 'signup') {
          await handleSignUp(e);
        }
      });

      // KB chat Enter key handler
      document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'kb-chat-input' && !e.shiftKey) {
          e.preventDefault();
          const val = e.target.value.trim();
          if (val && !state.kbLoading) { sendKbMessage(val); e.target.value = ''; }
        }
      });

      // Live case search filtering + FAQ search
      document.addEventListener('input', e => {
        if (e.target.dataset.action === 'search-faq') {
          state.faqSearch = e.target.value;
          clearTimeout(window._faqSearchTimeout);
          window._faqSearchTimeout = setTimeout(function() { render(); }, 300);
          return;
        }
        if (e.target.dataset.field === 'case-search') {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('.case-list-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? '' : 'none';
          });
        }
      });

      // Handle change events for admin controls and file inputs
      document.addEventListener('change', async e => {
        // AI review modal checkbox toggle
        if (e.target.classList?.contains('ai-item-check') && e.target.dataset.key) {
          state.aiCheckedItems[e.target.dataset.key] = e.target.checked;
          // Update the button text with new count
          const btn = document.querySelector('[data-action="apply-ai-extraction"]');
          if (btn) {
            const count = Object.values(state.aiCheckedItems).filter(Boolean).length;
            btn.textContent = count > 0 ? `Apply ${count} Item${count !== 1 ? 's' : ''} to Care Plan` : 'Nothing Selected';
          }
          // Update row highlight
          const label = e.target.closest('label');
          if (label) label.style.background = e.target.checked ? 'rgba(42,157,143,0.08)' : '#f9f9f9';
          return;
        }
        // Message file attachment
        if (e.target.id === 'msg-file-input' && e.target.files?.[0]) {
          window._pendingAttachment = e.target.files[0];
          e.target.value = ''; // reset so same file can be re-selected
          render();
          return;
        }
        // Document vault upload
        if (e.target.id === 'doc-upload-input' && e.target.files?.[0]) {
          const file = e.target.files[0];
          if (!state.caseId) { showToast('No active case', 'error'); e.target.value = ''; return; }
          const maxSize = 25 * 1024 * 1024; // 25 MB
          if (file.size > maxSize) { showToast('File too large — max 25 MB', 'error'); e.target.value = ''; return; }
          try {
            showToast('Uploading...', 'success');
            const ext = file.name.split('.').pop();
            const path = `cases/${state.caseId}/${Date.now()}_${file.name}`;
            const { error: upErr } = await sb.storage.from('case-files').upload(path, file, { upsert: false });
            if (upErr) throw upErr;
            const { data: urlData } = await sb.storage.from('case-files').createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year signed URL for document vault
            await sb.from('case_documents').insert({
              case_id: state.caseId,
              name: file.name,
              url: urlData.signedUrl,
              size_bytes: file.size,
              mime_type: file.type,
              uploaded_by: state.profile.id,
            });
            await loadDocuments(state.caseId);

            // Trigger AI extraction for supported file types
            if (AI_SUPPORTED_TYPES.includes(file.type)) {
              showToast('File uploaded! Analyzing medical record with AI...', 'success');
              state.aiExtractionInProgress = true;
              render();
              try {
                const insertedDoc = state.documents.find(d => d.name === file.name);
                if (insertedDoc) {
                  await triggerAiExtraction(insertedDoc, state.caseId);
                }
              } catch (aiErr) {
                console.warn('AI extraction failed:', aiErr);
                showToast('Upload succeeded but AI analysis failed — you can review the file manually.', 'info');
                state.aiExtractionInProgress = false;
                render();
              }
            } else {
              showToast('File uploaded! 📁', 'success');
              render();
            }
          } catch(err) {
            console.error('Doc upload error:', err);
            showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
            e.target.value = '';
          }
          return;
        }

        // Pet photo input in Add Pet form
        if (e.target.id === 'pet-photo-input' && e.target.files?.[0]) {
          const file = e.target.files[0];
          window._pendingPetPhoto = file;
          const reader = new FileReader();
          reader.onload = ev => {
            window._pendingPetPhotoDataUrl = ev.target.result;
            render(); // Re-render to show preview
          };
          reader.readAsDataURL(file);
          return;
        }
        // Change photo input in case header
        if (e.target.id === 'change-photo-input' && e.target.files?.[0]) {
          const file = e.target.files[0];
          const petId = e.target.dataset.petId;
          if (!petId) return;
          try {
            showToast('Uploading photo...', 'success');
            const url = await uploadPetPhoto(file, petId);
            // Update in local state
            if (state.currentCase?.pets) state.currentCase.pets.photo_url = url;
            const localCase = state.cases.find(c => c.pets?.id === petId);
            if (localCase?.pets) localCase.pets.photo_url = url;
            render();
            showToast('Photo updated! 🐾', 'success');
          } catch(err) {
            console.error('Photo upload error:', err);
            showToast('Photo upload failed: ' + (err.message || 'Unknown error'), 'error');
          }
          return;
        }

        if (e.target.dataset.field === 'assign-buddy' && state.currentCase) {
          try {
            await sb.from('cases').update({ assigned_buddy_id: e.target.value || null }).eq('id', state.currentCase.id);
            state.currentCase.assigned_buddy_id = e.target.value || null;
            showToast('Buddy assigned', 'success');
          } catch(err) { showToast('Failed to assign buddy', 'error'); }
        } else if (e.target.dataset.field === 'case-status' && state.currentCase) {
          try {
            await sb.from('cases').update({ status: e.target.value }).eq('id', state.currentCase.id);
            state.currentCase.status = e.target.value;
            showToast('Status updated', 'success');
          } catch(err) { showToast('Failed to update status', 'error'); }
        } else if (e.target.dataset.field === 'case-tier' && state.currentCase) {
          try {
            await sb.from('cases').update({ subscription_tier: e.target.value }).eq('id', state.currentCase.id);
            state.currentCase.subscription_tier = e.target.value;
            showToast('Tier updated', 'success');
          } catch(err) { showToast('Failed to update tier', 'error'); }
        }

        // Audit log filters
        if (e.target.dataset.action === 'filter-audit') {
          const filterType = e.target.dataset.filter;
          if (filterType === 'action') state.auditActionFilter = e.target.value;
          if (filterType === 'entity') state.auditEntityFilter = e.target.value;
          render();
        }
      });
    }

    async function initApp() {
      // Restore dark mode from localStorage before render to avoid flash
      try { if (localStorage.getItem('vetbuddies_dark_mode') === '1') { state.darkMode = true; document.documentElement.setAttribute('data-theme', 'dark'); } } catch(e) {}

      // Handle Stripe return redirect
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('billing') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
        state._billingSuccessToast = true;
      }

      // Handle password reset redirect
      if (urlParams.get('reset') === 'true' || window.location.hash.includes('type=recovery')) {
        window.history.replaceState({}, '', window.location.pathname);
        state._showPasswordReset = true;
      }

      // Capture referral code from URL — check if referrer is a vet buddy
      const refCode = urlParams.get('ref');
      if (refCode) {
        try {
          const { data: referrer } = await sb.from('users').select('id, role, name').eq('referral_code', refCode).single();
          if (referrer && referrer.role === 'vet_buddy') {
            state.referredByBuddyId = referrer.id;
            state.selectedBuddyId = referrer.id;
          }
        } catch (e) { /* referral code not found — no pre-selection */ }
      }

      // Handle care team invite token from URL
      const inviteToken = urlParams.get('token');
      if (inviteToken) {
        state._careTeamInviteToken = inviteToken;
        try {
          const { data: invite } = await sb.from('pending_invites')
            .select('*, cases:case_id(id, pet_id, pets:pet_id(id, name, breed, photo_url, species, owner_id, owner:users!owner_id(id, name)))')
            .eq('token', inviteToken)
            .eq('invite_source', 'care_team')
            .is('used_at', null)
            .maybeSingle();
          if (invite) {
            state._careTeamInviteData = invite;
            navigate('care-team-invite');
            render();
          } else {
            navigate('login');
            render();
          }
        } catch (e) {
          console.warn('Invite token lookup failed:', e);
          navigate('login');
          render();
        }
      } else {
        // Show login initially while we check for existing session
        navigate('login');
        render();
      }

      sb.auth.onAuthStateChange((event, session) => {
        // IMPORTANT: Do NOT make DB calls (sb.from) synchronously inside this callback.
        // Supabase holds the auth lock while firing these events. Any call that internally
        // calls getSession() (including all sb.from() queries) will deadlock.
        // Use setTimeout(0) to defer DB work until the lock is released.
        if (event === 'INITIAL_SESSION') {
          if (session) {
            // Existing session found — restore the user without re-login
            state.user = session.user;
            setTimeout(async () => {
              try {
                await loadProfile();
                render();
              } catch (err) { console.error('Session restore failed:', err); }
            }, 0);
          } else {
            // No valid session — clear any stale auth data from localStorage
            // This handles "Refresh Token Not Found" errors from expired/revoked tokens
            setTimeout(() => {
              sb.auth.signOut({ scope: 'local' });
            }, 0);
          }
        } else if (event === 'SIGNED_IN') {
          if (session) state.user = session.user;
        } else if (event === 'SIGNED_OUT') {
          stopAppointmentReminders();
          if (state.realtimeChannel) { sb.removeChannel(state.realtimeChannel); state.realtimeChannel = null; }
          if (state.globalNotifChannel) { sb.removeChannel(state.globalNotifChannel); state.globalNotifChannel = null; }
          state.user = null;
          state.profile = null;
          state.cases = [];
          state.teamMembers = [];
          state.currentCase = null;
          state.carePlan = null;
          state.messages = [];
          state.appointments = [];
          state.escalations = [];
          state.caseId = null;
          state.petCoOwners = [];
          state.pendingCoOwnerInvites = [];
          navigate('login');
          render();
        } else if (event === 'TOKEN_REFRESHED') {
          if (session) state.user = session.user;
        }
      });
    }

    // PWA install prompt capture
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      state.pwaInstallPrompt = e;
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW registered:', reg.scope);
      }).catch(err => {
        console.warn('SW registration failed:', err);
      });

      // Handle notification click messages from the service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          // If there's a caseId, navigate to that case's messages
          if (event.data.caseId && state.profile) {
            state.caseId = event.data.caseId;
            const role = state.profile.role;
            if (role === 'client') {
              state.caseTab = 'messages';
              loadCase(event.data.caseId).then(() => {
                loadMessages(event.data.caseId);
                subscribeToMessages(event.data.caseId);
                navigate('client-case');
              });
            } else {
              loadCase(event.data.caseId).then(() => {
                loadMessages(event.data.caseId);
                subscribeToMessages(event.data.caseId);
                navigate(role === 'admin' ? 'admin-cases' : 'buddy-inbox');
              });
            }
          }
        }
      });
    }

    // Listen for visibility changes — refresh unread count when app comes back to foreground
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.profile) {
        loadUnreadCount().then(() => render());
      }
    });

    // ── Persistent file inputs (outside render cycle for mobile compatibility) ──
    // Mobile browsers cancel the file picker if the input element is destroyed
    // by a re-render between the .click() call and the OS picker appearing.
    (function initPersistentFileInputs() {
      const container = document.createElement('div');
      container.id = 'persistent-file-inputs';
      container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
      container.innerHTML = `
        <input type="file" id="doc-upload-input" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" capture="environment">
        <input type="file" id="msg-file-input" accept="image/*,.pdf,.doc,.docx,.txt,.csv">
        <input type="file" id="voice-file-input" accept="audio/*">
        <input type="file" id="pet-photo-input" accept="image/*">
      `;
      document.body.appendChild(container);
    })();

    attachEventListeners();
    initApp();
