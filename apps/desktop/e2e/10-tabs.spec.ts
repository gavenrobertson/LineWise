// SPDX-License-Identifier: Apache-2.0
// FR-APP-02 multi-document tabs with per-tab history (FR-CAN-07) and paste across diagrams (FR-CAN-08).
import { expect, test } from '@playwright/test';
import { doc, MOD, node, openApp, place, startFrom } from './helpers.ts';

test('FR-APP-02 open two diagrams in tabs, edit each, switch, undo per tab, close', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const tabs = page.getByRole('navigation', { name: 'Open diagrams' });
  await expect(tabs.getByRole('button', { name: /^(unsaved changes )?CCNA lab$/ })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Edit the first diagram and copy a router.
  await place(page, 'Firewall – 8×GE');
  await expect(tabs.getByRole('img', { name: 'unsaved changes' })).toHaveCount(1);
  await node(page, 'R1').click();
  await page.keyboard.press(`${MOD}+c`);

  // A second diagram opens in its own tab.
  await tabs.getByRole('button', { name: 'New diagram' }).click();
  await startFrom(page, /Small office/);
  await expect(tabs.getByRole('listitem')).toHaveCount(2);
  const office = (await doc(page)).devices.length;
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press(`${MOD}+v`);
  await expect.poll(async () => (await doc(page)).devices.length).toBe(office + 1);

  // Switch back: the first diagram and its history are intact.
  await tabs.getByRole('button', { name: /^(unsaved changes )?CCNA lab$/ }).click();
  await expect(node(page, 'R1')).toBeVisible();
  expect((await doc(page)).devices.some((d) => d.role === 'firewall')).toBe(true);
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await doc(page)).devices.some((d) => d.role === 'firewall')).toBe(false);

  // Ctrl+Tab cycles; the office diagram still has its pasted router.
  await page.keyboard.press('Control+Tab');
  await expect.poll(async () => (await doc(page)).devices.length).toBe(office + 1);

  // Close it, discarding changes: one tab is left.
  await page.evaluate(() => window.__linewise?.nextConfirm.push(true));
  await tabs.getByRole('button', { name: /^Close Small office/ }).click();
  await expect(tabs.getByRole('listitem')).toHaveCount(1);
  await expect(node(page, 'R1')).toBeVisible();
});
