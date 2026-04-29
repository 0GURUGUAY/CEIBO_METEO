import { prisma } from '../lib/prisma.js';

interface OpenMeteoArchivePayload {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
}

const ARCHIVE_FIELDS = ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m'] as const;

export async function collectObservations(lookbackDays: number, locationId?: number) {
  const locations = await prisma.location.findMany({
    where: locationId ? { id: locationId } : undefined,
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) {
    throw new Error('No location found for observation collection');
  }

  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - lookbackDays);

  const collectedObservations = [] as Array<{
    locationId: number;
    locationName: string;
    observationsStored: number;
    rangeStart: string;
    rangeEnd: string;
  }>;

  for (const location of locations) {
    const payload = await fetchOpenMeteoArchive(
      location.latitude,
      location.longitude,
      location.timezone ?? 'Europe/Madrid',
      formatDate(rangeStart),
      formatDate(today),
    );

    const times = payload.hourly?.time ?? [];

    await prisma.observation.deleteMany({
      where: {
        locationId: location.id,
        observedAt: {
          gte: new Date(`${formatDate(rangeStart)}T00:00:00.000Z`),
          lte: new Date(`${formatDate(today)}T23:59:59.999Z`),
        },
      },
    });

    if (times.length > 0) {
      await prisma.observation.createMany({
        data: times.map((time, index) => ({
          locationId: location.id,
          observedAt: new Date(time),
          temperatureC: payload.hourly?.temperature_2m?.[index] ?? null,
          precipitationMm: payload.hourly?.precipitation?.[index] ?? null,
          windSpeedKmh: payload.hourly?.wind_speed_10m?.[index] ?? null,
          windGustsKmh: payload.hourly?.wind_gusts_10m?.[index] ?? null,
        })),
      });
    }

    collectedObservations.push({
      locationId: location.id,
      locationName: location.name,
      observationsStored: times.length,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: today.toISOString(),
    });
  }

  return {
    processedLocations: locations.length,
    collectedObservations,
  };
}

async function fetchOpenMeteoArchive(
  latitude: number,
  longitude: number,
  timezone: string,
  startDate: string,
  endDate: string,
): Promise<OpenMeteoArchivePayload> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('hourly', ARCHIVE_FIELDS.join(','));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo archive request failed with status ${response.status}`);
  }

  return (await response.json()) as OpenMeteoArchivePayload;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}