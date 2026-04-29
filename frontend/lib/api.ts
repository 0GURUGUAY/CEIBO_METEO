export interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface ProjectOverview {
  title: string;
  description: string;
  zoneExample: string;
  objectives: string[];
  horizons: Array<{
    label: string;
    daysAhead: number;
  }>;
  nextMilestones: string[];
}

export interface AutomationJobStatus {
  name: 'forecastRefresh' | 'forecastCollection' | 'observationCollection' | 'reliabilityCalculation';
  label: string;
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  intervalMinutes: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSucceededAt: string | null;
  lastMessage: string | null;
  nextRunAt: string | null;
}

export interface AutomationStatus {
  enabled: boolean;
  intervalMinutes: number;
  forecastRefreshIntervalMinutes: number;
  observationLookbackDays: number;
  reliabilityLookbackDays: number;
  lastCycleStartedAt: string | null;
  lastCycleFinishedAt: string | null;
  interruptionWarning: {
    detectedAt: string | null;
    expectedRunAt: string | null;
    actualRunAt: string | null;
    delayedMinutes: number;
    estimatedMissedCycles: number;
    message: string | null;
  };
  logs: Array<{
    timestamp: string;
    level: 'info' | 'error';
    scope: 'scheduler' | 'forecastRefresh' | 'forecastCollection' | 'observationCollection' | 'reliabilityCalculation';
    message: string;
  }>;
  jobs: AutomationJobStatus[];
}

export interface ReliabilityScore {
  id: number;
  locationId: number;
  horizonHours: number;
  sampleCount: number;
  temperatureMaeC: number | null;
  temperatureBiasC: number | null;
  precipitationMaeMm: number | null;
  precipitationBiasMm: number | null;
  windSpeedMaeKmh: number | null;
  windSpeedBiasKmh: number | null;
  windGustsMaeKmh: number | null;
  windGustsBiasKmh: number | null;
  scorePct: number;
  calculatedAt: string;
}

export interface ForecastDay {
  id: number;
  targetDate: string;
  horizonDays: number;
  weatherCode: number | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  apparentTemperatureMaxC: number | null;
  apparentTemperatureMinC: number | null;
  precipitationSumMm: number | null;
  precipitationProbabilityMaxPct: number | null;
  rainSumMm: number | null;
  showersSumMm: number | null;
  snowfallSumCm: number | null;
  windSpeedMaxKmh: number | null;
  windGustsMaxKmh: number | null;
  windDirectionDominantDeg: number | null;
  sunshineDurationSeconds: number | null;
  daylightDurationSeconds: number | null;
  sunriseAt: string | null;
  sunsetAt: string | null;
  evapotranspirationMm: number | null;
}

export interface ForecastPeriod {
  id: number;
  periodStartAt: string;
  horizonHours: number;
  weatherCode: number | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  rainMm: number | null;
  showersMm: number | null;
  snowfallCm: number | null;
  cloudCoverPct: number | null;
  surfacePressureHpa: number | null;
  relativeHumidityPct: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  isDay: boolean | null;
}

export interface ForecastRun {
  id: number;
  locationId: number;
  provider: string;
  providerModel: string | null;
  issuedAt: string;
  fetchedAt: string;
  timezone: string | null;
  location: Location;
  days: ForecastDay[];
  periods: ForecastPeriod[];
}

export interface ForecastCollectionResult {
  processedLocations: number;
  collectedRuns: Array<{
    locationId: number;
    locationName: string;
    forecastRunId: number;
      daysStored: number;
    issuedAt: string;
  }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep the fallback status message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function requestWithInit<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep the fallback message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getProjectOverview() {
  return request<ProjectOverview>('/project');
}

export function getAutomationStatus() {
  return request<AutomationStatus>('/automation/status');
}

export function getLocations() {
  return request<Location[]>('/locations');
}

export function searchLocations(query: string) {
  return request<LocationSearchResult[]>(`/locations/search?query=${encodeURIComponent(query)}`);
}

export function createLocation(searchResult: LocationSearchResult) {
  return requestWithInit<Location>('/locations', {
    method: 'POST',
    body: JSON.stringify(searchResult),
  });
}

export function deleteLocation(locationId: number) {
  return requestWithInit<void>(`/locations/${locationId}`, {
    method: 'DELETE',
  });
}

export function updateLocationNotes(locationId: number, notes: string | null) {
  return requestWithInit<Location>(`/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export function getLatestForecast(locationId: number) {
  return request<ForecastRun>(`/forecasts/${locationId}/latest`);
}

export function getReliabilityScores(locationId: number) {
  return request<ReliabilityScore[]>(`/reliability/${locationId}`);
}

export function collectForecasts(locationId?: number) {
  return requestWithInit<ForecastCollectionResult>('/forecasts/collect', {
    method: 'POST',
    body: JSON.stringify(locationId ? { locationId } : {}),
  });
}
