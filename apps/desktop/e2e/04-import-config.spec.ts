// SPDX-License-Identifier: Apache-2.0
// Journey 4: paste a running-config; interfaces, VLANs and IPs arrive; secrets never reach the saved file.
import { expect, test } from '@playwright/test';
import { doc, MOD, openApp, savedFile, startBlank } from './helpers.ts';

const CONFIG = `!
hostname BRANCH-RTR
!
enable secret 9 $9$SuperSecretHashValue
username admin privilege 15 secret 0 Hunter2Password
!
vlan 10
 name USERS
vlan 20
 name VOICE
!
interface GigabitEthernet0/0/0
 description WAN uplink
 ip address 203.0.113.2 255.255.255.252
!
interface GigabitEthernet0/0/1
 description LAN trunk
 switchport mode trunk
 switchport trunk allowed vlan 10,20
!
interface Vlan10
 ip address 10.10.10.1 255.255.255.0
!
snmp-server community TopSecretCommunity RO
line vty 0 4
 password 7 0822455D0A16
!
end
`;

test('import a running-config without keeping secrets', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await page.locator('body').press(`${MOD}+i`);
  const dialog = page.getByRole('dialog', { name: 'Import network data' });
  await dialog.getByLabel(/Paste CLI output/).fill(CONFIG);
  await dialog.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(dialog.getByLabel('Source type').locator('option:checked')).toHaveText(
    'Auto: Running configuration',
  );
  await dialog.getByRole('button', { name: 'Review' }).click();
  await expect(dialog.getByText('BRANCH-RTR', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply import' }).click();
  await expect(dialog).toHaveCount(0);

  const d = await doc(page);
  const rtr = d.devices.find((x) => x.hostname === 'BRANCH-RTR');
  expect(rtr).toBeTruthy();
  const byName = new Map(rtr!.interfaces.map((i) => [i.name, i]));
  expect(byName.get('GigabitEthernet0/0/0')?.ipv4[0]).toMatchObject({ address: '203.0.113.2', prefix: 30 });
  expect(byName.get('GigabitEthernet0/0/1')?.mode).toBe('trunk');
  expect(byName.get('Vlan10')?.ipv4[0]).toMatchObject({ address: '10.10.10.1', prefix: 24 });
  expect(d.vlans.map((v) => [v.number, v.name])).toEqual(
    expect.arrayContaining([
      [10, 'USERS'],
      [20, 'VOICE'],
    ]),
  );

  await page.locator('body').press(`${MOD}+s`);
  await expect(page.getByText(/^Saved /)).toBeVisible();
  const path = (await page.evaluate(() => [...(window.__linewise?.files.keys() ?? [])]))[0] as string;
  const text = (await savedFile(page, path)) ?? '';
  expect(text).toContain('BRANCH-RTR');
  for (const secret of ['SuperSecretHashValue', 'Hunter2Password', 'TopSecretCommunity', '0822455D0A16'])
    expect(text).not.toContain(secret);
});
