// SPDX-License-Identifier: Apache-2.0
/**
 * End-to-end journeys (spec section 10) against the BrowserPlatform build.
 * Chromium mirrors WebView2 (Windows) and WebKit mirrors WKWebView (macOS).
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's.
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const chromiumPath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const onlyChromium = process.env.PW_ONLY_CHROMIUM === '1' || (!!chromiumPath && !process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    ...(onlyChromium
      ? []
      : [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } }]),
  ],
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
