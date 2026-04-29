import { env } from '../config/env.js';
import { collectForecasts } from './forecastService.js';
import { collectObservations } from './observationService.js';
import { calculateReliabilityScores } from './reliabilityService.js';

type JobName = 'forecastRefresh' | 'forecastCollection' | 'observationCollection' | 'reliabilityCalculation';
type JobStatus = 'idle' | 'running' | 'succeeded' | 'failed';

interface JobRuntimeState {
  name: JobName;
  label: string;
  status: JobStatus;
  intervalMinutes: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSucceededAt: Date | null;
  lastMessage: string | null;
  nextRunAt: Date | null;
}

interface AutomationWarningState {
  detectedAt: Date | null;
  expectedRunAt: Date | null;
  actualRunAt: Date | null;
  delayedMinutes: number;
  estimatedMissedCycles: number;
  message: string | null;
}

interface AutomationLogEntry {
  timestamp: Date;
  level: 'info' | 'error';
  scope: 'scheduler' | JobName;
  message: string;
}

declare global {
  var __weatherAutomationSchedulerStarted__: boolean | undefined;
}

const AUTOMATION_LOG_LIMIT = 120;

const jobState = new Map<JobName, JobRuntimeState>([
  [
    'forecastRefresh',
    {
      name: 'forecastRefresh',
      label: 'Mini-refresh des prévisions',
      status: 'idle',
      intervalMinutes: env.FORECAST_REFRESH_INTERVAL_MINUTES,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSucceededAt: null,
      lastMessage: null,
      nextRunAt: null,
    },
  ],
  [
    'forecastCollection',
    {
      name: 'forecastCollection',
      label: 'Collecte des prévisions',
      status: 'idle',
      intervalMinutes: env.AUTOMATION_INTERVAL_MINUTES,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSucceededAt: null,
      lastMessage: null,
      nextRunAt: null,
    },
  ],
  [
    'observationCollection',
    {
      name: 'observationCollection',
      label: 'Collecte des observations',
      status: 'idle',
      intervalMinutes: env.AUTOMATION_INTERVAL_MINUTES,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSucceededAt: null,
      lastMessage: null,
      nextRunAt: null,
    },
  ],
  [
    'reliabilityCalculation',
    {
      name: 'reliabilityCalculation',
      label: 'Calcul de fiabilité',
      status: 'idle',
      intervalMinutes: env.AUTOMATION_INTERVAL_MINUTES,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSucceededAt: null,
      lastMessage: null,
      nextRunAt: null,
    },
  ],
]);

let cycleInFlight = false;
let forecastSyncInFlight = false;
let lastCycleStartedAt: Date | null = null;
let lastCycleFinishedAt: Date | null = null;
const automationLogs: AutomationLogEntry[] = [];
const automationWarning: AutomationWarningState = {
  detectedAt: null,
  expectedRunAt: null,
  actualRunAt: null,
  delayedMinutes: 0,
  estimatedMissedCycles: 0,
  message: null,
};

export function initializeAutomationScheduler() {
  if (globalThis.__weatherAutomationSchedulerStarted__) {
    appendAutomationLog('scheduler', 'info', 'Scheduler already initialized; duplicate start skipped.');
    return;
  }

  globalThis.__weatherAutomationSchedulerStarted__ = true;
  appendAutomationLog(
    'scheduler',
    'info',
    `Scheduler started. Full cycle ${env.AUTOMATION_INTERVAL_MINUTES} minute(s), mini-refresh ${env.FORECAST_REFRESH_INTERVAL_MINUTES} minute(s).`,
  );

  scheduleAllNextRuns();
  void runAutomationCycle();

  setInterval(() => {
    void runAutomationCycle();
  }, env.AUTOMATION_INTERVAL_MINUTES * 60 * 1000);

  setInterval(() => {
    void runForecastRefresh();
  }, env.FORECAST_REFRESH_INTERVAL_MINUTES * 60 * 1000);
}

export function getAutomationStatus() {
  return {
    enabled: true,
    intervalMinutes: env.AUTOMATION_INTERVAL_MINUTES,
    forecastRefreshIntervalMinutes: env.FORECAST_REFRESH_INTERVAL_MINUTES,
    observationLookbackDays: env.OBSERVATION_LOOKBACK_DAYS,
    reliabilityLookbackDays: env.RELIABILITY_LOOKBACK_DAYS,
    lastCycleStartedAt: lastCycleStartedAt?.toISOString() ?? null,
    lastCycleFinishedAt: lastCycleFinishedAt?.toISOString() ?? null,
    interruptionWarning: {
      detectedAt: automationWarning.detectedAt?.toISOString() ?? null,
      expectedRunAt: automationWarning.expectedRunAt?.toISOString() ?? null,
      actualRunAt: automationWarning.actualRunAt?.toISOString() ?? null,
      delayedMinutes: automationWarning.delayedMinutes,
      estimatedMissedCycles: automationWarning.estimatedMissedCycles,
      message: automationWarning.message,
    },
    logs: automationLogs.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
    })),
    jobs: Array.from(jobState.values()).map((job) => ({
      ...job,
      lastStartedAt: job.lastStartedAt?.toISOString() ?? null,
      lastFinishedAt: job.lastFinishedAt?.toISOString() ?? null,
      lastSucceededAt: job.lastSucceededAt?.toISOString() ?? null,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
    })),
  };
}

