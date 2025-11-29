-- Seed data for Memory Board
-- Run this in Supabase SQL Editor

-- Insert some sample posts
-- We select the first user found in auth.users to be the author

-- 0. Remove strict foreign key constraint to allow "Mock Users" (Community posts)
alter table posts drop constraint if exists posts_user_id_fkey;

-- 1. Clear existing posts for this location to avoid duplicates/old data
delete from posts where location_name = 'TU Darmstadt';

-- 1. An inspiring text memory
insert into posts (user_id, content, location_name, visibility, author_name, media_type, type, created_at)
values (
  uuid_generate_v4(), -- Random user ID so it doesn't show in "Mine"
  'Ich erinnere mich noch genau an meinen ersten Tag hier. Die Sonne schien durch die Blätter und alles fühlte sich nach einem neuen Anfang an. 🌿',
  'TU Darmstadt',
  'public',
  'Lena M.',
  'text',
  'text',
  now() - interval '2 days'
);

-- 2. A post with an image (using a reliable Wikipedia image)
insert into posts (user_id, content, location_name, visibility, author_name, media_type, type, media_url, created_at)
values (
  uuid_generate_v4(),
  'Der Campus im Herbst ist einfach unschlagbar. Diese Farben! 🍂📸',
  'TU Darmstadt',
  'public',
  'Tom K.',
  'image',
  'image',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/TU_Darmstadt_Karo_5.jpg/800px-TU_Darmstadt_Karo_5.jpg',
  now() - interval '5 hours'
);

-- 3. Another community moment
insert into posts (user_id, content, location_name, visibility, author_name, media_type, type, created_at)
values (
  uuid_generate_v4(),
  'Lernpause mit der besten Aussicht. Wer kommt dazu? ☕️',
  'TU Darmstadt',
  'public',
  'Max',
  'text',
  'text',
  now() - interval '30 minutes'
);
