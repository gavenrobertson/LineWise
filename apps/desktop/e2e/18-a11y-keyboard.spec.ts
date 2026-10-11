// SPDX-License-Identifier: Apache-2.0
// Keyboard and screen-reader access beyond journey 7: Tab reaches every panel (NFR-A11Y-01), the
// topology outline is a navigable tree (NFR-A11Y-02), and problems are marked by a glyph as well
// as a color (NFR-A11Y-03).
import { expect, test, type Page } from '@playwright/test';
import { doc, issues, openApp, startFrom, tabKey } from './helpers.ts';

/** The landmark (or the canvas) that holds the focused element. */
const focusedRegion = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.closest('.react-flow')) return 'canvas';
    const l = el.closest('[role="toolbar"], aside, main, footer, [role="contentinfo"], nav');
    return l ? (l.getAttribute('aria-label') ?? l.tagName.toLowerCase()) : 'other';
  });

test('NFR-A11Y-01 Tab moves through toolbar, sidebar, canvas, inspector and status bar', async ({
  page,
  browserName,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const wanted = ['Main toolbar', 'Sidebar', 'canvas', 'Inspector', 'Status'];
  const seen = new Set<string>();
  for (let i = 0; i < 400 && !wanted.every((w) => seen.has(w)); i++) {
    await page.keyboard.press(tabKey(browserName));
    seen.add(await focusedRegion(page));
  }
  for (const region of wanted) expect([...seen], region).toContain(region);
});

test('NFR-A11Y-02 the outline is a tree of zones, devices, interfaces and link peers', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await page.getByRole('tab', { name: 'Outline' }).click();
  const tree = page.getByRole('tree', { name: 'Topology' });
  await expect(tree).toBeVisible();

  // Focus the first device and walk in with the arrow keys.
  const r1 = tree.getByRole('treeitem', { name: /^R1\b/ });
  await r1.click();
  await expect(r1).toBeFocused();
  await expect(r1).toHaveAttribute('aria-level', '2');
  await expect(r1).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(r1).toHaveAttribute('aria-expanded', 'true');

  // Find an interface of R1 that has a link, then its peer.
  type D = {
    devices: { id: string; hostname: string; interfaces: { id: string; shortName: string }[] }[];
    links: {
      endpointA: { deviceId: string; interfaceId: string };
      endpointB: { deviceId: string; interfaceId: string };
    }[];
  };
  const d = (await doc(page)) as unknown as D;
  const r1d = d.devices.find((x) => x.hostname === 'R1')!;
  const link = d.links.find((l) => l.endpointA.deviceId === r1d.id || l.endpointB.deviceId === r1d.id)!;
  const [mine, theirs] =
    link.endpointA.deviceId === r1d.id ? [link.endpointA, link.endpointB] : [link.endpointB, link.endpointA];
  const port = r1d.interfaces.find((i) => i.id === mine.interfaceId)!.shortName;
  const peer = d.devices.find((x) => x.id === theirs.deviceId)!;
  const peerPort = peer.interfaces.find((i) => i.id === theirs.interfaceId)!.shortName;

  await page.keyboard.press('ArrowRight'); // first interface
  const iface = tree.getByRole('treeitem', { name: new RegExp(`^${port.replace(/[/.]/g, '\\$&')}( |$)`) });
  for (let i = 0; i < 60 && !(await iface.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('ArrowDown');
  await expect(iface).toBeFocused();
  await expect(iface).toHaveAttribute('aria-level', '3');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const peerItem = tree.getByRole('treeitem', { name: `Connected to ${peer.hostname} ${peerPort}` });
  await expect(peerItem).toBeFocused();
  await expect(peerItem).toHaveAttribute('aria-level', '4');

  // Enter selects the link, which the inspector then edits.
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Add bend point' }),
  ).toBeVisible();
  await expect(peerItem).toHaveAttribute('aria-selected', 'true');

  // Left climbs back up: peer → interface → device.
  await page.keyboard.press('ArrowLeft');
  await expect(iface).toBeFocused();
  await page.keyboard.press('ArrowLeft'); // collapse
  await page.keyboard.press('ArrowLeft');
  await expect(r1).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tree.getByRole('treeitem').first()).toBeFocused();
});

