-- Safe SQL script for Profile updates
-- Run this in Supabase SQL Editor

-- 1. Add 'username' column to profiles if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'username') then
    alter table profiles add column username text;
  end if;
end $$;

-- 2. Add 'avatar_url' column to profiles if it doesn't exist (good to have for future)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_url') then
    alter table profiles add column avatar_url text;
  end if;
end $$;
