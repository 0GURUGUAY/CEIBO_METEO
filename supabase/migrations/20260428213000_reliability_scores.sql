create table if not exists public.reliability_scores (
  id bigserial primary key,
  location_id bigint not null references public.locations(id) on delete cascade,
  horizon_hours integer not null check (horizon_hours between 3 and 120),
  sample_count integer not null default 0 check (sample_count >= 0),
  temperature_mae_c double precision,
  precipitation_mae_mm double precision,
  wind_speed_mae_kmh double precision,
  score_pct double precision not null check (score_pct between 0 and 100),
  calculated_at timestamptz not null default now(),
  unique (location_id, horizon_hours)
);

create index if not exists reliability_scores_location_score_idx
  on public.reliability_scores(location_id, score_pct desc);