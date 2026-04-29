import { prisma } from '../lib/prisma.js';

const MISSING_RELIABILITY_SCORES_TABLE_MESSAGE =
  'La table reliability_scores est absente. Applique la migration SQL 20260428213000_reliability_scores.sql pour activer le calcul de fiabilité.';

interface ReliabilityAccumulator {
  locationId: number;
  horizonHours: number;
  sampleCount: number;
  temperatureErrorSum: number;
  temperatureBiasSum: number;
  temperatureSamples: number;
  precipitationErrorSum: number;
  precipitationBiasSum: number;
  precipitationSamples: number;
  windSpeedErrorSum: number;
  windSpeedBiasSum: number;
  windSpeedSamples: number;
  windGustsErrorSum: number;
  windGustsBiasSum: number;
  windGustsSamples: number;
}

export async function calculateReliabilityScores(lookbackDays: number, locationId?: number) {
  const locations = await prisma.location.findMany({
    where: locationId ? { id: locationId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) {
    throw new Error('No location found for reliability calculation');
  }

  const locationIds = locations.map((location) => location.id);
  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - lookbackDays);

  const [periods, observations] = await Promise.all([
    prisma.forecastPeriod.findMany({
      where: {
        locationId: { in: locationIds },
        periodStartAt: {
          gte: lookbackStart,
          lte: new Date(),
        },
      },
      select: {
        locationId: true,
        horizonHours: true,
        periodStartAt: true,
        temperatureC: true,
        precipitationMm: true,
        windSpeedKmh: true,
        windGustsKmh: true,
      },
      orderBy: [{ locationId: 'asc' }, { horizonHours: 'asc' }, { periodStartAt: 'asc' }],
    }),
    prisma.observation.findMany({
      where: {
        locationId: { in: locationIds },
        observedAt: {
          gte: lookbackStart,
          lte: new Date(),
        },
      },
      select: {
        locationId: true,
        observedAt: true,
        temperatureC: true,
        precipitationMm: true,
        windSpeedKmh: true,
        windGustsKmh: true,
      },
    }),
  ]);

  const observationByKey = new Map(
    observations.map((observation) => [buildObservationKey(observation.locationId, observation.observedAt), observation]),
  );

  const accumulators = new Map<string, ReliabilityAccumulator>();

  for (const period of periods) {
    const observation = observationByKey.get(buildObservationKey(period.locationId, period.periodStartAt));
    if (!observation) {
      continue;
    }

    const key = `${period.locationId}:${period.horizonHours}`;
    const accumulator =
      accumulators.get(key) ??
      {
        locationId: period.locationId,
        horizonHours: period.horizonHours,
        sampleCount: 0,
        temperatureErrorSum: 0,
        temperatureBiasSum: 0,
        temperatureSamples: 0,
        precipitationErrorSum: 0,
        precipitationBiasSum: 0,
        precipitationSamples: 0,
        windSpeedErrorSum: 0,
        windSpeedBiasSum: 0,
        windSpeedSamples: 0,
        windGustsErrorSum: 0,
        windGustsBiasSum: 0,
        windGustsSamples: 0,
      };

    accumulator.sampleCount += 1;

    if (period.temperatureC !== null && observation.temperatureC !== null) {
      const temperatureDiff = period.temperatureC - observation.temperatureC;
      accumulator.temperatureErrorSum += Math.abs(temperatureDiff);
      accumulator.temperatureBiasSum += temperatureDiff;
      accumulator.temperatureSamples += 1;
    }

    if (period.precipitationMm !== null && observation.precipitationMm !== null) {
      const precipitationDiff = period.precipitationMm - observation.precipitationMm;
      accumulator.precipitationErrorSum += Math.abs(precipitationDiff);
      accumulator.precipitationBiasSum += precipitationDiff;
      accumulator.precipitationSamples += 1;
    }

    if (period.windSpeedKmh !== null && observation.windSpeedKmh !== null) {
      const windSpeedDiff = period.windSpeedKmh - observation.windSpeedKmh;
      accumulator.windSpeedErrorSum += Math.abs(windSpeedDiff);
      accumulator.windSpeedBiasSum += windSpeedDiff;
      accumulator.windSpeedSamples += 1;
    }

    if (period.windGustsKmh !== null && observation.windGustsKmh !== null) {
      const windGustsDiff = period.windGustsKmh - observation.windGustsKmh;
      accumulator.windGustsErrorSum += Math.abs(windGustsDiff);
      accumulator.windGustsBiasSum += windGustsDiff;
      accumulator.windGustsSamples += 1;
    }

    accumulators.set(key, accumulator);
  }

  const calculatedAt = new Date();
  const scores = Array.from(accumulators.values()).map((accumulator) => {
    const temperatureMaeC = toAverage(accumulator.temperatureErrorSum, accumulator.temperatureSamples);
    const temperatureBiasC = toAverage(accumulator.temperatureBiasSum, accumulator.temperatureSamples);
    const precipitationMaeMm = toAverage(accumulator.precipitationErrorSum, accumulator.precipitationSamples);
    const precipitationBiasMm = toAverage(accumulator.precipitationBiasSum, accumulator.precipitationSamples);
    const windSpeedMaeKmh = toAverage(accumulator.windSpeedErrorSum, accumulator.windSpeedSamples);
    const windSpeedBiasKmh = toAverage(accumulator.windSpeedBiasSum, accumulator.windSpeedSamples);
    const windGustsMaeKmh = toAverage(accumulator.windGustsErrorSum, accumulator.windGustsSamples);
    const windGustsBiasKmh = toAverage(accumulator.windGustsBiasSum, accumulator.windGustsSamples);

    return {
      locationId: accumulator.locationId,
      horizonHours: accumulator.horizonHours,
      sampleCount: accumulator.sampleCount,
      temperatureMaeC,
      temperatureBiasC,
      precipitationMaeMm,
      precipitationBiasMm,
      windSpeedMaeKmh,
      windSpeedBiasKmh,
      windGustsMaeKmh,
      windGustsBiasKmh,
      scorePct: calculateCompositeScore(temperatureMaeC, precipitationMaeMm, windSpeedMaeKmh, windGustsMaeKmh),
      calculatedAt,
    };
  });

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.reliabilityScore.deleteMany({
        where: { locationId: { in: locationIds } },
      });

      if (scores.length > 0) {
        await transaction.reliabilityScore.createMany({ data: scores });
      }
    });
  } catch (error) {
    if (isMissingReliabilityScoresTable(error)) {
      throw new Error(MISSING_RELIABILITY_SCORES_TABLE_MESSAGE);
    }

    throw error;
  }

  return {
    processedLocations: locations.length,
    generatedScores: scores.length,
    calculatedAt: calculatedAt.toISOString(),
  };
}

