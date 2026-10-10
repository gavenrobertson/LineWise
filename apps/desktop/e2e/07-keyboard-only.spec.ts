// SPDX-License-Identifier: Apache-2.0
// Journey 7: keyboard only — create devices, link them, rename one. No mouse.
import { expect, test } from '@playwright/test';
import { doc, MOD, openApp, tabKey } from './helpers.ts';

test('build and edit a diagram with the keyboard alone', async ({ page, browserName }) => {
  await openApp(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to LineWise' });
  // Tab to "New blank diagram".
  for (let i = 0; i < 5; i++) {
    if (
      await welcome
        .getByRole('button', { name: 'New blank diagram' })
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press(tabKey(browserName));
  }
  await expect(welcome.getByRole('button', { name: 'New blank diagram' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(welcome).toHaveCount(0);

  const placeRouter = async () => {
    await page.keyboard.press(`${MOD}+Shift+D`);
    await expect(page.getByRole('searchbox', { name: 'Search device library' })).toBeFocused();
    await page.keyboard.type('Router – 4×GE');
    await page.keyboard.press('Enter');
  };
  await placeRouter();
  await expect.poll(async () => (await doc(page)).devices.length).toBe(1);
  // Focus moved to the new device: nudge it out of the way.
  await expect(page.locator('.react-flow__node-device:focus')).toHaveCount(1);
  for (let i = 0; i < 20; i++) await page.keyboard.press('Shift+ArrowLeft');

  await placeRouter();
  await expect.poll(async () => (await doc(page)).devices.length).toBe(2);
  await expect(page.locator('.react-flow__node-device:focus')).toHaveCount(1);

  // L links the focused device; pick the peer and accept the suggested ports.
  await page.keyboard.press('l');
  const dialog = page.getByRole('dialog', { name: /Connect R2 to/ });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('R1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Connect R2 to R1' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await doc(page)).links.length).toBe(1);

  // Focus is back on R2, where the link was drawn from, so the keyboard user carries on there.
  await expect(page.locator('.react-flow__node-device:focus')).toContainText('R2');
  // Alt+Arrow moves between devices; Enter edits the hostname of the focused one.
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('.react-flow__node-device:focus')).toContainText('R1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-hostname')).toBeFocused();
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type('EDGE-1');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await doc(page)).devices.map((d) => d.hostname).sort())
    .toEqual(['EDGE-1', 'R2'].sort());
});
