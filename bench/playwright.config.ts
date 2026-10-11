// SPDX-License-Identifier: Apache-2.0
/**
 * Performance benchmarks (NFR-PERF-01..07) against the production browser build, in Chromium
 * (WebView2's engine). Run with `pnpm bench` (generates the fixtures first).
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const chromiumPath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: '.',
  testMatch: process.env.BENCH_SPEC ?? 'perf.spec.ts',
  timeout: 240_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  webServer: {
    // scripts/run.ts builds once and sets BENCH_BUILT for the later runs.
    command: process.env.BENCH_BUILT
      ? 'pnpm --filter @linewise/desktop preview'
      : 'pnpm --filter @linewise/desktop build && pnpm --filter @linewise/desktop preview',
    cwd: '..',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { LINEWISE_NOTICES_NO_CARGO: '1' },
  },
});