async function runAutomationCycle() {
  if (cycleInFlight) {
    appendAutomationLog('scheduler', 'info', 'Skipped cycle start because a cycle is already running.');
    return;
  }

  cycleInFlight = true;
  lastCycleStartedAt = new Date();
  appendAutomationLog('scheduler', 'info', 'Starting automation cycle.');
  detectInterruption(lastCycleStartedAt);

  try {
    await runTrackedJob('forecastCollection', async () => {
      const result = await collectForecasts();
      return `${result.processedLocations} ville(s), ${result.collectedRuns.length} run(s) de prévision stocké(s).`;
    }, 'forecast-sync');

    await runTrackedJob('observationCollection', async () => {
      const result = await collectObservations(env.OBSERVATION_LOOKBACK_DAYS);
      const totalObservations = result.collectedObservations.reduce(
        (sum, location) => sum + location.observationsStored,
        0,
      );

      return `${result.processedLocations} ville(s), ${totalObservations} observation(s) synchronisée(s).`;
    });

    await runTrackedJob('reliabilityCalculation', async () => {
      const result = await calculateReliabilityScores(env.RELIABILITY_LOOKBACK_DAYS);
      return `${result.processedLocations} ville(s), ${result.generatedScores} score(s) recalculé(s).`;
    });
  } finally {
    cycleInFlight = false;
    lastCycleFinishedAt = new Date();
    appendAutomationLog('scheduler', 'info', 'Automation cycle finished.');
  }
}

async function runForecastRefresh() {
  await runTrackedJob('forecastRefresh', async () => {
    const result = await collectForecasts();
    return `${result.processedLocations} ville(s), ${result.collectedRuns.length} run(s) de prévision rafraîchi(s) pour l'affichage local.`;
  }, 'forecast-sync');
}

async function runTrackedJob(name: JobName, action: () => Promise<string>, lockKey?: 'forecast-sync') {
  const state = jobState.get(name);
  if (!state || state.status === 'running') {
    return;
  }

  if (lockKey === 'forecast-sync' && forecastSyncInFlight) {
    state.lastMessage = 'Passage ignoré car une autre collecte de prévisions est déjà en cours.';
    scheduleNextRun(name);
    appendAutomationLog(name, 'info', `${state.label} skipped because another forecast collection is already running.`);
    return;
  }

  if (lockKey === 'forecast-sync') {
    forecastSyncInFlight = true;
  }

  state.status = 'running';
  state.lastStartedAt = new Date();
  state.lastMessage = null;
  appendAutomationLog(name, 'info', `${state.label} started.`);

  try {
    const message = await action();
    state.status = 'succeeded';
    state.lastFinishedAt = new Date();
    state.lastSucceededAt = state.lastFinishedAt;
    state.lastMessage = message;
    appendAutomationLog(name, 'info', `${state.label} succeeded: ${message}`);
  } catch (error) {
    state.status = 'failed';
    state.lastFinishedAt = new Date();
    state.lastMessage = error instanceof Error ? error.message : 'Unknown automation error';
    appendAutomationLog(name, 'error', `${state.label} failed: ${state.lastMessage}`);
    console.error(`[automation] ${state.label}:`, error);
  } finally {
    if (lockKey === 'forecast-sync') {
      forecastSyncInFlight = false;
    }

    if (state.status !== 'running') {
      scheduleNextRun(name);
    }
  }
}

function scheduleAllNextRuns() {
  for (const state of jobState.values()) {
    scheduleNextRun(state.name);
  }
}

function scheduleNextRun(name: JobName) {
  const state = jobState.get(name);
  if (!state) {
    return;
  }

  const nextRunAt = new Date(Date.now() + state.intervalMinutes * 60 * 1000);
  state.nextRunAt = nextRunAt;

  appendAutomationLog('scheduler', 'info', `${state.label} scheduled for ${nextRunAt.toISOString()}.`);
}

function detectInterruption(actualRunAt: Date) {
  const referenceJob = jobState.get('forecastCollection');
  const expectedRunAt = referenceJob?.nextRunAt;

  if (!expectedRunAt) {
    return;
  }

  const graceMinutes = Math.max(5, Math.ceil(env.AUTOMATION_INTERVAL_MINUTES * 0.1));
  const delayedMs = actualRunAt.getTime() - expectedRunAt.getTime();

  if (delayedMs <= graceMinutes * 60 * 1000) {
    return;
  }

  const delayedMinutes = Math.round(delayedMs / (60 * 1000));
  const estimatedMissedCycles = Math.max(1, Math.floor(delayedMinutes / env.AUTOMATION_INTERVAL_MINUTES));

  automationWarning.detectedAt = actualRunAt;
  automationWarning.expectedRunAt = expectedRunAt;
  automationWarning.actualRunAt = actualRunAt;
  automationWarning.delayedMinutes = delayedMinutes;
  automationWarning.estimatedMissedCycles = estimatedMissedCycles;
  automationWarning.message = `Interruption détectée: le cycle a redémarré avec ${delayedMinutes} minute(s) de retard. ${estimatedMissedCycles} cycle(s) ont potentiellement été manqués, donc certains runs de prévision peuvent manquer.`;
  appendAutomationLog('scheduler', 'error', automationWarning.message);
}

function appendAutomationLog(scope: 'scheduler' | JobName, level: 'info' | 'error', message: string) {
  automationLogs.unshift({
    timestamp: new Date(),
    level,
    scope,
    message,
  });

  if (automationLogs.length > AUTOMATION_LOG_LIMIT) {
    automationLogs.length = AUTOMATION_LOG_LIMIT;
  }
}