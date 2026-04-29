alter table public.observations
  add column if not exists wind_gusts_kmh double precision;

alter table public.reliability_scores
  add column if not exists wind_gusts_mae_kmh double precision,
  add column if not exists wind_gusts_bias_kmh double precision;