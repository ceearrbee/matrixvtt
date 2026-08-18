import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = '/matrixvtt/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,

  // `vite preview` serves the production build. The e2e specs assume
  // `dist/` exists, so CI must run `npm run build` first.
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `https://localhost:${PORT}${BASE}app.html`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  use: {
    baseURL: `https://localhost:${PORT}${BASE}`,
    // vite preview uses @vitejs/plugin-basic-ssl - self-signed cert.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox + WebKit + mobile run in the matrix CI job. Locally,
    // `npx playwright test --project=chromium` is the fast path.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
    { name: 'mobile',  use: { ...devices['iPhone SE']       } },
  ],
});
