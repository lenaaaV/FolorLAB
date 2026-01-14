-- Create table for Simulation/Test User Data
-- Run this in Supabase SQL Editor

create table if not exists simulation_profiles (
  id uuid default uuid_generate_v4() primary key,
  tester_id text unique not null,
  mood_score integer, -- 1 (Stressed) to 10 (Relaxed) or similar scale
  gaming_frequency text, -- 'Häufig', 'Ab und zu', 'Nie'
  started_at timestamp with time zone default now()
);

-- Enable RLS (Row Level Security) - optional for now, but good practice
alter table simulation_profiles enable row level security;

-- Policy: Allow anyone (anon) to insert if they have a unique tester_id
-- Ideally we would restrict this, but for a prototype/simulation, anon insert is easiest without full auth
create policy "Enable insert for everyone" on simulation_profiles for insert with check (true);

-- Policy: Allow reading own data (if we needed it, but mostly we just insert)
create policy "Enable select for everyone" on simulation_profiles for select using (true);
