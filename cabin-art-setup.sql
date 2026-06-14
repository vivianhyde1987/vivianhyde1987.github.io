create table if not exists public.cabin_artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  category text not null check (category in ('oil', 'ink', 'child')),
  title text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  constraint cabin_artwork_title_length check (char_length(title) between 1 and 60)
);

alter table public.cabin_artworks enable row level security;

drop policy if exists "cabin artworks are readable" on public.cabin_artworks;
create policy "cabin artworks are readable"
on public.cabin_artworks for select
using (true);

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
notify pgrst, 'reload schema';
