import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { z } from 'zod';
import { getProjectOverview } from './services/projectService.js';
import { getAutomationStatus } from './services/automationService.js';
import { addLocation, collectForecasts, deleteLocation, getLatestForecastRun, listLocations, searchLocations, updateLocationNotes } from './services/forecastService.js';
import { listReliabilityScores } from './services/reliabilityService.js';

function asyncHandler(handler: express.RequestHandler) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/api/project', (_request, response) => {
    response.json(getProjectOverview());
  });

  app.get('/api/automation/status', (_request, response) => {
    response.json(getAutomationStatus());
  });

  app.get('/api/locations', asyncHandler(async (_request, response) => {
    response.json(await listLocations());
  }));

  app.get('/api/locations/search', asyncHandler(async (request, response) => {
    const query = z.string().trim().min(2).parse(request.query.query);
    response.json(await searchLocations(query));
  }));

  app.post('/api/locations', asyncHandler(async (request, response) => {
    const body = z.object({
      name: z.string().trim().min(1),
      country: z.string().trim().min(1).nullable(),
      countryCode: z.string().trim().min(1).nullable(),
      admin1: z.string().trim().min(1).nullable(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      timezone: z.string().trim().min(1).nullable(),
      displayName: z.string().trim().min(1),
    }).parse(request.body ?? {});

    const location = await addLocation(body);
    response.status(201).json(location);
  }));

  app.delete('/api/locations/:locationId', asyncHandler(async (request, response) => {
    const locationId = z.coerce.number().int().positive().parse(request.params.locationId);
    await deleteLocation(locationId);
    response.status(204).send();
  }));

  app.patch('/api/locations/:locationId', asyncHandler(async (request, response) => {
    const locationId = z.coerce.number().int().positive().parse(request.params.locationId);
    const body = z.object({
      notes: z.string().trim().max(5000).nullable(),
    }).parse(request.body ?? {});

    const normalizedNotes = body.notes && body.notes.length > 0 ? body.notes : null;
    response.json(await updateLocationNotes(locationId, normalizedNotes));
  }));

  app.get('/api/forecasts/:locationId/latest', asyncHandler(async (request, response) => {
    const locationId = z.coerce.number().int().positive().parse(request.params.locationId);
    const forecastRun = await getLatestForecastRun(locationId);

    if (!forecastRun) {
      response.status(404).json({ message: 'No stored forecast found for this location' });
      return;
    }

    response.json(forecastRun);
  }));

  app.get('/api/reliability/:locationId', asyncHandler(async (request, response) => {
    const locationId = z.coerce.number().int().positive().parse(request.params.locationId);
    response.json(await listReliabilityScores(locationId));
  }));

  app.post('/api/forecasts/collect', asyncHandler(async (request, response) => {
    const body = z
      .object({
        locationId: z.number().int().positive().optional(),
      })
      .parse(request.body ?? {});

    const result = await collectForecasts(body.locationId);
    response.status(201).json(result);
  }));

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ message: 'Validation failed', issues: error.issues });
      return;
    }

    if (error instanceof Error) {
      response.status(500).json({ message: error.message });
      return;
    }

    response.status(500).json({ message: 'Internal server error' });
  });

  return app;
}
