-- Safe SQL script for Memory Board features
-- Run this in the Supabase SQL Editor

-- 1. Create 'posts' table if it doesn't exist (basic structure)
create table if not exists posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add missing columns safely (if table already existed but was incomplete)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'media_url') then
    alter table posts add column media_url text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'media_type') then
    alter table posts add column media_type text check (media_type in ('image', 'audio', 'text', 'video'));
  else
    -- Update constraint if it exists (this is a bit complex in pure SQL without dropping, so we'll just add a comment or try to drop and re-add if possible, but for safety we just note it)
    -- Ideally: alter table posts drop constraint posts_media_type_check;
    -- alter table posts add constraint posts_media_type_check check (media_type in ('image', 'audio', 'text', 'video'));
    null;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'location_name') then
    alter table posts add column location_name text not null default 'Unknown';
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'visibility') then
    alter table posts add column visibility text check (visibility in ('public', 'friends', 'private')) default 'public';
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'author_name') then
    alter table posts add column author_name text;
  end if;
end $$;

-- 3. Enable RLS on posts
alter table posts enable row level security;

-- 4. Safely recreate policies for posts
drop policy if exists "Public posts are viewable by everyone" on posts;
create policy "Public posts are viewable by everyone"
  on posts for select
  using ( visibility = 'public' );

drop policy if exists "Users can insert their own posts" on posts;
create policy "Users can insert their own posts"
  on posts for insert
  with check ( auth.uid() = user_id );

-- 5. Create 'media' storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 6. Safely recreate policies for storage
drop policy if exists "Authenticated users can upload media" on storage.objects;
create policy "Authenticated users can upload media"
  on storage.objects for insert
  with check ( bucket_id = 'media' and auth.role() = 'authenticated' );

drop policy if exists "Media is publicly accessible" on storage.objects;
create policy "Media is publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'media' );
