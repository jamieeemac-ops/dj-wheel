-- Core tables
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text,
  avatar text,
  color text,
  player_id text,
  total_tracks int default 0,
  sessions_count int default 0,
  created_at timestamp default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamp default now(),
  ended_at timestamp,
  tracks_per_turn int default 1,
  active_index int default 0,
  tracks_this_turn int default 0
);

create table if not exists session_participants (
  session_id uuid references sessions(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  position int,
  primary key (session_id, profile_id)
);

create table if not exists session_stats (
  session_id uuid references sessions(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  tracks int default 0,
  player_id text,
  primary key (session_id, profile_id)
);

-- increment helper
create or replace function increment_track(s_id uuid, p_id uuid) returns void language sql as $$
  update session_stats set tracks = coalesce(tracks,0) + 1
  where session_id = s_id and profile_id = p_id;
$$;

-- Keep it open for the pilot (tighten later)
alter table profiles disable row level security;
alter table sessions disable row level security;
alter table session_participants disable row level security;
alter table session_stats disable row level security;
