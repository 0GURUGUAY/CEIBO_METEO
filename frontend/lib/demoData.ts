import type {
  AutomationStatus,
  ForecastRun,
  Location,
  ProjectOverview,
  ReliabilityScore,
} from './api';

const now = Date.now();

function toIso(offsetHours: number) {
  return new Date(now + offsetHours * 60 * 60 * 1000).toISOString();
}

export const demoOverview: ProjectOverview = {
  title: 'Weather Reliability Lab',
  description:
    'Mesurer la robustesse des prévisions météo de court terme en stockant chaque run puis en le comparant plus tard aux observations réelles.',
  zoneExample: 'Barcelona',
  objectives: [
    'Stocker les prévisions d une zone cible aux horizons J+1 à J+5.',
    'Collecter les observations réelles pour les mêmes dates.',
    'Calculer des indicateurs de confiance à partir de l écart entre prévision et réalité.',
  ],
  horizons: [1, 2, 3, 4, 5].map((daysAhead) => ({
    label: `J+${daysAhead}`,
    daysAhead,
  })),
  nextMilestones: [
    'Stocker les runs de prévision dans Postgres via Prisma.',
    'Collecter les observations réelles pour les mêmes dates.',
    'Ajouter un score de fiabilité par horizon et par ville.',
  ],
};

export const demoLocations: Location[] = [
  {
    id: 1,
    name: 'Barcelona',
    latitude: 41.3874,
    longitude: 2.1686,
    timezone: 'Europe/Madrid',
    notes: 'Démo publique: ville côtière avec brises thermiques et effets locaux entre mer et tissu urbain.',
  },
  {
    id: 2,
    name: 'Cadaques',
    latitude: 42.2882,
    longitude: 3.2794,
    timezone: 'Europe/Madrid',
    notes: 'Démo publique: zone plus exposée à la Tramontane, utile pour visualiser les écarts vent / rafales.',
  },
];

export const demoAutomationStatus: AutomationStatus = {
  enabled: true,
  intervalMinutes: 180,
  forecastRefreshIntervalMinutes: 60,
  observationLookbackDays: 10,
  reliabilityLookbackDays: 21,
  lastCycleStartedAt: toIso(-0.75),
  lastCycleFinishedAt: toIso(-0.5),
  interruptionWarning: {
    detectedAt: null,
    expectedRunAt: null,
    actualRunAt: null,
    delayedMinutes: 0,
    estimatedMissedCycles: 0,
    message: null,
  },
  logs: [
    {
      timestamp: toIso(-1.2),
      level: 'info',
      scope: 'forecastRefresh',
      message: 'Mini-refresh de démonstration exécuté pour Barcelona et Cadaques.',
    },
    {
      timestamp: toIso(-0.8),
      level: 'info',
      scope: 'reliabilityCalculation',
      message: 'Scores de fiabilité recalculés sur les horizons courts.',
    },
    {
      timestamp: toIso(-0.5),
      level: 'info',
      scope: 'scheduler',
      message: 'Cycle automatique terminé, aucune anomalie détectée.',
    },
  ],
  jobs: [
    {
      name: 'forecastRefresh',
      label: 'Mini-refresh des prévisions',
      status: 'succeeded',
      intervalMinutes: 60,
      lastStartedAt: toIso(-1.2),
      lastFinishedAt: toIso(-1.15),
      lastSucceededAt: toIso(-1.15),
      lastMessage: '2 villes mises à jour dans la démo.',
      nextRunAt: toIso(0.85),
    },
    {
      name: 'forecastCollection',
      label: 'Collecte des prévisions',
      status: 'succeeded',
      intervalMinutes: 180,
      lastStartedAt: toIso(-3.1),
      lastFinishedAt: toIso(-3),
      lastSucceededAt: toIso(-3),
      lastMessage: 'Runs Open-Meteo stockés pour 2 villes.',
      nextRunAt: toIso(2.9),
    },
    {
      name: 'observationCollection',
      label: 'Collecte des observations',
      status: 'succeeded',
      intervalMinutes: 180,
      lastStartedAt: toIso(-2.9),
      lastFinishedAt: toIso(-2.8),
      lastSucceededAt: toIso(-2.8),
      lastMessage: 'Observations consolidées pour les dernières 24 heures.',
      nextRunAt: toIso(3.1),
    },
    {
      name: 'reliabilityCalculation',
      label: 'Calcul de fiabilité',
      status: 'succeeded',
      intervalMinutes: 180,
      lastStartedAt: toIso(-0.7),
      lastFinishedAt: toIso(-0.5),
      lastSucceededAt: toIso(-0.5),
      lastMessage: 'Indices H+3 / H+12 / H+24 recalculés.',
      nextRunAt: toIso(3.2),
    },
  ],
};

