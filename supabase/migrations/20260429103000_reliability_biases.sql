alter table public.reliability_scores
  add column if not exists temperature_bias_c double precision,
  add column if not exists precipitation_bias_mm double precision,
  add column if not exists wind_speed_bias_kmh double precision;