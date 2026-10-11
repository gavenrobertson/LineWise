// SPDX-License-Identifier: Apache-2.0
// FR-CAN-15: Find by hostname, IP, interface, VLAN or label; the results list pans to each hit.
import { expect, test } from '@playwright/test';
import { doc, MOD, openApp, startFrom } from './helpers.ts';

test('FR-CAN-15 find a device by hostname or IP, step through hits, and show a VLAN', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  const viewport = () => page.locator('.react-flow__viewport').getAttribute('style');
  await page.locator('body').press(`${MOD}+f`);
  const find = page.getByRole('search');
  const input = find.getByRole('textbox', { name: /^Find hostname/ });
  await expect(input).toBeFocused();

  // Hostname: Enter goes to the first hit, which is selected and brought into view.
  await input.fill('ACC3');
  await expect(find.getByRole('list', { name: 'Results' }).getByRole('button')).not.toHaveCount(0);
  const before = await viewport();
  await input.press('Enter');
  await expect(page.locator('.react-flow__node.selected')).toContainText('ACC3');
  await expect.poll(viewport).not.toBe(before);

  // An IP address finds the device that has it.
  type D = { devices: { hostname: string; mgmtIp: string; interfaces: { ipv4: { address: string }[] }[] }[] };
  const d = (await doc(page)) as unknown as D;
  const owner = d.devices.find((x) => x.mgmtIp && x.hostname !== 'ACC3')!;
  const ip = owner.mgmtIp;
  await input.fill(ip);
  await find.getByRole('list', { name: 'Results' }).getByRole('button').first().click();
  await expect(page.locator('.react-flow__node.selected')).toContainText(owner.hostname);

  // Several hits: Enter steps through them, the counter follows.
  await input.fill('ACC');
  await input.press('Enter');
  await expect(find.getByText(/^1\/\d+$/)).toBeVisible();
  await input.press('Enter');
  await expect(find.getByText(/^2\/\d+$/)).toBeVisible();

  // A VLAN switches to the L2 view and highlights it.
  const vlan = ((await doc(page)) as unknown as { vlans: { number: number }[] }).vlans[0]!.number;
  await input.fill(`VLAN ${vlan}`);
  const hit = find
    .getByRole('list', { name: 'Results' })
    .getByRole('button', { name: new RegExp(`VLAN`) })
    .first();
  await hit.click();
  await expect(page.getByRole('radio', { name: 'L2' })).toHaveAttribute('aria-checked', 'true');

  await input.press('Escape');
  await expect(find).toHaveCount(0);
});
