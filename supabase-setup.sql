create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  avatar jsonb,
  mood jsonb,
  created_at timestamptz not null default now()
);

alter table public.guestbook_messages enable row level security;

drop policy if exists "guestbook messages are readable" on public.guestbook_messages;
create policy "guestbook messages are readable"
on public.guestbook_messages
for select
using (true);

drop policy if exists "visitors can leave guestbook messages" on public.guestbook_messages;
create policy "visitors can leave guestbook messages"
on public.guestbook_messages
for insert
with check (
  char_length(name) between 1 and 24
  and char_length(body) between 1 and 240
);
