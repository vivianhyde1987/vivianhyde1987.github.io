create table if not exists public.cabin_music_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  performer_name text not null,
  title text not null,
  audio_url text not null,
  created_at timestamptz not null default now(),
  constraint cabin_music_title_length check (char_length(title) between 1 and 60)
);

alter table public.cabin_music_recordings enable row level security;

drop policy if exists "cabin music recordings are readable" on public.cabin_music_recordings;
create policy "cabin music recordings are readable"
on public.cabin_music_recordings for select
using (true);

create or replace function public.create_cabin_music_recording(session_token uuid, title_input text, audio_url_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  recording_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then raise exception 'Please log in first'; end if;
  insert into public.cabin_music_recordings(owner_id, performer_name, title, audio_url)
  values (account_row.id, account_row.handle, trim(title_input), audio_url_input)
  returning id into recording_uuid;
  return recording_uuid;
end;
$$;

grant execute on function public.create_cabin_music_recording(uuid, text, text) to anon, authenticated;
