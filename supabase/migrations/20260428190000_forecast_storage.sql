create table if not exists public.locations (
  id bigserial primary key,
  name text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forecast_runs (
  id bigserial primary key,
  location_id bigint not null references public.locations(id) on delete cascade,
  provider text not null,
  provider_model text,
  issued_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  timezone text,
  utc_offset_seconds integer,
  elevation_m double precision,
  raw_payload jsonb,
  unique (location_id, provider, issued_at)
);

create index if not exists forecast_runs_location_issued_idx
  on public.forecast_runs(location_id, issued_at desc);

create table if not exists public.forecast_days (
  id bigserial primary key,
  forecast_run_id bigint not null references public.forecast_runs(id) on delete cascade,
  location_id bigint not null references public.locations(id) on delete cascade,
  target_date date not null,
  horizon_days integer not null check (horizon_days between 1 and 5),
  weather_code integer,
  temperature_max_c double precision,
  temperature_min_c double precision,
  apparent_temperature_max_c double precision,
  apparent_temperature_min_c double precision,
  precipitation_sum_mm double precision,
  precipitation_probability_max_pct double precision,
  rain_sum_mm double precision,
  showers_sum_mm double precision,
  snowfall_sum_cm double precision,
  wind_speed_max_kmh double precision,
  wind_gusts_max_kmh double precision,
  wind_direction_dominant_deg integer,
  sunshine_duration_seconds integer,
  daylight_duration_seconds integer,
  sunrise_at timestamptz,
  sunset_at timestamptz,
  evapotranspiration_mm double precision,
  raw_daily jsonb,
  unique (forecast_run_id, target_date)
);

create index if not exists forecast_days_location_target_idx
  on public.forecast_days(location_id, target_date);

create index if not exists forecast_days_location_horizon_idx
  on public.forecast_days(location_id, horizon_days);

create table if not exists public.observations (
  id bigserial primary key,
  location_id bigint not null references public.locations(id) on delete cascade,
  observed_at timestamptz not null,
  temperature_c double precision,
  precipitation_mm double precision,
  wind_speed_kmh double precision,
  created_at timestamptz not null default now()
);

create index if not exists observations_location_observed_idx
  on public.observations(location_id, observed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_set_updated_at on public.locations;

create trigger locations_set_updated_at
before update on public.locations
for each row
execute function public.set_updated_at();

insert into public.locations (name, latitude, longitude, timezone)
values ('Barcelona', 41.3874, 2.1686, 'Europe/Madrid')
on conflict (name) do update
set latitude = excluded.latitude,
    longitude = excluded.longitude,
    timezone = excluded.timezone;

create or replace function public.ingest_openmeteo_daily_forecast(
  p_location_name text,
  p_provider text,
  p_payload jsonb,
  p_provider_model text default null
)
returns bigint
language plpgsql
as $$
declare
  v_location_id bigint;
  v_run_id bigint;
  v_issued_at timestamptz;
  v_daily jsonb;
begin
  select id into v_location_id
  from public.locations
  where name = p_location_name;

  if v_location_id is null then
    raise exception 'Unknown location: %', p_location_name;
  end if;

  v_issued_at := coalesce(
    (p_payload ->> 'generationtime_ms')::text::timestamptz,
    now()
  );

  if p_payload ? 'current' and (p_payload -> 'current') ? 'time' then
    v_issued_at := (p_payload -> 'current' ->> 'time')::timestamptz;
  elsif p_payload ? 'current_weather' and (p_payload -> 'current_weather') ? 'time' then
    v_issued_at := (p_payload -> 'current_weather' ->> 'time')::timestamptz;
  else
    v_issued_at := now();
  end if;

  insert into public.forecast_runs (
    location_id,
    provider,
    provider_model,
    issued_at,
    fetched_at,
    latitude,
    longitude,
    timezone,
    utc_offset_seconds,
    elevation_m,
    raw_payload
  )
  values (
    v_location_id,
    p_provider,
    p_provider_model,
    v_issued_at,
    now(),
    nullif(p_payload ->> 'latitude', '')::double precision,
    nullif(p_payload ->> 'longitude', '')::double precision,
    p_payload ->> 'timezone',
    nullif(p_payload ->> 'utc_offset_seconds', '')::integer,
    nullif(p_payload ->> 'elevation', '')::double precision,
    p_payload
  )
  on conflict (location_id, provider, issued_at) do update
  set provider_model = excluded.provider_model,
      fetched_at = excluded.fetched_at,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      timezone = excluded.timezone,
      utc_offset_seconds = excluded.utc_offset_seconds,
      elevation_m = excluded.elevation_m,
      raw_payload = excluded.raw_payload
  returning id into v_run_id;

  v_daily := p_payload -> 'daily';

  if v_daily is null then
    raise exception 'Payload must contain a daily object';
  end if;

  delete from public.forecast_days where forecast_run_id = v_run_id;

  insert into public.forecast_days (
    forecast_run_id,
    location_id,
    target_date,
    horizon_days,
    weather_code,
    temperature_max_c,
    temperature_min_c,
    apparent_temperature_max_c,
    apparent_temperature_min_c,
    precipitation_sum_mm,
    precipitation_probability_max_pct,
    rain_sum_mm,
    showers_sum_mm,
    snowfall_sum_cm,
    wind_speed_max_kmh,
    wind_gusts_max_kmh,
    wind_direction_dominant_deg,
    sunshine_duration_seconds,
    daylight_duration_seconds,
    sunrise_at,
    sunset_at,
    evapotranspiration_mm,
    raw_daily
  )
  select
    v_run_id,
    v_location_id,
    (day_item.value #>> '{}')::date as target_date,
    day_item.ordinality::integer as horizon_days,
    nullif(v_daily -> 'weather_code' ->> (day_item.ordinality - 1), '')::integer,
    nullif(v_daily -> 'temperature_2m_max' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'temperature_2m_min' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'apparent_temperature_max' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'apparent_temperature_min' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'precipitation_sum' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'precipitation_probability_max' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'rain_sum' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'showers_sum' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'snowfall_sum' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'wind_speed_10m_max' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'wind_gusts_10m_max' ->> (day_item.ordinality - 1), '')::double precision,
    nullif(v_daily -> 'wind_direction_10m_dominant' ->> (day_item.ordinality - 1), '')::integer,
    nullif(v_daily -> 'sunshine_duration' ->> (day_item.ordinality - 1), '')::integer,
    nullif(v_daily -> 'daylight_duration' ->> (day_item.ordinality - 1), '')::integer,
    nullif(v_daily -> 'sunrise' ->> (day_item.ordinality - 1), '')::timestamptz,
    nullif(v_daily -> 'sunset' ->> (day_item.ordinality - 1), '')::timestamptz,
    nullif(v_daily -> 'et0_fao_evapotranspiration' ->> (day_item.ordinality - 1), '')::double precision,
    jsonb_build_object(
      'time', v_daily -> 'time' -> (day_item.ordinality - 1),
      'weather_code', v_daily -> 'weather_code' -> (day_item.ordinality - 1),
      'temperature_2m_max', v_daily -> 'temperature_2m_max' -> (day_item.ordinality - 1),
      'temperature_2m_min', v_daily -> 'temperature_2m_min' -> (day_item.ordinality - 1),
      'apparent_temperature_max', v_daily -> 'apparent_temperature_max' -> (day_item.ordinality - 1),
      'apparent_temperature_min', v_daily -> 'apparent_temperature_min' -> (day_item.ordinality - 1),
      'precipitation_sum', v_daily -> 'precipitation_sum' -> (day_item.ordinality - 1),
      'precipitation_probability_max', v_daily -> 'precipitation_probability_max' -> (day_item.ordinality - 1),
      'rain_sum', v_daily -> 'rain_sum' -> (day_item.ordinality - 1),
      'showers_sum', v_daily -> 'showers_sum' -> (day_item.ordinality - 1),
      'snowfall_sum', v_daily -> 'snowfall_sum' -> (day_item.ordinality - 1),
      'wind_speed_10m_max', v_daily -> 'wind_speed_10m_max' -> (day_item.ordinality - 1),
      'wind_gusts_10m_max', v_daily -> 'wind_gusts_10m_max' -> (day_item.ordinality - 1),
      'wind_direction_10m_dominant', v_daily -> 'wind_direction_10m_dominant' -> (day_item.ordinality - 1),
      'sunrise', v_daily -> 'sunrise' -> (day_item.ordinality - 1),
      'sunset', v_daily -> 'sunset' -> (day_item.ordinality - 1),
      'sunshine_duration', v_daily -> 'sunshine_duration' -> (day_item.ordinality - 1),
      'daylight_duration', v_daily -> 'daylight_duration' -> (day_item.ordinality - 1),
      'et0_fao_evapotranspiration', v_daily -> 'et0_fao_evapotranspiration' -> (day_item.ordinality - 1)
    )
  from jsonb_array_elements(v_daily -> 'time') with ordinality as day_item(value, ordinality)
  where day_item.ordinality between 1 and 5;

  return v_run_id;
end;
$$;