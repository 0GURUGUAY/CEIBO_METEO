import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const MISSING_PERIODS_TABLE_MESSAGE =
  'La table forecast_periods est absente. Applique la migration SQL 20260428194500_forecast_periods_3h.sql pour activer les prévisions toutes les 3 heures.';

const OPEN_METEO_DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'rain_sum',
  'showers_sum',
  'snowfall_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'sunrise',
  'sunset',
  'sunshine_duration',
  'daylight_duration',
  'et0_fao_evapotranspiration',
] as const;

const OPEN_METEO_HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'is_day',
] as const;

interface OpenMeteoDailyPayload {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds?: number;
  elevation?: number;
  current?: {
    time?: string;
  };
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    apparent_temperature_max?: Array<number | null>;
    apparent_temperature_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    rain_sum?: Array<number | null>;
    showers_sum?: Array<number | null>;
    snowfall_sum?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
    wind_gusts_10m_max?: Array<number | null>;
    wind_direction_10m_dominant?: Array<number | null>;
    sunrise?: Array<string | null>;
    sunset?: Array<string | null>;
    sunshine_duration?: Array<number | null>;
    daylight_duration?: Array<number | null>;
    et0_fao_evapotranspiration?: Array<number | null>;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    apparent_temperature?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    precipitation?: Array<number | null>;
    rain?: Array<number | null>;
    showers?: Array<number | null>;
    snowfall?: Array<number | null>;
    weather_code?: Array<number | null>;
    cloud_cover?: Array<number | null>;
    surface_pressure?: Array<number | null>;
    relative_humidity_2m?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
    wind_direction_10m?: Array<number | null>;
    is_day?: Array<number | null>;
  };
}

interface OpenMeteoGeocodingPayload {
  results?: Array<{
    name: string;
    country?: string;
    country_code?: string;
    admin1?: string;
    admin2?: string;
    admin3?: string;
    admin4?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
}

export interface LocationSearchResult {
  name: string;
  country: string | null;
  countryCode: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  displayName: string;
}

export async function listLocations() {
  return prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function searchLocations(query: string) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'fr');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoGeocodingPayload;

  return (payload.results ?? []).map((result) => ({
    name: result.name,
    country: result.country ?? null,
    countryCode: result.country_code ?? null,
    admin1: result.admin1 ?? result.admin2 ?? result.admin3 ?? result.admin4 ?? null,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone ?? null,
    displayName: buildLocationDisplayName(result.name, result.country ?? null, result.admin1 ?? result.admin2 ?? result.admin3 ?? result.admin4 ?? null),
  }));
}

export async function addLocation(searchResult: LocationSearchResult) {
  return prisma.location.upsert({
    where: {
      name: searchResult.displayName,
    },
    create: {
      name: searchResult.displayName,
      latitude: searchResult.latitude,
      longitude: searchResult.longitude,
      timezone: searchResult.timezone,
    },
    update: {
      latitude: searchResult.latitude,
      longitude: searchResult.longitude,
      timezone: searchResult.timezone,
    },
  });
}

export async function deleteLocation(locationId: number) {
  return prisma.location.delete({
    where: {
      id: locationId,
    },
  });
}

export async function updateLocationNotes(locationId: number, notes: string | null) {
  return prisma.location.update({
    where: {
      id: locationId,
    },
    data: {
      notes,
    },
  });
}

export async function getLatestForecastRun(locationId: number) {
  try {
    return await prisma.forecastRun.findFirst({
      where: { locationId },
      orderBy: { issuedAt: 'desc' },
      include: {
        days: {
          orderBy: { horizonDays: 'asc' },
        },
        periods: {
          orderBy: { periodStartAt: 'asc' },
        },
        location: true,
      },
    });
  } catch (error) {
    if (isMissingForecastPeriodsTable(error)) {
      const forecastRun = await prisma.forecastRun.findFirst({
        where: { locationId },
        orderBy: { issuedAt: 'desc' },
        include: {
          days: {
            orderBy: { horizonDays: 'asc' },
          },
          location: true,
        },
      });

      return forecastRun ? { ...forecastRun, periods: [] } : null;
    }

    throw error;
  }
}

