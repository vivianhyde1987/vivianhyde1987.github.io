create table if not exists public.mimi_care_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  caretaker_name text not null default '访客',
  action text not null check (action in ('food', 'treat', 'wand', 'pet', 'hold', 'litter', 'doctor')),
  created_at timestamptz not null default now()
);

alter table public.mimi_care_logs enable row level security;

drop policy if exists "mimi care logs are readable" on public.mimi_care_logs;
create policy "mimi care logs are readable"
on public.mimi_care_logs for select
using (true);

create or replace function public.create_mimi_care_log(session_token uuid, action_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  log_uuid uuid;
  visitor_name text := '访客';
begin
  if action_input not in ('food', 'treat', 'wand', 'pet', 'hold', 'litter', 'doctor') then
    raise exception 'Unknown care action';
  end if;
  if session_token is not null then
    select * into account_row from public.account_from_token(session_token);
    if account_row.id is not null then
      visitor_name := account_row.handle;
    end if;
  end if;
  insert into public.mimi_care_logs(owner_id, caretaker_name, action)
  values (account_row.id, visitor_name, action_input)
  returning id into log_uuid;
  return log_uuid;
end;
$$;

grant execute on function public.create_mimi_care_log(uuid, text) to anon, authenticated;
