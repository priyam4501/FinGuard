
revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.is_group_owner(uuid, uuid) from public, anon;
revoke execute on function public.validate_expense_splits() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.get_group_balances(uuid) from public, anon;
revoke execute on function public.create_expense_with_splits(uuid,uuid,numeric,text,public.split_strategy,jsonb) from public, anon;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
grant execute on function public.get_group_balances(uuid) to authenticated;
grant execute on function public.create_expense_with_splits(uuid,uuid,numeric,text,public.split_strategy,jsonb) to authenticated;