export async function collectForecasts(locationId?: number) {
  const locations = await prisma.location.findMany({
    where: locationId ? { id: locationId } : undefined,
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) {
    throw new Error('No location found for forecast collection');
  }

  const collectedRuns = [] as Array<{ locationId: number; locationName: string; forecastRunId: number; daysStored: number; issuedAt: string }>;

  for (const location of locations) {
    const payload = await fetchOpenMeteoForecast(location.latitude, location.longitude, location.timezone ?? 'Europe/Madrid');
    const issuedAt = payload.current?.time ? new Date(payload.current.time) : new Date();
    const days = (payload.daily?.time ?? []).slice(0, 5);
    const periods = buildThreeHourPeriods(payload, issuedAt);

    const forecastRun = await prisma.forecastRun.upsert({
      where: {
        locationId_provider_issuedAt: {
          locationId: location.id,
          provider: 'open-meteo',
          issuedAt,
        },
      },
      create: {
        locationId: location.id,
        provider: 'open-meteo',
        providerModel: 'best_match',
        issuedAt,
        fetchedAt: new Date(),
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone,
        utcOffsetSeconds: payload.utc_offset_seconds,
        elevationM: payload.elevation,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        fetchedAt: new Date(),
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone,
        utcOffsetSeconds: payload.utc_offset_seconds,
        elevationM: payload.elevation,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.forecastDay.deleteMany({
      where: { forecastRunId: forecastRun.id },
    });

    try {
      await prisma.forecastPeriod.deleteMany({
        where: { forecastRunId: forecastRun.id },
      });
    } catch (error) {
      if (isMissingForecastPeriodsTable(error)) {
        throw new Error(MISSING_PERIODS_TABLE_MESSAGE);
      }

      throw error;
    }

    if (days.length > 0) {
      await prisma.forecastDay.createMany({
        data: days.map((targetDate, index) => ({
          forecastRunId: forecastRun.id,
          locationId: location.id,
          targetDate: new Date(`${targetDate}T00:00:00.000Z`),
          horizonDays: index + 1,
          weatherCode: payload.daily?.weather_code?.[index] ?? null,
          temperatureMaxC: payload.daily?.temperature_2m_max?.[index] ?? null,
          temperatureMinC: payload.daily?.temperature_2m_min?.[index] ?? null,
          apparentTemperatureMaxC: payload.daily?.apparent_temperature_max?.[index] ?? null,
          apparentTemperatureMinC: payload.daily?.apparent_temperature_min?.[index] ?? null,
          precipitationSumMm: payload.daily?.precipitation_sum?.[index] ?? null,
          precipitationProbabilityMaxPct: payload.daily?.precipitation_probability_max?.[index] ?? null,
          rainSumMm: payload.daily?.rain_sum?.[index] ?? null,
          showersSumMm: payload.daily?.showers_sum?.[index] ?? null,
          snowfallSumCm: payload.daily?.snowfall_sum?.[index] ?? null,
          windSpeedMaxKmh: payload.daily?.wind_speed_10m_max?.[index] ?? null,
          windGustsMaxKmh: payload.daily?.wind_gusts_10m_max?.[index] ?? null,
          windDirectionDominantDeg: toInteger(payload.daily?.wind_direction_10m_dominant?.[index]),
          sunshineDurationSeconds: toInteger(payload.daily?.sunshine_duration?.[index]),
          daylightDurationSeconds: toInteger(payload.daily?.daylight_duration?.[index]),
          sunriseAt: toDate(payload.daily?.sunrise?.[index]),
          sunsetAt: toDate(payload.daily?.sunset?.[index]),
          evapotranspirationMm: payload.daily?.et0_fao_evapotranspiration?.[index] ?? null,
          rawDaily: buildRawDaily(payload, index) as Prisma.InputJsonValue,
        })),
      });
    }

    if (periods.length > 0) {
      try {
        await prisma.forecastPeriod.createMany({
          data: periods.map((period) => ({
            forecastRunId: forecastRun.id,
            locationId: location.id,
            periodStartAt: period.periodStartAt,
            horizonHours: period.horizonHours,
            weatherCode: period.weatherCode,
            temperatureC: period.temperatureC,
            apparentTemperatureC: period.apparentTemperatureC,
            precipitationMm: period.precipitationMm,
            precipitationProbabilityPct: period.precipitationProbabilityPct,
            rainMm: period.rainMm,
            showersMm: period.showersMm,
            snowfallCm: period.snowfallCm,
            cloudCoverPct: period.cloudCoverPct,
            surfacePressureHpa: period.surfacePressureHpa,
            relativeHumidityPct: period.relativeHumidityPct,
            windSpeedKmh: period.windSpeedKmh,
            windGustsKmh: period.windGustsKmh,
            windDirectionDeg: period.windDirectionDeg,
            isDay: period.isDay,
            rawPeriod: period.rawPeriod as Prisma.InputJsonValue,
          })),
        });
      } catch (error) {
        if (isMissingForecastPeriodsTable(error)) {
          throw new Error(MISSING_PERIODS_TABLE_MESSAGE);
        }

        throw error;
      }
    }

    collectedRuns.push({
      locationId: location.id,
      locationName: location.name,
      forecastRunId: forecastRun.id,
      daysStored: periods.length,
      issuedAt: forecastRun.issuedAt.toISOString(),
    });
  }

  return {
    processedLocations: locations.length,
    collectedRuns,
  };
}

async function fetchOpenMeteoForecast(latitude: number, longitude: number, timezone: string): Promise<OpenMeteoDailyPayload> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('models', 'best_match');
  url.searchParams.set('current', 'temperature_2m');
  url.searchParams.set('daily', OPEN_METEO_DAILY_FIELDS.join(','));
  url.searchParams.set('hourly', OPEN_METEO_HOURLY_FIELDS.join(','));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  return (await response.json()) as OpenMeteoDailyPayload;
}

function toInteger(value: number | null | undefined) {
  return typeof value === 'number' ? Math.round(value) : null;
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function buildRawDaily(payload: OpenMeteoDailyPayload, index: number) {
  return {
    time: payload.daily?.time?.[index] ?? null,
    weather_code: payload.daily?.weather_code?.[index] ?? null,
    temperature_2m_max: payload.daily?.temperature_2m_max?.[index] ?? null,
    temperature_2m_min: payload.daily?.temperature_2m_min?.[index] ?? null,
    apparent_temperature_max: payload.daily?.apparent_temperature_max?.[index] ?? null,
    apparent_temperature_min: payload.daily?.apparent_temperature_min?.[index] ?? null,
    precipitation_sum: payload.daily?.precipitation_sum?.[index] ?? null,
    precipitation_probability_max: payload.daily?.precipitation_probability_max?.[index] ?? null,
    rain_sum: payload.daily?.rain_sum?.[index] ?? null,
    showers_sum: payload.daily?.showers_sum?.[index] ?? null,
    snowfall_sum: payload.daily?.snowfall_sum?.[index] ?? null,
    wind_speed_10m_max: payload.daily?.wind_speed_10m_max?.[index] ?? null,
    wind_gusts_10m_max: payload.daily?.wind_gusts_10m_max?.[index] ?? null,
    wind_direction_10m_dominant: payload.daily?.wind_direction_10m_dominant?.[index] ?? null,
    sunrise: payload.daily?.sunrise?.[index] ?? null,
    sunset: payload.daily?.sunset?.[index] ?? null,
    sunshine_duration: payload.daily?.sunshine_duration?.[index] ?? null,
    daylight_duration: payload.daily?.daylight_duration?.[index] ?? null,
    et0_fao_evapotranspiration: payload.daily?.et0_fao_evapotranspiration?.[index] ?? null,
  };
}

function buildThreeHourPeriods(payload: OpenMeteoDailyPayload, issuedAt: Date) {
  const times = payload.hourly?.time ?? [];
  const firstEligibleIndex = times.findIndex((time) => {
    const periodStartAt = new Date(time);
    const diffHours = (periodStartAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60);

    return diffHours >= 3;
  });

  if (firstEligibleIndex === -1) {
    return [];
  }

  return times.flatMap((time, index) => {
    if (index < firstEligibleIndex || (index - firstEligibleIndex) % 3 !== 0) {
      return [];
    }

    const periodStartAt = new Date(time);
    const diffHours = Math.ceil((periodStartAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60));

    if (diffHours < 3 || diffHours > 120) {
      return [];
    }

    return [
      {
        periodStartAt,
        horizonHours: diffHours,
        weatherCode: toInteger(payload.hourly?.weather_code?.[index]),
        temperatureC: payload.hourly?.temperature_2m?.[index] ?? null,
        apparentTemperatureC: payload.hourly?.apparent_temperature?.[index] ?? null,
        precipitationMm: payload.hourly?.precipitation?.[index] ?? null,
        precipitationProbabilityPct: payload.hourly?.precipitation_probability?.[index] ?? null,
        rainMm: payload.hourly?.rain?.[index] ?? null,
        showersMm: payload.hourly?.showers?.[index] ?? null,
        snowfallCm: payload.hourly?.snowfall?.[index] ?? null,
        cloudCoverPct: payload.hourly?.cloud_cover?.[index] ?? null,
        surfacePressureHpa: payload.hourly?.surface_pressure?.[index] ?? null,
        relativeHumidityPct: payload.hourly?.relative_humidity_2m?.[index] ?? null,
        windSpeedKmh: payload.hourly?.wind_speed_10m?.[index] ?? null,
        windGustsKmh: payload.hourly?.wind_gusts_10m?.[index] ?? null,
        windDirectionDeg: toInteger(payload.hourly?.wind_direction_10m?.[index]),
        isDay: payload.hourly?.is_day?.[index] === null || payload.hourly?.is_day?.[index] === undefined ? null : payload.hourly?.is_day?.[index] === 1,
        rawPeriod: buildRawPeriod(payload, index),
      },
    ];
  });
}

function buildRawPeriod(payload: OpenMeteoDailyPayload, index: number) {
  return {
    time: payload.hourly?.time?.[index] ?? null,
    temperature_2m: payload.hourly?.temperature_2m?.[index] ?? null,
    apparent_temperature: payload.hourly?.apparent_temperature?.[index] ?? null,
    precipitation_probability: payload.hourly?.precipitation_probability?.[index] ?? null,
    precipitation: payload.hourly?.precipitation?.[index] ?? null,
    rain: payload.hourly?.rain?.[index] ?? null,
    showers: payload.hourly?.showers?.[index] ?? null,
    snowfall: payload.hourly?.snowfall?.[index] ?? null,
    weather_code: payload.hourly?.weather_code?.[index] ?? null,
    cloud_cover: payload.hourly?.cloud_cover?.[index] ?? null,
    surface_pressure: payload.hourly?.surface_pressure?.[index] ?? null,
    relative_humidity_2m: payload.hourly?.relative_humidity_2m?.[index] ?? null,
    wind_speed_10m: payload.hourly?.wind_speed_10m?.[index] ?? null,
    wind_gusts_10m: payload.hourly?.wind_gusts_10m?.[index] ?? null,
    wind_direction_10m: payload.hourly?.wind_direction_10m?.[index] ?? null,
    is_day: payload.hourly?.is_day?.[index] ?? null,
  };
}

function isMissingForecastPeriodsTable(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const message = typeof error.message === 'string' ? error.message : '';

  return (
    error.code === 'P2021' &&
    (error.meta?.modelName === 'ForecastPeriod' ||
      message.includes('public.forecast_periods') ||
      message.includes('forecast_periods'))
  );
}

function buildLocationDisplayName(name: string, country: string | null, admin1: string | null) {
  const parts = [name];

  if (admin1 && admin1.toLowerCase() !== name.toLowerCase()) {
    parts.push(admin1);
  }

  if (country) {
    parts.push(country);
  }

  return parts.join(', ');
}