CREATE OR REPLACE FUNCTION public.get_group_balances(_group_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, total_paid numeric, total_owed numeric, net_balance numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    gm.user_id,
    p.full_name,
    p.email,
    coalesce(paid.total, 0)::numeric(10,2) as total_paid,
    coalesce(owed.total, 0)::numeric(10,2) as total_owed,
    (
      coalesce(paid.total, 0)
      - coalesce(owed.total, 0)
      + coalesce(settled_from.total, 0)
      - coalesce(settled_to.total, 0)
    )::numeric(10,2) as net_balance
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join (
    select payer_id, sum(amount) as total
    from public.expenses where group_id = _group_id group by payer_id
  ) paid on paid.payer_id = gm.user_id
  left join (
    select es.user_id, sum(es.amount_owed) as total
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = _group_id group by es.user_id
  ) owed on owed.user_id = gm.user_id
  left join (
    select from_user_id, sum(amount) as total
    from public.settlements
    where group_id = _group_id and status = 'CONFIRMED'
    group by from_user_id
  ) settled_from on settled_from.from_user_id = gm.user_id
  left join (
    select to_user_id, sum(amount) as total
    from public.settlements
    where group_id = _group_id and status = 'CONFIRMED'
    group by to_user_id
  ) settled_to on settled_to.to_user_id = gm.user_id
  where gm.group_id = _group_id;
$function$;