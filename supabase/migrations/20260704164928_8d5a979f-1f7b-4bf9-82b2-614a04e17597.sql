
-- Helper: is a given expense still editable? (no confirmed settlement AFTER its creation)
CREATE OR REPLACE FUNCTION public.is_expense_editable(_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT e.created_at > COALESCE(
        (SELECT MAX(s.confirmed_at)
           FROM public.settlements s
          WHERE s.group_id = e.group_id
            AND s.status = 'CONFIRMED'),
        'epoch'::timestamptz
      )
      FROM public.expenses e
     WHERE e.id = _expense_id),
    false
  );
$$;

-- Rename a group (OWNER only)
CREATE OR REPLACE FUNCTION public.update_group_name(_group_id uuid, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(_name);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_owner(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the group owner can rename this group';
  END IF;
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF length(v_name) > 100 THEN
    RAISE EXCEPTION 'Name must be 100 characters or fewer';
  END IF;
  UPDATE public.groups SET name = v_name WHERE id = _group_id;
END;
$$;

-- Delete a group (OWNER only) — cascades expenses, splits, settlements, invites, members
CREATE OR REPLACE FUNCTION public.delete_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_owner(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the group owner can delete this group';
  END IF;
  DELETE FROM public.groups WHERE id = _group_id;
END;
$$;

-- Edit an expense atomically (re-check editability + authorization; replace splits)
CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  _expense_id uuid,
  _payer_id uuid,
  _amount numeric,
  _description text,
  _strategy split_strategy,
  _splits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense public.expenses;
  v_uid uuid := auth.uid();
  v_split jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_expense FROM public.expenses WHERE id = _expense_id;
  IF v_expense.id IS NULL THEN RAISE EXCEPTION 'Expense not found'; END IF;

  -- Authorization: creator OR group owner
  IF v_expense.created_by <> v_uid AND NOT public.is_group_owner(v_expense.group_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized to edit this expense';
  END IF;

  -- Editability guardrail
  IF NOT public.is_expense_editable(_expense_id) THEN
    RAISE EXCEPTION 'This expense is locked because a settlement has been confirmed since it was created';
  END IF;

  -- Payer must still be a group member
  IF NOT public.is_group_member(v_expense.group_id, _payer_id) THEN
    RAISE EXCEPTION 'Payer must be a group member';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Defer the sum-check trigger until we've fully rewritten splits
  SET CONSTRAINTS ALL DEFERRED;

  -- Replace splits first, then update the expense amount, all in one transaction
  DELETE FROM public.expense_splits WHERE expense_id = _expense_id;

  UPDATE public.expenses
     SET payer_id = _payer_id,
         amount = round(_amount::numeric, 2),
         description = _description,
         split_strategy = _strategy
   WHERE id = _expense_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(_splits) LOOP
    INSERT INTO public.expense_splits(expense_id, user_id, amount_owed)
    VALUES (
      _expense_id,
      (v_split->>'user_id')::uuid,
      round((v_split->>'amount_owed')::numeric, 2)
    );
  END LOOP;
END;
$$;

-- Delete an expense (creator or OWNER; only while editable)
CREATE OR REPLACE FUNCTION public.delete_expense(_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense public.expenses;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_expense FROM public.expenses WHERE id = _expense_id;
  IF v_expense.id IS NULL THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF v_expense.created_by <> v_uid AND NOT public.is_group_owner(v_expense.group_id, v_uid) THEN
    RAISE EXCEPTION 'Not authorized to delete this expense';
  END IF;
  IF NOT public.is_expense_editable(_expense_id) THEN
    RAISE EXCEPTION 'This expense is locked because a settlement has been confirmed since it was created';
  END IF;
  DELETE FROM public.expenses WHERE id = _expense_id;
END;
$$;
