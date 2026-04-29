import { env } from '../config/env.js';
import { getLatestForecastRun, listLocations } from './forecastService.js';
import { listReliabilityScores } from './reliabilityService.js';

interface TelegramDigestResult {
  sent: boolean;
  skippedReason?: string;
  message?: string;
}

export async function sendTelegramWeatherDigest(): Promise<TelegramDigestResult> {
  if (!env.TELEGRAM_NOTIFICATIONS_ENABLED) {
    return { sent: false, skippedReason: 'Telegram notifications disabled.' };
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { sent: false, skippedReason: 'Telegram bot token or chat id missing.' };
  }

  const locations = await listLocations();
  if (locations.length === 0) {
    return { sent: false, skippedReason: 'No locations configured.' };
  }

  const summaries = await Promise.all(
    locations.map(async (location) => {
      const [forecast, reliabilityScores] = await Promise.all([
        getLatestForecastRun(location.id),
        listReliabilityScores(location.id),
      ]);

      return buildLocationDigest(location.name, forecast, reliabilityScores);
    }),
  );

  const message = [
    `CEIBO meteo ${formatTelegramTimestamp(new Date())}`,
    ...summaries,
  ].join('\n\n');

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const payload = await safeReadErrorPayload(response);
    throw new Error(`Telegram send failed with status ${response.status}${payload ? `: ${payload}` : ''}`);
  }

  return {
    sent: true,
    message,
  };
}

function buildLocationDigest(
  locationName: string,
  forecast: Awaited<ReturnType<typeof getLatestForecastRun>>,
  reliabilityScores: Awaited<ReturnType<typeof listReliabilityScores>>,
) {
  const nextPeriods = (forecast?.periods ?? []).filter((period) => period.horizonHours >= 0).slice(0, 2);
  const primaryPeriod = nextPeriods[0] ?? null;
  const h3Score = reliabilityScores.find((score) => score.horizonHours === 3) ?? reliabilityScores[0] ?? null;
  const h12Score = reliabilityScores.find((score) => score.horizonHours === 12) ?? null;
  const h24Score = reliabilityScores.find((score) => score.horizonHours === 24) ?? null;

  const reliabilityPart = h3Score
    ? `fiab H+3 ${formatPct(h3Score.scorePct)}${h12Score ? ` | H+12 ${formatPct(h12Score.scorePct)}` : ''}${h24Score ? ` | H+24 ${formatPct(h24Score.scorePct)}` : ''}`
    : 'fiab indisponible';

  const weatherPart = primaryPeriod
    ? `${formatHour(primaryPeriod.periodStartAt)} ${formatTemp(primaryPeriod.temperatureC)} ${formatRain(primaryPeriod.precipitationMm, primaryPeriod.precipitationProbabilityPct)} ${formatWind(primaryPeriod.windSpeedKmh, primaryPeriod.windGustsKmh, primaryPeriod.windDirectionDeg)}`
    : 'pas de prévision stockée';

  const driftAlert = buildDriftAlert(h3Score, h12Score, h24Score);

  return [`<b>${escapeHtml(locationName)}</b>`, weatherPart, reliabilityPart, driftAlert].filter(Boolean).join('\n');
}

function buildDriftAlert(
  h3Score: Awaited<ReturnType<typeof listReliabilityScores>>[number] | null,
  h12Score: Awaited<ReturnType<typeof listReliabilityScores>>[number] | null,
  h24Score: Awaited<ReturnType<typeof listReliabilityScores>>[number] | null,
) {
  const alerts: string[] = [];

  for (const score of [h3Score, h12Score, h24Score]) {
    if (!score) {
      continue;
    }

    if (score.scorePct < env.TELEGRAM_SCORE_ALERT_THRESHOLD_PCT) {
      alerts.push(`derive H+${score.horizonHours} (${formatPct(score.scorePct)})`);
      continue;
    }

    if ((score.temperatureBiasC ?? 0) >= 1.5 || (score.temperatureBiasC ?? 0) <= -1.5) {
      alerts.push(`biais temp H+${score.horizonHours} ${formatSigned(score.temperatureBiasC, 'C')}`);
    }

    if ((score.windSpeedBiasKmh ?? 0) >= 8 || (score.windSpeedBiasKmh ?? 0) <= -8) {
      alerts.push(`biais vent H+${score.horizonHours} ${formatSigned(score.windSpeedBiasKmh, 'km/h')}`);
    }

    if ((score.precipitationBiasMm ?? 0) >= 1 || (score.precipitationBiasMm ?? 0) <= -1) {
      alerts.push(`biais pluie H+${score.horizonHours} ${formatSigned(score.precipitationBiasMm, 'mm')}`);
    }
  }

  return alerts.length > 0 ? `Alerte: ${alerts.join(' | ')}` : 'Alerte: aucune derive notable';
}

function formatTelegramTimestamp(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatHour(timestamp: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatPct(value: number | null) {
  return value === null ? '--' : `${Math.round(value)}%`;
}

function formatTemp(value: number | null) {
  return value === null ? '--' : `${Math.round(value * 10) / 10}C`;
}

function formatRain(amount: number | null, probability: number | null) {
  if (amount === null && probability === null) {
    return 'pluie --';
  }

  const amountPart = amount === null ? '--' : `${Math.round(amount * 10) / 10}mm`;
  const probabilityPart = probability === null ? '--' : `${Math.round(probability)}%`;
  return `pluie ${amountPart}/${probabilityPart}`;
}

function formatWind(speed: number | null, gusts: number | null, directionDeg: number | null) {
  const speedPart = speed === null ? '--' : `${Math.round(speed)}km/h`;
  const gustPart = gusts === null ? '--' : `${Math.round(gusts)}km/h`;
  const directionPart = directionDeg === null ? '--' : `${Math.round(directionDeg)}deg`;
  return `vent ${speedPart} raf ${gustPart} ${directionPart}`;
}

function formatSigned(value: number | null, unit: string) {
  if (value === null) {
    return '--';
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function safeReadErrorPayload(response: Response) {
  try {
    const payload = (await response.json()) as { description?: string };
    return payload.description ?? null;
  } catch {
    return null;
  }
}