create table if not exists public.forecast_periods (
  id bigserial primary key,
  forecast_run_id bigint not null references public.forecast_runs(id) on delete cascade,
  location_id bigint not null references public.locations(id) on delete cascade,
  period_start_at timestamptz not null,
  horizon_hours integer not null check (horizon_hours between 3 and 120),
  weather_code integer,
  temperature_c double precision,
  apparent_temperature_c double precision,
  precipitation_mm double precision,
  precipitation_probability_pct double precision,
  rain_mm double precision,
  showers_mm double precision,
  snowfall_cm double precision,
  cloud_cover_pct double precision,
  surface_pressure_hpa double precision,
  relative_humidity_pct double precision,
  wind_speed_kmh double precision,
  wind_gusts_kmh double precision,
  wind_direction_deg integer,
  is_day boolean,
  raw_period jsonb,
  unique (forecast_run_id, period_start_at)
);

create index if not exists forecast_periods_location_time_idx
  on public.forecast_periods(location_id, period_start_at);

create index if not exists forecast_periods_location_horizon_idx
  on public.forecast_periods(location_id, horizon_hours);