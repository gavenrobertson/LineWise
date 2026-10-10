// SPDX-License-Identifier: Apache-2.0
// Journey 2: three-tier campus template, L1 → L2 → L3 views, highlight VLAN 10.
import { expect, test } from '@playwright/test';
import { node, openApp, serialized, startFrom } from './helpers.ts';

test('switch network views and highlight a VLAN', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  await expect(node(page, 'CORE1')).toBeVisible();
  // FR-NET-31: views change rendering only, never the document.
  const before = await serialized(page);
  const labels = page.locator('.lw-edge-label');

  // L1: interface names on every link end.
  await page.getByRole('radio', { name: 'L1' }).click();
  await expect(labels.filter({ hasText: /^Te1\/0\/1$/ }).first()).toBeVisible();
  await expect(page.getByText('Physical (L1)')).toBeVisible();

  // L2: trunks and their allowed VLANs.
  await page.getByRole('radio', { name: 'L2' }).click();
  await expect(labels.filter({ hasText: /trunk/ }).first()).toBeVisible();
  await expect(page.getByText('Data link (L2)')).toBeVisible();

  // L3: access switches with no routed addresses drop out; routed devices remain.
  await page.getByRole('radio', { name: 'L3' }).click();
  await expect(page.getByText('Network (L3)')).toBeVisible();
  await expect(node(page, 'CORE1')).toBeVisible();
  await expect(node(page, 'ACC1')).toHaveCount(0);

  // VLAN 10 highlight dims everything outside the broadcast domain.
  await page.getByRole('radio', { name: 'L2' }).click();
  await page.getByTitle('Highlight VLAN').selectOption('10');
  await expect(page.getByText('Highlighting VLAN 10')).toBeVisible();
  await expect(node(page, 'ACC1').locator('.lw-dim')).toHaveCount(0);
  await expect(
    page.locator('.react-flow__node-device .lw-dim, .react-flow__node-device.lw-dim').first(),
  ).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Highlighting VLAN 10')).toHaveCount(0);
  expect(await serialized(page)).toBe(before);
});
