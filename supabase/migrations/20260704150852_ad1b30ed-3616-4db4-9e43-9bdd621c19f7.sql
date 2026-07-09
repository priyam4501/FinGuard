
-- ============ ENUMS ============
create type public.split_strategy as enum ('EQUAL', 'CUSTOM_PERCENTAGE');
create type public.invite_status as enum ('PENDING', 'ACCEPTED', 'DECLINED');
create type public.settlement_status as enum ('PENDING', 'CONFIRMED');
create type public.member_role as enum ('OWNER', 'MEMBER');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ GROUPS ============
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;
alter table public.groups enable row level security;

-- ============ GROUP_MEMBERS ============
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user_idx on public.group_members(user_id);
create index group_members_group_idx on public.group_members(group_id);
grant select, insert, update, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;
alter table public.group_members enable row level security;

-- ============ GROUP_INVITES ============
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles(id) on delete set null,
  status public.invite_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (group_id, invited_email)
);
grant select, insert, update, delete on public.group_invites to authenticated;
grant all on public.group_invites to service_role;
alter table public.group_invites enable row level security;

-- ============ EXPENSES ============
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 255),
  split_strategy public.split_strategy not null default 'EQUAL',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index expenses_group_idx on public.expenses(group_id, created_at desc);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;

-- ============ EXPENSE_SPLITS ============
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_owed numeric(10,2) not null check (amount_owed >= 0),
  unique (expense_id, user_id)
);
create index expense_splits_expense_idx on public.expense_splits(expense_id);
create index expense_splits_user_idx on public.expense_splits(user_id);
grant select, insert, update, delete on public.expense_splits to authenticated;
grant all on public.expense_splits to service_role;
alter table public.expense_splits enable row level security;

-- ============ SETTLEMENTS (schema now; UI later) ============
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  status public.settlement_status not null default 'PENDING',
  generated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_user_id <> to_user_id)
);
grant select, insert, update, delete on public.settlements to authenticated;
grant all on public.settlements to service_role;
alter table public.settlements enable row level security;

-- ============ SECURITY DEFINER HELPERS (avoid RLS recursion) ============
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
  )
$$;

create or replace function public.is_group_owner(_group_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id and role = 'OWNER'
  )
$$;

-- ============ RLS POLICIES ============

-- profiles
create policy "Users can view profiles of shared group members or self"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
  )
);
create policy "Users insert own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "Users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups
create policy "Members can view groups" on public.groups for select to authenticated
  using (public.is_group_member(id, auth.uid()));
create policy "Authenticated can create groups" on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy "Owners can update groups" on public.groups for update to authenticated
  using (public.is_group_owner(id, auth.uid()));
create policy "Owners can delete groups" on public.groups for delete to authenticated
  using (public.is_group_owner(id, auth.uid()));

-- group_members
create policy "Members can view group_members of their groups"
on public.group_members for select to authenticated
using (public.is_group_member(group_id, auth.uid()));
create policy "Owners can add members"
on public.group_members for insert to authenticated
with check (
  public.is_group_owner(group_id, auth.uid())
  or (user_id = auth.uid() and not exists (select 1 from public.group_members where group_id = group_members.group_id))
);
create policy "Owners can remove members"
on public.group_members for delete to authenticated
using (public.is_group_owner(group_id, auth.uid()) or user_id = auth.uid());

-- group_invites
create policy "Owners view group invites" on public.group_invites for select to authenticated
  using (public.is_group_owner(group_id, auth.uid())
    or invited_email = (select email from public.profiles where id = auth.uid()));
create policy "Owners create invites" on public.group_invites for insert to authenticated
  with check (public.is_group_owner(group_id, auth.uid()) and invited_by = auth.uid());
create policy "Invitees update own invite" on public.group_invites for update to authenticated
  using (invited_email = (select email from public.profiles where id = auth.uid()));

-- expenses
create policy "Members view expenses" on public.expenses for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy "Members create expenses" on public.expenses for insert to authenticated
  with check (public.is_group_member(group_id, auth.uid()) and created_by = auth.uid());
create policy "Creator or owner deletes expense" on public.expenses for delete to authenticated
  using (created_by = auth.uid() or public.is_group_owner(group_id, auth.uid()));

-- expense_splits
create policy "Members view expense_splits" on public.expense_splits for select to authenticated
  using (exists (select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id, auth.uid())));
create policy "Members insert expense_splits" on public.expense_splits for insert to authenticated
  with check (exists (select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id, auth.uid())));
create policy "Members delete expense_splits" on public.expense_splits for delete to authenticated
  using (exists (select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id, auth.uid())));

-- settlements
create policy "Members view settlements" on public.settlements for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy "Members insert settlements" on public.settlements for insert to authenticated
  with check (public.is_group_member(group_id, auth.uid()));
create policy "Members update settlements" on public.settlements for update to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- ============ TRIGGER: splits must sum to expense amount ============
create or replace function public.validate_expense_splits()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_expense_id uuid;
  v_total numeric(10,2);
  v_expense_amount numeric(10,2);
begin
  v_expense_id := coalesce(new.expense_id, old.expense_id);
  select amount into v_expense_amount from public.expenses where id = v_expense_id;
  if v_expense_amount is null then return null; end if;
  select coalesce(sum(amount_owed),0) into v_total from public.expense_splits where expense_id = v_expense_id;
  if v_total <> v_expense_amount then
    raise exception 'Sum of expense splits (%) does not equal expense amount (%)', v_total, v_expense_amount;
  end if;
  return null;
end;
$$;

create constraint trigger enforce_splits_sum
after insert or update or delete on public.expense_splits
deferrable initially deferred
for each row execute function public.validate_expense_splits();

-- ============ ATOMIC EXPENSE CREATION RPC ============
create or replace function public.create_expense_with_splits(
  _group_id uuid,
  _payer_id uuid,
  _amount numeric,
  _description text,
  _strategy public.split_strategy,
  _splits jsonb  -- array of {user_id, amount_owed}
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_expense_id uuid;
  v_split jsonb;
begin
  if not public.is_group_member(_group_id, auth.uid()) then
    raise exception 'Not a member of this group';
  end if;
  if not public.is_group_member(_group_id, _payer_id) then
    raise exception 'Payer must be a group member';
  end if;

  insert into public.expenses(group_id, payer_id, amount, description, split_strategy, created_by)
  values (_group_id, _payer_id, round(_amount::numeric,2), _description, _strategy, auth.uid())
  returning id into v_expense_id;

  for v_split in select * from jsonb_array_elements(_splits) loop
    insert into public.expense_splits(expense_id, user_id, amount_owed)
    values (
      v_expense_id,
      (v_split->>'user_id')::uuid,
      round((v_split->>'amount_owed')::numeric, 2)
    );
  end loop;

  return v_expense_id;
end;
$$;
grant execute on function public.create_expense_with_splits(uuid,uuid,numeric,text,public.split_strategy,jsonb) to authenticated;

-- ============ BALANCES FUNCTION ============
create or replace function public.get_group_balances(_group_id uuid)
returns table (user_id uuid, full_name text, email text, total_paid numeric, total_owed numeric, net_balance numeric)
language sql stable security invoker set search_path = public
as $$
  select
    gm.user_id,
    p.full_name,
    p.email,
    coalesce(paid.total, 0)::numeric(10,2) as total_paid,
    coalesce(owed.total, 0)::numeric(10,2) as total_owed,
    (coalesce(paid.total,0) - coalesce(owed.total,0))::numeric(10,2) as net_balance
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
  where gm.group_id = _group_id;
$$;
grant execute on function public.get_group_balances(uuid) to authenticated;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
