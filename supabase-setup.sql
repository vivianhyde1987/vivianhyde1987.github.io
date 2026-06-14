create extension if not exists pgcrypto with schema extensions;

create table if not exists public.blog_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  password_hash text not null,
  avatar jsonb not null default '{"color":"#b62548","shape":"circle","mark":"R"}'::jsonb,
  role text not null default 'member' check (role in ('member', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_handle_length check (char_length(handle) between 2 and 24)
);

create table if not exists public.blog_sessions (
  token uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.blog_accounts(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '180 days',
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  category text not null,
  title text not null,
  body text not null,
  image_url text,
  video_url text,
  interest_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint title_length check (char_length(title) between 1 and 80),
  constraint body_length check (char_length(body) between 1 and 4000)
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  parent_id uuid references public.blog_comments(id) on delete cascade,
  owner_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comment_length check (char_length(body) between 1 and 500)
);

create table if not exists public.blog_post_likes (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, owner_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.chat_messages(id) on delete cascade,
  owner_id uuid not null,
  body text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint chat_message_content check (
    (body is not null and char_length(body) between 1 and 800)
    or image_url is not null
  )
);

create table if not exists public.chat_message_likes (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (message_id, owner_id)
);

create table if not exists public.koi_wishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  wish_key text not null,
  wish_text text not null,
  cost integer not null check (cost > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.lottery_topics (
  id uuid primary key default gen_random_uuid(),
  topic_date date not null unique,
  owner_id uuid not null,
  topic_text text not null,
  created_at timestamptz not null default now(),
  constraint lottery_topic_length check (char_length(topic_text) between 2 and 120)
);

create table if not exists public.lottery_entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.lottery_topics(id) on delete cascade,
  owner_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (topic_id, owner_id),
  constraint lottery_entry_length check (char_length(body) between 1 and 300)
);

create table if not exists public.health_event_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  event_time timestamptz not null default now(),
  medicine_name text,
  note text,
  created_at timestamptz not null default now(),
  constraint health_event_content check (
    (medicine_name is not null and char_length(medicine_name) between 1 and 80)
    or (note is not null and char_length(note) between 1 and 600)
  )
);

create table if not exists public.blog_podcasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  publish_date date not null default current_date,
  issue_no integer not null unique check (issue_no between 1 and 9999),
  topic text not null,
  audio_url text not null,
  music_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_topic_length check (char_length(topic) between 1 and 100)
);

create table if not exists public.podcast_comments (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.blog_podcasts(id) on delete cascade,
  parent_id uuid references public.podcast_comments(id) on delete cascade,
  owner_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint podcast_comment_length check (char_length(body) between 1 and 500)
);

create table if not exists public.podcast_likes (
  podcast_id uuid not null references public.blog_podcasts(id) on delete cascade,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (podcast_id, owner_id)
);

create table if not exists public.cabin_artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  category text not null check (category in ('oil', 'ink', 'child')),
  title text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  constraint cabin_artwork_title_length check (char_length(title) between 1 and 60)
);

create table if not exists public.mimi_care_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  caretaker_name text not null default '访客',
  action text not null check (action in ('food', 'treat', 'wand', 'pet', 'hold', 'litter', 'doctor')),
  created_at timestamptz not null default now()
);

create table if not exists public.cabin_music_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  performer_name text not null,
  title text not null,
  audio_url text not null,
  created_at timestamptz not null default now(),
  constraint cabin_music_title_length check (char_length(title) between 1 and 60)
);

alter table public.chat_messages
add column if not exists parent_id uuid references public.chat_messages(id) on delete cascade;

alter table public.blog_posts
add column if not exists video_url text;

alter table public.blog_posts
add column if not exists interest_type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-videos',
  'blog-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-audio',
  'blog-audio',
  true,
  104857600,
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.blog_posts drop constraint if exists blog_posts_owner_id_fkey;
alter table public.blog_comments drop constraint if exists blog_comments_owner_id_fkey;
alter table public.blog_post_likes drop constraint if exists blog_post_likes_owner_id_fkey;

