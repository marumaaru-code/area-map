-- Run this SQL in your Supabase project's SQL editor

create table if not exists facilities (
  id text primary key,
  source text not null check (source in ('osm', 'manual')),
  category text not null check (category in ('construction', 'wedding', 'roadside_station', 'kindergarten', 'furniture')),
  name text not null,
  name_ja text,
  lat double precision not null,
  lng double precision not null,
  address text,
  website text,
  instagram_url text,
  instagram_username text,
  concept_memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  posted_at timestamptz not null default now(),
  theme text not null,
  caption text,
  format text not null check (format in ('reel', 'feed', 'story')),
  likes integer not null default 0,
  saves integer not null default 0,
  comments integer not null default 0,
  memo text,
  created_at timestamptz default now()
);

create table if not exists own_account_profile (
  id integer primary key default 1,
  concept_memo text,
  target_area text,
  brand_tone text,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (adjust policies for your team setup)
alter table facilities enable row level security;
alter table posts enable row level security;
alter table own_account_profile enable row level security;

-- For MVP (no auth): allow all operations from anon key
create policy "Allow all on facilities" on facilities for all using (true) with check (true);
create policy "Allow all on posts" on posts for all using (true) with check (true);
create policy "Allow all on own_account_profile" on own_account_profile for all using (true) with check (true);
