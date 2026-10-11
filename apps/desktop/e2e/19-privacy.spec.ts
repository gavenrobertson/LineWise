// SPDX-License-Identifier: Apache-2.0
// NFR-PRIV-01: a working session (templates, layout in a worker, validation, exports, preferences,
// About with its licenses) makes no request outside the app. In the desktop build the update
// check runs in Rust, and the web view's CSP blocks any other origin (config.test.ts).
import { expect, test } from '@playwright/test';
import { exportAs, exportsList, MOD, openApp, startFrom } from './helpers.ts';

test('NFR-PRIV-01 a working session makes no network request outside the app', async ({ page, baseURL }) => {
  const outside: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.context().on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url);
  });

  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  const run = async (command: string) => {
    await page.keyboard.press(`${MOD}+k`);
    await page.getByRole('combobox').fill(command);
    await page
      .getByRole('option', { name: new RegExp(`^${command}`) })
      .first()
      .click();
  };
  // Auto-layout runs in a worker.
  await run('Auto-layout');
  const layout = page.getByRole('dialog', { name: 'Auto-layout' });
  await layout.getByRole('button', { name: 'Apply layout' }).click();
  await expect(layout).toHaveCount(0);
  await run('Validate now');
  await exportAs(page, 'PDF document');
  await exportAs(page, 'HTML report');
  await exportAs(page, 'PNG image');
  await expect.poll(async () => (await exportsList(page)).length).toBe(3);
  await run('Preferences');
  await page.keyboard.press('Escape');
  await run('About LineWise');
  await expect(page.getByRole('dialog', { name: /About/ })).toBeVisible();
  await page.keyboard.press('Escape');

  expect(outside).toEqual([]);
});
