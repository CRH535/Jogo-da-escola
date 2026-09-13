import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/build',
  outputDir: './test-results/build',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3101' },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 30000,
    env: { SERVER_HOST: '127.0.0.1', SERVER_PORT: '3101' },
  },
});
