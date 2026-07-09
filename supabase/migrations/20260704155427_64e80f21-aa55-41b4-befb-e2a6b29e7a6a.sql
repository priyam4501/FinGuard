
-- Batch insert settlements atomically
CREATE OR REPLACE FUNCTION public.create_settlements_batch(_group_id uuid, _settlements jsonb)
RETURNS SETOF public.settlements
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v jsonb;
  v_row public.settlements;
BEGIN
  IF NOT public.is_group_member(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(_settlements) LOOP
    INSERT INTO public.settlements(group_id, from_user_id, to_user_id, amount, status)
    VALUES (
      _group_id,
      (v->>'from_user_id')::uuid,
      (v->>'to_user_id')::uuid,
      round((v->>'amount')::numeric, 2),
      'PENDING'
    )
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
  RETURN;
END;
$$;

-- Confirm a settlement: only the two participants or the group owner
CREATE OR REPLACE FUNCTION public.confirm_settlement(_settlement_id uuid)
RETURNS public.settlements
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.settlements;
BEGIN
  SELECT * INTO v_row FROM public.settlements WHERE id = _settlement_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.status = 'CONFIRMED' THEN RETURN v_row; END IF;
  IF auth.uid() <> v_row.from_user_id
     AND auth.uid() <> v_row.to_user_id
     AND NOT public.is_group_owner(v_row.group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to confirm this settlement';
  END IF;
  UPDATE public.settlements
    SET status = 'CONFIRMED', confirmed_at = now()
    WHERE id = _settlement_id
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- Prevent editing confirmed settlements: replace update policy
DROP POLICY IF EXISTS "Members update settlements" ON public.settlements;
CREATE POLICY "Members update pending settlements only"
ON public.settlements
FOR UPDATE
USING (public.is_group_member(group_id, auth.uid()) AND status = 'PENDING')
WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- No delete policy => cannot delete settlements (financial history immutable)
DROP POLICY IF EXISTS "Members delete settlements" ON public.settlements;

-- Accept a group invite: verify invited_email == signed-in user's email
CREATE OR REPLACE FUNCTION public.accept_group_invite(_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.group_invites;
  v_email text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_invite FROM public.group_invites WHERE id = _invite_id;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF lower(v_invite.invited_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invite is not for you';
  END IF;
  IF v_invite.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;
  INSERT INTO public.group_members(group_id, user_id, role)
    VALUES (v_invite.group_id, v_uid, 'MEMBER')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  UPDATE public.group_invites SET status = 'ACCEPTED' WHERE id = _invite_id;
  RETURN v_invite.group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_group_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.group_invites;
  v_email text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_invite FROM public.group_invites WHERE id = _invite_id;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF lower(v_invite.invited_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invite is not for you';
  END IF;
  UPDATE public.group_invites SET status = 'DECLINED' WHERE id = _invite_id;
END;
$$;

-- Allow signed-in users to look up invites addressed to their email
-- (existing SELECT policy already covers this via profiles.email match)