test('NFR-A11Y-03 problem badges carry a severity glyph, on devices and on links', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect.poll(async () => (await issues(page)).length).toBeGreaterThan(0);
  const glyph = { error: '✕', warning: '▲', info: 'i' } as Record<string, string>;
  const badges = await page
    .locator('.react-flow__node [data-lw-badge]')
    .evaluateAll((els) =>
      els.map((e) => ({ sev: e.getAttribute('data-lw-badge')!, text: e.textContent ?? '' })),
    );
  expect(badges.length).toBeGreaterThan(0);
  for (const b of badges) expect(b.text.startsWith(glyph[b.sev]!), JSON.stringify(b)).toBe(true);

  // Put one end of a link in another subnet (VAL-002, an error on the link): the link gets a
  // ✕ badge as well as its red stroke.
  await expect(page.locator('.react-flow__edge [data-lw-badge="error"]')).toHaveCount(0);
  type D = {
    devices: { id: string; hostname: string; interfaces: { id: string; shortName: string }[] }[];
    links: {
      endpointA: { deviceId: string; interfaceId: string };
      endpointB: { deviceId: string; interfaceId: string };
    }[];
  };
  const d = (await doc(page)) as unknown as D;
  const r2 = d.devices.find((x) => x.hostname === 'R2')!;
  const link = d.links.find((l) => l.endpointA.deviceId === r2.id || l.endpointB.deviceId === r2.id)!;
  const end = link.endpointA.deviceId === r2.id ? link.endpointA : link.endpointB;
  const iface = r2.interfaces.find((i) => i.id === end.interfaceId)!;
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.getByRole('tabpanel', { name: 'Outline' }).getByRole('treeitem', { name: /^R2\b/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await inspector
    .getByRole('button', { name: new RegExp(`^${iface.shortName.replace('/', '\\/')},`) })
    .click();
  await inspector.getByLabel('IPv4').fill('192.168.99.2/30');
  await inspector.getByLabel('IPv4').press('Enter');
  const linkBadge = page.locator('.react-flow__edge [data-lw-badge="error"]');
  await expect(linkBadge).toHaveCount(1);
  await expect(linkBadge).toHaveText(glyph.error!);
});

test('FR-KEY-02 pan, select and size a zone, and bend a link without a mouse', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  type Z = {
    zones: { id: string; name: string }[];
    pages: { zoneBoxes: Record<string, { x: number; w: number }> }[];
  };
  const state = async () =>
    (await doc(page)) as unknown as Z & { links: { style: { waypoints?: { x: number; y: number }[] } }[] };

  // Nothing selected: arrows pan the view.
  await page.keyboard.press('Escape');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const viewport = () => page.locator('.react-flow__viewport').getAttribute('style');
  const before = await viewport();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(viewport).not.toBe(before);

  // A zone: focus it, Enter selects it, arrows move it and the inspector sizes it.
  const core = (await state()).zones.find((z) => z.name === 'Core')!;
  await page.locator(`.react-flow__node-zone[data-id="${core.id}"]`).focus();
  await page.keyboard.press('Enter');
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByLabel('Width')).toBeVisible();
  const x0 = (await state()).pages[0]!.zoneBoxes[core.id]!.x;
  await page.locator(`.react-flow__node-zone[data-id="${core.id}"]`).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state()).pages[0]!.zoneBoxes[core.id]!.x).toBe(x0 + 1);
  await inspector.getByLabel('Width').fill('700');
  await inspector.getByLabel('Width').press('Enter');
  await expect.poll(async () => (await state()).pages[0]!.zoneBoxes[core.id]!.w).toBe(700);

  // A link, reached through the outline: add a bend, move it, remove it.
  await page.getByRole('tab', { name: 'Outline' }).click();
  const tree = page.getByRole('tree', { name: 'Topology' });
  const dev = tree.getByRole('treeitem', { name: /^CORE1\b/ });
  await dev.focus();
  await page.keyboard.press('ArrowRight');
  const linked = tree.locator('[role="treeitem"][aria-level="3"][aria-expanded]').first();
  await linked.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(tree.getByRole('treeitem', { name: /^Connected to / }).first()).toBeFocused();
  await page.keyboard.press('Enter');
  const add = inspector.getByRole('button', { name: 'Add bend point' });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await state()).links.filter((l) => l.style.waypoints?.length).length)
    .toBe(1);
  await inspector.getByLabel('Bend 1 X').fill('123');
  await inspector.getByLabel('Bend 1 X').press('Enter');
  await expect
    .poll(async () => (await state()).links.find((l) => l.style.waypoints?.length)?.style.waypoints?.[0]?.x)
    .toBe(123);
  await inspector.getByRole('button', { name: 'Remove bend 1' }).focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await state()).links.filter((l) => l.style.waypoints?.length).length)
    .toBe(0);
});