const demoForecastsByLocationId: Record<number, ForecastRun> = {
  1: {
    id: 101,
    locationId: 1,
    provider: 'Open-Meteo',
    providerModel: 'best_match',
    issuedAt: toIso(-1.3),
    fetchedAt: toIso(-1.2),
    timezone: 'Europe/Madrid',
    location: demoLocations[0],
    days: [],
    periods: [
      { id: 1001, periodStartAt: toIso(0), horizonHours: 0, weatherCode: 2, temperatureC: 18.6, apparentTemperatureC: 18.1, precipitationMm: 0, precipitationProbabilityPct: 10, rainMm: 0, showersMm: 0, snowfallCm: 0, cloudCoverPct: 25, surfacePressureHpa: 1018, relativeHumidityPct: 61, windSpeedKmh: 17, windGustsKmh: 29, windDirectionDeg: 115, isDay: true },
      { id: 1002, periodStartAt: toIso(3), horizonHours: 3, weatherCode: 1, temperatureC: 20.4, apparentTemperatureC: 20.1, precipitationMm: 0, precipitationProbabilityPct: 5, rainMm: 0, showersMm: 0, snowfallCm: 0, cloudCoverPct: 18, surfacePressureHpa: 1017, relativeHumidityPct: 56, windSpeedKmh: 20, windGustsKmh: 34, windDirectionDeg: 124, isDay: true },
      { id: 1003, periodStartAt: toIso(12), horizonHours: 12, weatherCode: 3, temperatureC: 17.2, apparentTemperatureC: 16.9, precipitationMm: 0.6, precipitationProbabilityPct: 35, rainMm: 0.4, showersMm: 0.2, snowfallCm: 0, cloudCoverPct: 62, surfacePressureHpa: 1015, relativeHumidityPct: 69, windSpeedKmh: 23, windGustsKmh: 39, windDirectionDeg: 98, isDay: false },
      { id: 1004, periodStartAt: toIso(24), horizonHours: 24, weatherCode: 61, temperatureC: 16.4, apparentTemperatureC: 15.8, precipitationMm: 2.1, precipitationProbabilityPct: 57, rainMm: 1.9, showersMm: 0.2, snowfallCm: 0, cloudCoverPct: 81, surfacePressureHpa: 1013, relativeHumidityPct: 74, windSpeedKmh: 26, windGustsKmh: 44, windDirectionDeg: 87, isDay: true },
    ],
  },
  2: {
    id: 102,
    locationId: 2,
    provider: 'Open-Meteo',
    providerModel: 'best_match',
    issuedAt: toIso(-1.3),
    fetchedAt: toIso(-1.2),
    timezone: 'Europe/Madrid',
    location: demoLocations[1],
    days: [],
    periods: [
      { id: 2001, periodStartAt: toIso(0), horizonHours: 0, weatherCode: 1, temperatureC: 16.3, apparentTemperatureC: 15.7, precipitationMm: 0, precipitationProbabilityPct: 4, rainMm: 0, showersMm: 0, snowfallCm: 0, cloudCoverPct: 10, surfacePressureHpa: 1019, relativeHumidityPct: 58, windSpeedKmh: 31, windGustsKmh: 48, windDirectionDeg: 332, isDay: true },
      { id: 2002, periodStartAt: toIso(3), horizonHours: 3, weatherCode: 2, temperatureC: 17.1, apparentTemperatureC: 16.4, precipitationMm: 0, precipitationProbabilityPct: 8, rainMm: 0, showersMm: 0, snowfallCm: 0, cloudCoverPct: 22, surfacePressureHpa: 1018, relativeHumidityPct: 55, windSpeedKmh: 34, windGustsKmh: 52, windDirectionDeg: 338, isDay: true },
      { id: 2003, periodStartAt: toIso(12), horizonHours: 12, weatherCode: 3, temperatureC: 15.2, apparentTemperatureC: 14.3, precipitationMm: 0.2, precipitationProbabilityPct: 20, rainMm: 0.2, showersMm: 0, snowfallCm: 0, cloudCoverPct: 48, surfacePressureHpa: 1016, relativeHumidityPct: 63, windSpeedKmh: 36, windGustsKmh: 56, windDirectionDeg: 344, isDay: false },
      { id: 2004, periodStartAt: toIso(24), horizonHours: 24, weatherCode: 2, temperatureC: 16.1, apparentTemperatureC: 15.3, precipitationMm: 0.1, precipitationProbabilityPct: 14, rainMm: 0.1, showersMm: 0, snowfallCm: 0, cloudCoverPct: 30, surfacePressureHpa: 1017, relativeHumidityPct: 61, windSpeedKmh: 33, windGustsKmh: 50, windDirectionDeg: 329, isDay: true },
    ],
  },
};

