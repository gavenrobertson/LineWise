// SPDX-License-Identifier: Apache-2.0
// M2 acceptance: a 50-device campus drawn with the keyboard and mouse only — two cores, four
// distribution switches, twelve access switches and 32 workstations, every link drawn through
// the connect dialog, then laid out and checked.
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, openApp, startBlank } from './helpers.ts';

/** Place a template with the keyboard; returns the new device's hostname. */
async function placeDevice(page: Page, template: string, nudge: [string, number]): Promise<string> {
  const before = new Set((await doc(page)).devices.map((d) => d.hostname));
  await page.keyboard.press(`${MOD}+Shift+D`);
  await expect(page.getByRole('searchbox', { name: 'Search device library' })).toBeFocused();
  await page.keyboard.type(template);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await doc(page)).devices.length).toBe(before.size + 1);
  await expect(page.locator('.react-flow__node-device:focus')).toHaveCount(1);
  // Move the new device off the drop point so devices don't stack.
  for (let i = 0; i < nudge[1]; i++) await page.keyboard.press(`Shift+${nudge[0]}`);
  return (await doc(page)).devices.map((d) => d.hostname).find((h) => !before.has(h))!;
}

/** Link the focused device to `peer` with the suggested ports. */
async function linkTo(page: Page, from: string, peer: string) {
  const links = (await doc(page)).links.length;
  await page.keyboard.press('l');
  await expect(page.getByRole('dialog', { name: new RegExp(`^Connect ${from} to`) })).toBeVisible();
  await page.keyboard.type(peer);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: `Connect ${from} to ${peer}` })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await doc(page)).links.length).toBe(links + 1);
}

test('a 50-device campus can be drawn with keyboard and mouse', async ({ page }) => {
  test.setTimeout(600_000);
  await openApp(page);
  await startBlank(page);

  const cores: string[] = [];
  for (let i = 0; i < 2; i++) {
    const h = await placeDevice(page, 'L3 switch – 24×SFP+ + 2×QSFP', ['ArrowRight', i * 8]);
    for (const c of cores) await linkTo(page, h, c);
    cores.push(h);
  }
  const dists: string[] = [];
  for (let i = 0; i < 4; i++) {
    const h = await placeDevice(page, 'L3 switch – 48×GE + 4×SFP+', ['ArrowDown', 8 + i]);
    for (const c of cores) await linkTo(page, h, c);
    dists.push(h);
  }
  const access: string[] = [];
  for (let i = 0; i < 12; i++) {
    const h = await placeDevice(page, 'Access switch – 48×GE + 4×SFP+', ['ArrowDown', 16 + (i % 6)]);
    await linkTo(page, h, dists[i % dists.length]!);
    access.push(h);
  }
  for (let i = 0; i < 32; i++) {
    const h = await placeDevice(page, 'Workstation – 1×GE', ['ArrowDown', 24 + (i % 8)]);
    await linkTo(page, h, access[i % access.length]!);
  }

  const d = await doc(page);
  expect(d.devices).toHaveLength(50);
  expect(d.links).toHaveLength(1 + 8 + 12 + 32);
  // Every link joins two distinct interfaces, and no interface carries two links.
  const ends = d.links.flatMap((l) => [l.endpointA.interfaceId, l.endpointB.interfaceId]);
  expect(new Set(ends).size).toBe(ends.length);

  // Tidy it with the mouse: hierarchical auto-layout keeps the tiers in order.
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(`${MOD}+Shift+l`);
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('radio', { name: /Hierarchical/ })
    .first()
    .click();
  await dialog.getByRole('button', { name: 'Apply layout' }).click();
  await expect(dialog).toHaveCount(0);
  type Pos = { pages: { nodePositions: Record<string, { y: number }> }[] };
  const pos = async (h: string) => {
    const x = (await doc(page)) as unknown as Awaited<ReturnType<typeof doc>> & Pos;
    return x.pages[0]!.nodePositions[x.devices.find((dv) => dv.hostname === h)!.id]!.y;
  };
  await expect.poll(async () => (await pos(cores[0]!)) < (await pos(dists[0]!))).toBe(true);
  expect(await pos(dists[0]!)).toBeLessThan(await pos(access[0]!));
});
