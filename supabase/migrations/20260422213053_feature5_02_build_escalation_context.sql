
CREATE OR REPLACE FUNCTION build_escalation_context(p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'snapshot_at', NOW(),
    'case', jsonb_build_object(
      'id', c.id,
      'status', c.status,
      'subscription_tier', c.subscription_tier,
      'assigned_buddy_name', (SELECT u.name FROM users u WHERE u.id = c.assigned_buddy_id)
    ),
    'pet', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'species', p.species,
      'breed', p.breed,
      'dob', p.dob,
      'weight', p.weight,
      'owner_name', (SELECT u.name FROM users u WHERE u.id = p.owner_id),
      'owner_email', (SELECT u.email FROM users u WHERE u.id = p.owner_id)
    ),
    'care_plan_snapshot', jsonb_build_object(
      'completeness_score', cp.completeness_score,
      'active_diagnoses', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'condition_name', condition_name, 'status', status
        )), '[]'::jsonb)
        FROM care_plan_diagnoses WHERE care_plan_id = cp.id AND status = 'active'
      ),
      'active_medications', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', name, 'dose', dose, 'frequency', frequency
        )), '[]'::jsonb)
        FROM pet_medications WHERE pet_id = p.id AND is_active = TRUE
      ),
      'open_questions', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'question', question, 'priority', priority
        )), '[]'::jsonb)
        FROM care_plan_open_questions WHERE care_plan_id = cp.id AND status = 'open'
      ),
      'active_goals', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'goal_text', goal_text
        )), '[]'::jsonb)
        FROM care_plan_goals WHERE care_plan_id = cp.id AND status = 'active'
      ),
      'owner_context_excerpt', LEFT(COALESCE(cp.owner_context, ''), 500)
    ),
    'recent_touchpoints', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'created_at', te.created_at,
        'type', te.type,
        'summary', LEFT(te.content, 300)
      ) ORDER BY te.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM timeline_entries
        WHERE case_id = c.id ORDER BY created_at DESC LIMIT 5
      ) te
    ),
    'recent_messages', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'created_at', m.created_at,
        'sender_role', m.sender_role,
        'is_urgent', m.is_urgent,
        'content_excerpt', LEFT(m.content, 400),
        'has_attachment', m.attachment_url IS NOT NULL
      ) ORDER BY m.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM messages
        WHERE case_id = c.id ORDER BY created_at DESC LIMIT 5
      ) m
    )
  ) INTO v_result
  FROM cases c
  JOIN pets p ON p.id = c.pet_id
  JOIN care_plans cp ON cp.case_id = c.id
  WHERE c.id = p_case_id;

  RETURN v_result;
END $$;