export async function listReliabilityScores(locationId: number) {
  try {
    return await prisma.reliabilityScore.findMany({
      where: { locationId },
      orderBy: { horizonHours: 'asc' },
    });
  } catch (error) {
    if (isMissingReliabilityScoresTable(error)) {
      throw new Error(MISSING_RELIABILITY_SCORES_TABLE_MESSAGE);
    }

    throw error;
  }
}

function buildObservationKey(locationId: number, timestamp: Date) {
  return `${locationId}:${timestamp.toISOString()}`;
}

function toAverage(total: number, count: number) {
  return count > 0 ? Math.round((total / count) * 100) / 100 : null;
}

function calculateCompositeScore(
  temperatureMaeC: number | null,
  precipitationMaeMm: number | null,
  windSpeedMaeKmh: number | null,
  windGustsMaeKmh: number | null,
) {
  const metrics = [
    { value: normalizeAccuracy(temperatureMaeC, 8), weight: 0.4 },
    { value: normalizeAccuracy(precipitationMaeMm, 6), weight: 0.25 },
    { value: normalizeAccuracy(windSpeedMaeKmh, 25), weight: 0.2 },
    { value: normalizeAccuracy(windGustsMaeKmh, 35), weight: 0.15 },
  ].filter((metric) => metric.value !== null);

  if (metrics.length === 0) {
    return 0;
  }

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const weightedScore = metrics.reduce((sum, metric) => sum + (metric.value ?? 0) * metric.weight, 0) / totalWeight;

  return Math.round(weightedScore * 1000) / 10;
}

function normalizeAccuracy(mae: number | null, cap: number) {
  if (mae === null) {
    return null;
  }

  return Math.max(0, 1 - mae / cap);
}

function isMissingReliabilityScoresTable(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2021' &&
    ((error as { meta?: { modelName?: string; table?: string } }).meta?.modelName === 'ReliabilityScore' ||
      (error as { meta?: { modelName?: string; table?: string } }).meta?.table === 'public.reliability_scores')
  );
}