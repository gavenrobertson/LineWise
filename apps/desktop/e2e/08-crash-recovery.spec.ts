// SPDX-License-Identifier: Apache-2.0
// Journey 8: simulated crash — work is autosaved to the recovery store, the app is relaunched, the work is restored.
import { expect, test } from '@playwright/test';
import { doc, openApp, place, startBlank } from './helpers.ts';

test('restore work after a crash', async ({ page }) => {
  // Autosave every second for the test.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('lw-e2e-prefs')) {
      localStorage.clear();
      localStorage.setItem('linewise.prefs', JSON.stringify({ autosaveSeconds: 1 }));
      sessionStorage.setItem('lw-e2e-prefs', '1');
      sessionStorage.setItem('lw-e2e-init', '1');
    }
  });
  await openApp(page, { keepStorage: true });
  await startBlank(page);
  await place(page, 'Firewall – 8×GE');
  await place(page, 'Server – 2×GE');
  await expect.poll(async () => (await doc(page)).devices.length).toBe(2);
  await expect(page.getByText(/recovery copy/)).toBeVisible({ timeout: 5_000 });
  // Wait until an autosave has captured both devices (the first autosave may only hold one).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const entries = JSON.parse(localStorage.getItem('linewise.recovery') ?? '[]') as { text: string }[];
          return Math.max(
            0,
            ...entries.map((e) => (JSON.parse(e.text) as { devices: unknown[] }).devices.length),
          );
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(2);

  // "Crash": the page goes away without saving.
  await page.reload();
  const welcome = page.getByRole('dialog', { name: 'Welcome to LineWise' });
  await expect(welcome.getByText('Recovered work')).toBeVisible();
  await welcome
    .getByRole('button', { name: /Untitled/ })
    .first()
    .click();
  await expect(welcome).toHaveCount(0);
  await expect
    .poll(async () => (await doc(page)).devices.map((d) => d.role).sort())
    .toEqual(['firewall', 'server']);
  // Restored work is unsaved. With 1 s autosave the status may already read "Unsaved · recovery copy …".
  await expect(page.getByRole('status').filter({ hasText: /^Unsaved/ })).toBeVisible();
});
