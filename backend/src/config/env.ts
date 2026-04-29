import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const rootEnvPath = path.resolve(currentDirectory, '../../../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config();

export const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000/api'),
    AUTOMATION_INTERVAL_MINUTES: z.coerce.number().int().positive().default(180),
    FORECAST_REFRESH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
    OBSERVATION_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),
    RELIABILITY_LOOKBACK_DAYS: z.coerce.number().int().positive().default(14),
  })
  .parse(process.env);
