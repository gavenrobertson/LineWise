// SPDX-License-Identifier: Apache-2.0
// Journey 5: create a subnet mismatch, see VAL-002 in the problems panel, apply the quick fix.
import { expect, test } from '@playwright/test';
import { doc, issues, MOD, openApp, startFrom } from './helpers.ts';

test('a subnet mismatch is reported and fixed in one click', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect.poll(async () => (await issues(page)).filter((i) => i.ruleId === 'VAL-002').length).toBe(0);

  // Renumber one end of the R1–R2 link into another subnet.
  const d = await doc(page);
  const r1 = d.devices.find((x) => x.hostname === 'R1')!;
  const r2 = d.devices.find((x) => x.hostname === 'R2')!;
  const link = d.links.find(
    (l) => [l.endpointA.deviceId, l.endpointB.deviceId].sort().join() === [r1.id, r2.id].sort().join(),
  )!;
  const r2End = link.endpointA.deviceId === r2.id ? link.endpointA : link.endpointB;
  const iface = r2.interfaces.find((i) => i.id === r2End.interfaceId)!;

  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.getByRole('tabpanel', { name: 'Outline' }).getByRole('button', { name: /^R2\b/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await inspector
    .getByRole('button', { name: new RegExp(`^${iface.shortName.replace('/', '\\/')},`) })
    .click();
  await inspector.getByLabel('IPv4').fill('192.168.99.2/30');
  await inspector.getByLabel('IPv4').press('Enter');

  await page.getByRole('button', { name: /errors?, \d+ warnings?\. Toggle problems panel\./ }).click();
  const panel = page.getByRole('region', { name: 'Problems' });
  const problem = panel.getByRole('listitem').filter({ hasText: 'VAL-002' });
  await expect(problem).toBeVisible();
  await expect(problem).toContainText('not in the same subnet');
  await problem.getByRole('button', { name: /^Set / }).click();
  await expect(panel.getByRole('listitem').filter({ hasText: 'VAL-002' })).toHaveCount(0);
  expect((await issues(page)).filter((i) => i.ruleId === 'VAL-002')).toHaveLength(0);
});

test('FR-VAL-02, FR-VAL-03 filter problems by severity and rule; canvas badges can be hidden', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect.poll(async () => (await issues(page)).length).toBeGreaterThan(1);
  const all = await issues(page);

  // Badges on affected devices, and the count in the status bar.
  const badges = page.locator('[data-lw-badge]');
  await expect(badges.first()).toBeVisible();
  const status = page.getByRole('button', { name: /errors?, \d+ warnings?\. Toggle problems panel\./ });
  await expect(status).toBeVisible();

  await status.click();
  const panel = page.getByRole('region', { name: 'Problems' });
  const items = panel.getByRole('listitem').filter({ hasText: /VAL-\d{3}/ });
  await expect(items).toHaveCount(all.length);

  // Rule filter: only that rule's problems.
  const rule = all[0]!.ruleId;
  await panel.getByLabel('Rule filter').selectOption(rule);
  await expect(items).toHaveCount(all.filter((i) => i.ruleId === rule).length);
  await panel.getByLabel('Rule filter').selectOption('');

  // Severity filter: switching a severity off hides its problems.
  const severities = new Map<string, number>();
  for (const i of all) severities.set(i.severity, (severities.get(i.severity) ?? 0) + 1);
  const [sev, n] = [...severities.entries()][0]!;
  await panel
    .getByRole('group', { name: 'Severity filter' })
    .getByRole('button', { name: new RegExp(sev, 'i') })
    .click();
  await expect(items).toHaveCount(all.length - n);

  // Badges are toggleable; the problems stay listed.
  await page.keyboard.press('Escape');
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill('Toggle problem badges');
  await page
    .getByRole('option', { name: /^Toggle problem badges/ })
    .first()
    .click();
  await expect(badges).toHaveCount(0);
  expect((await issues(page)).length).toBe(all.length);
});
