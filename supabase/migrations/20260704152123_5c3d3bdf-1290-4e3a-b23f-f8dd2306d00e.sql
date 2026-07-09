
create or replace function public.create_group_with_owner(_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_group_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into public.groups(name, created_by) values (trim(_name), v_uid)
    returning id into v_group_id;
  insert into public.group_members(group_id, user_id, role)
    values (v_group_id, v_uid, 'OWNER');
  return v_group_id;
end;
$$;
revoke execute on function public.create_group_with_owner(text) from public, anon;
grant execute on function public.create_group_with_owner(text) to authenticated;