const demoReliabilityByLocationId: Record<number, ReliabilityScore[]> = {
  1: [
    { id: 3001, locationId: 1, horizonHours: 3, sampleCount: 28, temperatureMaeC: 0.9, temperatureBiasC: 0.2, precipitationMaeMm: 0.5, precipitationBiasMm: 0.1, windSpeedMaeKmh: 3.8, windSpeedBiasKmh: -0.6, windGustsMaeKmh: 6.1, windGustsBiasKmh: -1.2, scorePct: 93, calculatedAt: toIso(-0.5) },
    { id: 3002, locationId: 1, horizonHours: 12, sampleCount: 28, temperatureMaeC: 1.2, temperatureBiasC: 0.4, precipitationMaeMm: 0.8, precipitationBiasMm: 0.2, windSpeedMaeKmh: 5.4, windSpeedBiasKmh: -1.1, windGustsMaeKmh: 7.8, windGustsBiasKmh: -1.9, scorePct: 88, calculatedAt: toIso(-0.5) },
    { id: 3003, locationId: 1, horizonHours: 24, sampleCount: 27, temperatureMaeC: 1.7, temperatureBiasC: 0.6, precipitationMaeMm: 1.3, precipitationBiasMm: 0.4, windSpeedMaeKmh: 6.6, windSpeedBiasKmh: -1.5, windGustsMaeKmh: 9.3, windGustsBiasKmh: -2.7, scorePct: 81, calculatedAt: toIso(-0.5) },
  ],
  2: [
    { id: 4001, locationId: 2, horizonHours: 3, sampleCount: 26, temperatureMaeC: 0.8, temperatureBiasC: -0.1, precipitationMaeMm: 0.3, precipitationBiasMm: 0, windSpeedMaeKmh: 4.2, windSpeedBiasKmh: 0.8, windGustsMaeKmh: 6.8, windGustsBiasKmh: 1.4, scorePct: 91, calculatedAt: toIso(-0.5) },
    { id: 4002, locationId: 2, horizonHours: 12, sampleCount: 26, temperatureMaeC: 1.1, temperatureBiasC: -0.2, precipitationMaeMm: 0.5, precipitationBiasMm: 0.1, windSpeedMaeKmh: 5.9, windSpeedBiasKmh: 1.3, windGustsMaeKmh: 8.2, windGustsBiasKmh: 2.2, scorePct: 86, calculatedAt: toIso(-0.5) },
    { id: 4003, locationId: 2, horizonHours: 24, sampleCount: 25, temperatureMaeC: 1.4, temperatureBiasC: -0.4, precipitationMaeMm: 0.7, precipitationBiasMm: 0.1, windSpeedMaeKmh: 6.7, windSpeedBiasKmh: 1.8, windGustsMaeKmh: 9.5, windGustsBiasKmh: 2.9, scorePct: 79, calculatedAt: toIso(-0.5) },
  ],
};

export function getDemoForecast(locationId: number | null) {
  return locationId ? demoForecastsByLocationId[locationId] ?? null : null;
}

export function getDemoReliabilityScores(locationId: number | null) {
  return locationId ? demoReliabilityByLocationId[locationId] ?? [] : [];
}