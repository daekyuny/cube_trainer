import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  use: {
    ...config.use,
    baseURL: 'http://127.0.0.1:4176/cube_trainer/',
  },
  webServer: {
    command:
      'npm run preview -- --mode pages --host 127.0.0.1 --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176/cube_trainer/',
    reuseExistingServer: false,
  },
});
