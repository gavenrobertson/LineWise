// SPDX-License-Identifier: Apache-2.0
// Journey 1: blank diagram → 2 routers + a switch → links with interface choice → IPs → save, close, reopen: identical.
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, openApp, place, savedFile, serialized, startBlank } from './helpers.ts';

async function selectInOutline(page: Page, hostname: string) {
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page
    .getByRole('tabpanel', { name: 'Outline' })
    .getByRole('button', { name: new RegExp(`^${hostname}\\b`) })
    .first()
    .click();
}

async function connect(page: Page, from: string, to: string, portA: string, portB: string) {
  await selectInOutline(page, from);
  await page.locator('body').press('l');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(to);
  await dialog.getByRole('button', { name: new RegExp(`^${to}`) }).click();
  const ports = dialog.getByLabel('Port');
  await ports.nth(0).selectOption({ label: portA });
  await ports.nth(1).selectOption({ label: portB });
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function setIp(page: Page, hostname: string, iface: string, cidr: string) {
  await selectInOutline(page, hostname);
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await inspector.getByRole('button', { name: new RegExp(`^${iface.replace('/', '\\/')},`) }).click();
  const field = inspector.getByLabel('IPv4');
  await field.fill(cidr);
  await field.press('Enter');
  await inspector.getByRole('button', { name: new RegExp(`^${iface.replace('/', '\\/')},`) }).click();
}

test('build a small network, save, close and reopen it unchanged', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  await place(page, 'Router – 4×GE');
  await place(page, 'Access switch – 24×GE + 4×SFP');
  await expect
    .poll(async () => (await doc(page)).devices.map((d) => d.hostname).sort())
    .toEqual(['R1', 'R2', 'SW1']);

  // Spread them out so they are easy to see.
  await page.getByRole('button', { name: 'Arrange' }).click();
  await page.getByRole('menuitem', { name: 'Auto-layout…' }).click();
  await page.getByRole('radio', { name: /Grid/ }).click();
  await page.getByRole('button', { name: 'Apply layout' }).click();

  await connect(page, 'R1', 'R2', 'GigabitEthernet0/0 · 1G', 'GigabitEthernet0/0 · 1G');
  await connect(page, 'R1', 'SW1', 'GigabitEthernet0/1 · 1G', 'GigabitEthernet1/0/1 · 1G');
  let d = await doc(page);
  expect(d.links).toHaveLength(2);

  await setIp(page, 'R1', 'Gi0/0', '10.0.12.1/30');
  await setIp(page, 'R2', 'Gi0/0', '10.0.12.2/30');
  d = await doc(page);
  const r1 = d.devices.find((x) => x.hostname === 'R1');
  expect(r1?.interfaces.find((i) => i.shortName === 'Gi0/0')?.ipv4).toEqual([
    { address: '10.0.12.1', prefix: 30, secondary: false },
  ]);

  await page.locator('body').press(`${MOD}+s`);
  await expect(page.getByText(/^Saved /)).toBeVisible();
  const path = (await page.evaluate(() => [...(window.__linewise?.files.keys() ?? [])]))[0] as string;
  const saved = await savedFile(page, path);
  expect(saved).toBeTruthy();

  await page.locator('body').press(`${MOD}+w`);
  await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
  expect((await doc(page)).devices).toHaveLength(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(path.replace('.', '\\.')) })
    .click();
  await expect.poll(async () => (await doc(page)).devices.length).toBe(3);
  expect(await serialized(page)).toBe(saved);
});