alter table public.blog_accounts enable row level security;
alter table public.blog_sessions enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_post_likes enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_likes enable row level security;
alter table public.koi_wishes enable row level security;
alter table public.lottery_topics enable row level security;
alter table public.lottery_entries enable row level security;
alter table public.health_event_logs enable row level security;
alter table public.blog_podcasts enable row level security;
alter table public.podcast_comments enable row level security;
alter table public.podcast_likes enable row level security;
alter table public.cabin_artworks enable row level security;
alter table public.mimi_care_logs enable row level security;
alter table public.cabin_music_recordings enable row level security;

drop policy if exists "accounts are readable" on public.blog_accounts;
create policy "accounts are readable"
on public.blog_accounts for select
using (true);

drop policy if exists "posts are readable" on public.blog_posts;
create policy "posts are readable"
on public.blog_posts for select
using (true);

drop policy if exists "comments are readable" on public.blog_comments;
create policy "comments are readable"
on public.blog_comments for select
using (true);

drop policy if exists "likes are readable" on public.blog_post_likes;
create policy "likes are readable"
on public.blog_post_likes for select
using (true);

drop policy if exists "chat messages are readable" on public.chat_messages;
create policy "chat messages are readable"
on public.chat_messages for select
using (true);

drop policy if exists "chat likes are readable" on public.chat_message_likes;
create policy "chat likes are readable"
on public.chat_message_likes for select
using (true);

drop policy if exists "koi wishes are readable" on public.koi_wishes;
create policy "koi wishes are readable"
on public.koi_wishes for select
using (true);

drop policy if exists "lottery topics are readable" on public.lottery_topics;
create policy "lottery topics are readable"
on public.lottery_topics for select
using (true);

drop policy if exists "lottery entries are readable" on public.lottery_entries;
create policy "lottery entries are readable"
on public.lottery_entries for select
using (true);

drop policy if exists "health event logs are readable" on public.health_event_logs;
create policy "health event logs are readable"
on public.health_event_logs for select
using (true);

drop policy if exists "podcasts are readable" on public.blog_podcasts;
create policy "podcasts are readable"
on public.blog_podcasts for select
using (true);

drop policy if exists "podcast comments are readable" on public.podcast_comments;
create policy "podcast comments are readable"
on public.podcast_comments for select
using (true);

drop policy if exists "podcast likes are readable" on public.podcast_likes;
create policy "podcast likes are readable"
on public.podcast_likes for select
using (true);

drop policy if exists "cabin artworks are readable" on public.cabin_artworks;
create policy "cabin artworks are readable"
on public.cabin_artworks for select
using (true);

drop policy if exists "mimi care logs are readable" on public.mimi_care_logs;
create policy "mimi care logs are readable"
on public.mimi_care_logs for select
using (true);

drop policy if exists "cabin music recordings are readable" on public.cabin_music_recordings;
create policy "cabin music recordings are readable"
on public.cabin_music_recordings for select
using (true);

drop policy if exists "blog videos are public" on storage.objects;
create policy "blog videos are public"
on storage.objects for select
using (bucket_id = 'blog-videos');

drop policy if exists "blog videos can be uploaded" on storage.objects;
create policy "blog videos can be uploaded"
on storage.objects for insert
with check (bucket_id = 'blog-videos');

drop policy if exists "blog audio is public" on storage.objects;
create policy "blog audio is public"
on storage.objects for select
using (bucket_id = 'blog-audio');

drop policy if exists "blog audio can be uploaded" on storage.objects;
create policy "blog audio can be uploaded"
on storage.objects for insert
with check (bucket_id = 'blog-audio');

create or replace function public.clean_blog_handle(raw_handle text)
returns text
language sql
immutable
as $$
  select left(regexp_replace(lower(trim(raw_handle)), '\s+', '-', 'g'), 24);
$$;

