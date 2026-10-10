// SPDX-License-Identifier: Apache-2.0
// Journey 3: paste CDP neighbor output for 3 devices, review the merge preview, apply, undo, redo.
import { expect, test } from '@playwright/test';
import { doc, MOD, openApp, startBlank } from './helpers.ts';

const CDP = `SW1#show cdp neighbors detail
-------------------------
Device ID: R1.lab.local
Entry address(es):
  IP address: 10.0.0.1
Platform: Cisco ISR4331/K9,  Capabilities: Router Switch IGMP
Interface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet0/0/1
Holdtime : 150 sec

-------------------------
Device ID: SW2
Entry address(es):
  IP address: 10.0.0.12
Platform: cisco C9300-48P,  Capabilities: Switch IGMP
Interface: TenGigabitEthernet1/1/1,  Port ID (outgoing port): TenGigabitEthernet1/1/1
Holdtime : 170 sec

-------------------------
Device ID: AP-LOBBY
Entry address(es):
  IP address: 10.0.0.40
Platform: cisco AIR-AP2802I-B-K9,  Capabilities: Trans-Bridge
Interface: GigabitEthernet1/0/10,  Port ID (outgoing port): GigabitEthernet0
Holdtime : 120 sec
`;

test('import CDP neighbors with preview, then undo and redo', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await page.locator('body').press(`${MOD}+i`);
  const dialog = page.getByRole('dialog', { name: 'Import network data' });
  await dialog.getByLabel(/Paste CLI output/).fill(CDP);
  await dialog.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(dialog.getByLabel('Source type').locator('option:checked')).toHaveText('Auto: CDP neighbors');
  await dialog.getByRole('button', { name: 'Review' }).click();

  await expect(dialog.getByText('4 new devices')).toBeVisible();
  await expect(dialog.getByText('3 new links')).toBeVisible();
  for (const h of ['SW1', 'R1', 'SW2', 'AP-LOBBY'])
    await expect(dialog.getByText(h, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply import' }).click();
  await expect(dialog).toHaveCount(0);

  let d = await doc(page);
  expect(d.devices.map((x) => x.hostname).sort()).toEqual(['AP-LOBBY', 'R1', 'SW1', 'SW2']);
  expect(d.links).toHaveLength(3);
  expect(d.devices.find((x) => x.hostname === 'AP-LOBBY')?.role).toBe('access-point');

  await page.locator('body').press(`${MOD}+z`);
  d = await doc(page);
  expect(d.devices).toHaveLength(0);
  expect(d.links).toHaveLength(0);

  await page.locator('body').press(`${MOD}+Shift+z`);
  d = await doc(page);
  expect(d.devices).toHaveLength(4);
  expect(d.links).toHaveLength(3);
});

test('FR-IMP-24, FR-IMP-21 imported devices go to a new page with an automatic layout', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await page.locator('body').press(`${MOD}+i`);
  const dialog = page.getByRole('dialog', { name: 'Import network data' });
  await dialog.getByLabel(/Paste CLI output/).fill(CDP);
  await dialog.getByRole('button', { name: 'Add pasted text' }).click();
  await dialog.getByRole('button', { name: 'Review' }).click();
  // Untick one device in the preview: it is not created (FR-IMP-21).
  await dialog.getByRole('checkbox', { name: 'Include AP-LOBBY', exact: true }).uncheck();
  await dialog.getByRole('radio', { name: 'New page' }).click();
  await dialog.getByRole('button', { name: 'Apply import' }).click();
  await expect(dialog).toHaveCount(0);

  type Doc = {
    devices: { id: string; hostname: string }[];
    pages: { name: string; nodePositions: Record<string, { x: number; y: number }> }[];
  };
  const d = (await doc(page)) as unknown as Doc;
  expect(d.devices.map((x) => x.hostname).sort()).toEqual(['R1', 'SW1', 'SW2']);
  expect(d.pages).toHaveLength(2);
  const imported = d.pages.find((p) => Object.keys(p.nodePositions).length > 0)!;
  expect(imported.name).toBe('Imported');
  // Laid out: every device placed, no two on top of each other.
  const pts = d.devices.map((x) => imported.nodePositions[x.id]!);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(60);
  await expect(
    page.getByRole('navigation', { name: 'Pages' }).getByRole('tab', { name: 'Imported' }),
  ).toHaveAttribute('aria-selected', 'true');
});
