import { createApp } from './app.js';
import { initializeAutomationScheduler } from './services/automationService.js';
import { env } from './config/env.js';

const app = createApp();

initializeAutomationScheduler();

app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`);
});