create or replace function public.make_blog_session(account_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_token uuid;
  account_row public.blog_accounts;
begin
  delete from public.blog_sessions where expires_at < now();
  insert into public.blog_sessions(account_id)
  values (account_uuid)
  returning token into session_token;

  select * into account_row from public.blog_accounts where id = account_uuid;
  return jsonb_build_object(
    'token', session_token,
    'account', jsonb_build_object(
      'id', account_row.id,
      'handle', account_row.handle,
      'avatar', account_row.avatar,
      'role', account_row.role
    )
  );
end;
$$;

create or replace function public.account_from_token(session_token uuid)
returns public.blog_accounts
language sql
security definer
set search_path = public
as $$
  select a.*
  from public.blog_sessions s
  join public.blog_accounts a on a.id = s.account_id
  where s.token = session_token
    and s.expires_at > now()
  limit 1;
$$;

create or replace function public.register_blog_account(handle_input text, password_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_handle text := public.clean_blog_handle(handle_input);
  account_uuid uuid;
begin
  if char_length(clean_handle) < 2 then
    raise exception 'ID must be at least 2 characters';
  end if;
  if char_length(password_input) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  insert into public.blog_accounts(handle, password_hash)
  values (clean_handle, extensions.crypt(password_input, extensions.gen_salt('bf')))
  returning id into account_uuid;

  return public.make_blog_session(account_uuid);
exception
  when unique_violation then
    raise exception 'This ID is already registered';
end;
$$;

create or replace function public.login_blog_account(handle_input text, password_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_handle text := public.clean_blog_handle(handle_input);
  account_uuid uuid;
begin
  select id into account_uuid
  from public.blog_accounts
  where handle = clean_handle
    and password_hash = extensions.crypt(password_input, password_hash);

  if account_uuid is null then
    raise exception 'ID or password is incorrect';
  end if;

  return public.make_blog_session(account_uuid);
end;
$$;

create or replace function public.get_blog_session(session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Session expired';
  end if;
  return jsonb_build_object(
    'id', account_row.id,
    'handle', account_row.handle,
    'avatar', account_row.avatar,
    'role', account_row.role
  );
end;
$$;

create or replace function public.update_blog_avatar(session_token uuid, avatar_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  update public.blog_accounts
  set avatar = avatar_input, updated_at = now()
  where id = account_row.id
  returning * into account_row;
  return jsonb_build_object('id', account_row.id, 'handle', account_row.handle, 'avatar', account_row.avatar, 'role', account_row.role);
end;
$$;

drop function if exists public.create_blog_post(uuid, text, text, text, text);
drop function if exists public.create_blog_post(uuid, text, text, text, text, text);
drop function if exists public.create_blog_post(uuid, text, text, text, text, text, text);

create or replace function public.create_blog_post(session_token uuid, category_input text, title_input text, body_input text, image_input text, video_input text, interest_type_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  post_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  insert into public.blog_posts(owner_id, category, title, body, image_url, video_url, interest_type)
  values (account_row.id, category_input, title_input, body_input, image_input, video_input, interest_type_input)
  returning id into post_uuid;
  return post_uuid;
end;
$$;

create or replace function public.delete_blog_post(session_token uuid, post_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  delete from public.blog_posts
  where id = post_uuid
    and (owner_id = account_row.id or account_row.role = 'owner');
end;
$$;

create or replace function public.create_blog_comment(session_token uuid, post_uuid uuid, parent_uuid uuid, body_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  comment_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  insert into public.blog_comments(post_id, parent_id, owner_id, body)
  values (post_uuid, parent_uuid, account_row.id, body_input)
  returning id into comment_uuid;
  return comment_uuid;
end;
$$;

create or replace function public.delete_blog_comment(session_token uuid, comment_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  delete from public.blog_comments
  where id = comment_uuid
    and (owner_id = account_row.id or account_row.role = 'owner');
end;
$$;

create or replace function public.toggle_blog_like(session_token uuid, post_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if exists (select 1 from public.blog_post_likes where post_id = post_uuid and owner_id = account_row.id) then
    delete from public.blog_post_likes where post_id = post_uuid and owner_id = account_row.id;
  else
    insert into public.blog_post_likes(post_id, owner_id) values (post_uuid, account_row.id);
  end if;
end;
$$;

create or replace function public.create_chat_message(session_token uuid, body_input text, image_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  message_uuid uuid;
  clean_body text := nullif(trim(body_input), '');
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if clean_body is null and image_input is null then
    raise exception 'Message cannot be empty';
  end if;
  insert into public.chat_messages(owner_id, body, image_url)
  values (account_row.id, clean_body, image_input)
  returning id into message_uuid;
  return message_uuid;
end;
$$;

create or replace function public.create_chat_message(session_token uuid, body_input text, image_input text, parent_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  message_uuid uuid;
  clean_body text := nullif(trim(body_input), '');
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if clean_body is null and image_input is null then
    raise exception 'Message cannot be empty';
  end if;
  insert into public.chat_messages(parent_id, owner_id, body, image_url)
  values (parent_uuid, account_row.id, clean_body, image_input)
  returning id into message_uuid;
  return message_uuid;
end;
$$;

create or replace function public.delete_chat_message(session_token uuid, message_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  delete from public.chat_messages
  where id = message_uuid
    and (owner_id = account_row.id or account_row.role = 'owner');
end;
$$;

create or replace function public.toggle_chat_like(session_token uuid, message_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if exists (select 1 from public.chat_message_likes where message_id = message_uuid and owner_id = account_row.id) then
    delete from public.chat_message_likes where message_id = message_uuid and owner_id = account_row.id;
  else
    insert into public.chat_message_likes(message_id, owner_id) values (message_uuid, account_row.id);
  end if;
end;
$$;

create or replace function public.create_health_event_log(session_token uuid, event_time_input timestamptz, medicine_input text, note_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  record_uuid uuid;
  clean_medicine text := nullif(trim(medicine_input), '');
  clean_note text := nullif(trim(note_input), '');
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if clean_medicine is null and clean_note is null then
    raise exception 'Record cannot be empty';
  end if;
  insert into public.health_event_logs(owner_id, event_time, medicine_name, note)
  values (account_row.id, coalesce(event_time_input, now()), clean_medicine, clean_note)
  returning id into record_uuid;
  return record_uuid;
end;
$$;

create or replace function public.delete_health_event_log(session_token uuid, record_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  delete from public.health_event_logs
  where id = record_uuid
    and (owner_id = account_row.id or account_row.role = 'owner');
end;
$$;

create or replace function public.create_koi_wish(session_token uuid, wish_key_input text, wish_text_input text, cost_input integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  earned_coins integer;
  spent_coins integer;
  wish_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  if cost_input not in (6, 9, 12, 15, 24, 36) then
    raise exception 'Invalid wish cost';
  end if;
  if char_length(trim(wish_text_input)) < 2 or char_length(trim(wish_text_input)) > 40 then
    raise exception 'Invalid wish text';
  end if;

  select
    coalesce((select count(*) from public.blog_post_likes where owner_id = account_row.id), 0)
    + coalesce((select count(*) * 3 from public.blog_comments where owner_id = account_row.id), 0)
  into earned_coins;

  select coalesce(sum(cost), 0)
  into spent_coins
  from public.koi_wishes
  where owner_id = account_row.id;

  if earned_coins - spent_coins < cost_input then
    raise exception 'Not enough koi coins';
  end if;

  insert into public.koi_wishes(owner_id, wish_key, wish_text, cost)
  values (account_row.id, trim(wish_key_input), trim(wish_text_input), cost_input)
  returning id into wish_uuid;
  return wish_uuid;
end;
$$;

create or replace function public.create_lottery_topic(session_token uuid, topic_date_input date, topic_text_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  topic_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null or account_row.role <> 'owner' then
    raise exception 'Only owner can create lottery topic';
  end if;
  insert into public.lottery_topics(topic_date, owner_id, topic_text)
  values (topic_date_input, account_row.id, trim(topic_text_input))
  on conflict (topic_date) do update
    set topic_text = excluded.topic_text,
        owner_id = excluded.owner_id
  returning id into topic_uuid;
  return topic_uuid;
end;
$$;

create or replace function public.enter_lottery(session_token uuid, topic_uuid uuid, body_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  entry_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then
    raise exception 'Please log in first';
  end if;
  insert into public.lottery_entries(topic_id, owner_id, body)
  values (topic_uuid, account_row.id, trim(body_input))
  returning id into entry_uuid;
  return entry_uuid;
exception
  when unique_violation then
    raise exception 'Already entered today';
end;
$$;

grant execute on function public.register_blog_account(text, text) to anon, authenticated;
grant execute on function public.login_blog_account(text, text) to anon, authenticated;
grant execute on function public.get_blog_session(uuid) to anon, authenticated;
grant execute on function public.update_blog_avatar(uuid, jsonb) to anon, authenticated;
grant execute on function public.create_blog_post(uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_blog_post(uuid, uuid) to anon, authenticated;
grant execute on function public.create_blog_comment(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_blog_comment(uuid, uuid) to anon, authenticated;
grant execute on function public.toggle_blog_like(uuid, uuid) to anon, authenticated;
grant execute on function public.create_chat_message(uuid, text, text) to anon, authenticated;
grant execute on function public.create_chat_message(uuid, text, text, uuid) to anon, authenticated;
grant execute on function public.delete_chat_message(uuid, uuid) to anon, authenticated;
grant execute on function public.toggle_chat_like(uuid, uuid) to anon, authenticated;
grant execute on function public.create_health_event_log(uuid, timestamptz, text, text) to anon, authenticated;
grant execute on function public.delete_health_event_log(uuid, uuid) to anon, authenticated;
grant execute on function public.create_koi_wish(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.create_lottery_topic(uuid, date, text) to anon, authenticated;
grant execute on function public.enter_lottery(uuid, uuid, text) to anon, authenticated;

-- After registering your owner ID, replace your-id and run once:
-- update public.blog_accounts set role = 'owner' where handle = 'your-id';
create or replace function public.create_blog_podcast(
  session_token uuid,
  publish_date_input date,
  issue_no_input integer,
  topic_input text,
  audio_url_input text,
  music_url_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  podcast_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null or account_row.role <> 'owner' then
    raise exception 'Only the owner can publish podcasts';
  end if;
  insert into public.blog_podcasts(owner_id, publish_date, issue_no, topic, audio_url, music_url)
  values (account_row.id, publish_date_input, issue_no_input, trim(topic_input), audio_url_input, nullif(music_url_input, ''))
  returning id into podcast_uuid;
  return podcast_uuid;
end;
$$;

create or replace function public.delete_blog_podcast(session_token uuid, podcast_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null or account_row.role <> 'owner' then
    raise exception 'Only the owner can delete podcasts';
  end if;
  delete from public.blog_podcasts where id = podcast_uuid;
end;
$$;

create or replace function public.create_podcast_comment(session_token uuid, podcast_uuid uuid, parent_uuid uuid, body_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  comment_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then raise exception 'Please log in first'; end if;
  insert into public.podcast_comments(podcast_id, parent_id, owner_id, body)
  values (podcast_uuid, parent_uuid, account_row.id, trim(body_input))
  returning id into comment_uuid;
  return comment_uuid;
end;
$$;

create or replace function public.delete_podcast_comment(session_token uuid, comment_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then raise exception 'Please log in first'; end if;
  delete from public.podcast_comments
  where id = comment_uuid and (owner_id = account_row.id or account_row.role = 'owner');
end;
$$;

create or replace function public.toggle_podcast_like(session_token uuid, podcast_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null then raise exception 'Please log in first'; end if;
  if exists (select 1 from public.podcast_likes where podcast_id = podcast_uuid and owner_id = account_row.id) then
    delete from public.podcast_likes where podcast_id = podcast_uuid and owner_id = account_row.id;
  else
    insert into public.podcast_likes(podcast_id, owner_id) values (podcast_uuid, account_row.id);
  end if;
end;
$$;

grant execute on function public.create_blog_podcast(uuid, date, integer, text, text, text) to anon, authenticated;
grant execute on function public.delete_blog_podcast(uuid, uuid) to anon, authenticated;
grant execute on function public.create_podcast_comment(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_podcast_comment(uuid, uuid) to anon, authenticated;
grant execute on function public.toggle_podcast_like(uuid, uuid) to anon, authenticated;

create or replace function public.create_cabin_artwork(session_token uuid, category_input text, title_input text, image_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.blog_accounts;
  artwork_uuid uuid;
begin
  select * into account_row from public.account_from_token(session_token);
  if account_row.id is null or account_row.role <> 'owner' then
    raise exception 'Only the owner can add artwork';
  end if;
  insert into public.cabin_artworks(owner_id, category, title, image_url)
  values (account_row.id, category_input, trim(title_input), image_input)
  returning id into artwork_uuid;
  return artwork_uuid;
end;
$$;

grant execute on function public.create_cabin_artwork(uuid, text, text, text) to anon, authenticated;

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
