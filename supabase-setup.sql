create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  avatar jsonb not null default '{"color":"#b62548","shape":"circle","mark":"R"}'::jsonb,
  role text not null default 'member' check (role in ('member', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handle_length check (char_length(handle) between 2 and 24)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('日志', '小说', '相册', '心情')),
  title text not null,
  body text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint title_length check (char_length(title) between 1 and 80),
  constraint body_length check (char_length(body) between 1 and 4000)
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  parent_id uuid references public.blog_comments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comment_length check (char_length(body) between 1 and 500)
);

alter table public.profiles enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable"
on public.profiles for select
using (true);

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile"
on public.profiles for insert
with check (auth.uid() = user_id and role = 'member');

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke update (role) on public.profiles from anon, authenticated;
grant update (handle, display_name, avatar, updated_at) on public.profiles to authenticated;

drop policy if exists "posts are readable" on public.blog_posts;
create policy "posts are readable"
on public.blog_posts for select
using (true);

drop policy if exists "signed in users write posts" on public.blog_posts;
create policy "signed in users write posts"
on public.blog_posts for insert
with check (auth.uid() = owner_id);

drop policy if exists "authors update own posts" on public.blog_posts;
create policy "authors update own posts"
on public.blog_posts for update
using (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'owner')
)
with check (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'owner')
);

drop policy if exists "authors or owner delete posts" on public.blog_posts;
create policy "authors or owner delete posts"
on public.blog_posts for delete
using (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'owner')
);

drop policy if exists "comments are readable" on public.blog_comments;
create policy "comments are readable"
on public.blog_comments for select
using (true);

drop policy if exists "signed in users comment" on public.blog_comments;
create policy "signed in users comment"
on public.blog_comments for insert
with check (auth.uid() = owner_id);

drop policy if exists "comment authors or owner delete comments" on public.blog_comments;
create policy "comment authors or owner delete comments"
on public.blog_comments for delete
using (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'owner')
);

-- 注册好你的站主账号后，把下面这一行里的 your-id 改成你的永久 ID，运行一次：
-- update public.profiles set role = 'owner' where handle = 'your-id';
