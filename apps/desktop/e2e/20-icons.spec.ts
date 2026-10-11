// SPDX-License-Identifier: Apache-2.0
// Device icons: status marks (FR-ICO-04), icon packs referenced or embedded (FR-ICO-05,
// FR-ICO-06), and a diagram whose pack is missing (FR-ICO-05).
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, node, openApp, queueSavePath, savedFile, serialized, startFrom } from './helpers.ts';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

async function selectR1(page: Page) {
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.getByRole('tabpanel', { name: 'Outline' }).getByRole('treeitem', { name: /^R1\b/ }).click();
  await expect(inspector(page).locator('#inspector-hostname')).toHaveValue('R1');
}

async function palette(page: Page, command: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(command);
  await page
    .getByRole('option', { name: new RegExp(`^${command}`) })
    .first()
    .click();
}

const PACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

async function importPack(page: Page) {
  await page.evaluate((svg) => {
    const w = window as unknown as { __linewise: { nextBinary: { name: string; bytes: Uint8Array }[][] } };
    const bytes = (s: string) => new TextEncoder().encode(s);
    w.__linewise.nextBinary.push([
      { name: 'manifest.json', bytes: bytes(JSON.stringify({ id: 'ops', name: 'Ops icons' })) },
      { name: 'edge.svg', bytes: bytes(svg) },
    ]);
  }, PACK_SVG);
  await palette(page, 'Preferences');
  const prefs = page.getByRole('dialog', { name: 'Preferences' });
  await prefs.getByRole('button', { name: 'Import…' }).click();
  await expect(prefs.getByText('Ops icons')).toBeVisible();
  return prefs;
}

test('FR-ICO-04 status marks on the icon: problems, note, locked and a color tag', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await selectR1(page);
  const r1 = node(page, 'R1');
  await expect(r1.locator('[data-lw-mark]')).toHaveCount(0);
  await inspector(page).getByLabel('Notes').fill('Spare PSU on order');
  await inspector(page).getByLabel('Notes').blur();
  await inspector(page).getByLabel('Locked').check();
  await inspector(page).getByLabel('Color tag').fill('#d55e00');
  await expect(r1.locator('[data-lw-mark="note"]')).toBeVisible();
  await expect(r1.locator('[data-lw-mark="locked"]')).toBeVisible();
  await expect(r1.locator('[data-lw-mark="color"]')).toHaveCSS('background-color', 'rgb(213, 94, 0)');
  // The accessible name says it too.
  await expect(r1.locator('[aria-label]').first()).toHaveAttribute('aria-label', /locked/);
});

test('FR-ICO-05, FR-ICO-06 a pack icon is referenced, then embedded when the file is saved', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const prefs = await importPack(page);
  // References only: the file stays small and needs the pack.
  await prefs.getByLabel(/^Embed pack icons/).uncheck();
  await page.keyboard.press('Escape');

  await selectR1(page);
  await inspector(page).getByRole('button', { name: 'Choose icon' }).click();
  await page.getByRole('listbox', { name: 'Ops icons' }).getByRole('option', { name: 'edge' }).click();
  await expect
    .poll(
      async () =>
        (await doc(page)).devices.find((d) => d.hostname === 'R1') as unknown as { iconOverride?: string },
    )
    .toMatchObject({ iconOverride: 'pack:ops/edge' });
  await expect(node(page, 'R1').locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);

  // Saving with embedding on writes the image into the file.
  await palette(page, 'Preferences');
  await page
    .getByRole('dialog', { name: 'Preferences' })
    .getByLabel(/^Embed pack icons/)
    .check();
  await page.keyboard.press('Escape');
  await queueSavePath(page, '/d/icons.lwise');
  await page.keyboard.press(`${MOD}+s`);
  await expect.poll(() => savedFile(page, '/d/icons.lwise')).toBeTruthy();
  const file = JSON.parse((await savedFile(page, '/d/icons.lwise'))!) as {
    devices: { hostname: string; iconOverride?: string }[];
    assets: Record<string, { mime: string }>;
  };
  const icon = file.devices.find((d) => d.hostname === 'R1')!.iconOverride!;
  expect(icon).toMatch(/^asset:/);
  expect(file.assets[icon.slice(6)]?.mime).toBe('image/svg+xml');
  expect(JSON.stringify(file)).not.toContain('pack:ops');
});

test('FR-ICO-05 a diagram whose pack is not installed shows built-in icons and says so', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const text = await serialized(page);
  const d = JSON.parse(text) as { id: string; devices: { hostname: string; iconOverride?: string }[] };
  // Another diagram, not the one already open.
  d.id = d.id.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  d.devices.find((x) => x.hostname === 'R1')!.iconOverride = 'pack:not-installed/edge';
  await page.evaluate((t) => {
    const w = window as unknown as {
      __linewise: {
        nextOpen: { path: string; name: string; text: string }[][];
        emitMenu: (c: string) => void;
      };
    };
    w.__linewise.nextOpen.push([{ path: '/d/other.lwise', name: 'other.lwise', text: t }]);
    w.__linewise.emitMenu('file.open');
  }, JSON.stringify(d));
  await expect(page.getByText(/icons from icon packs that are not installed/)).toBeVisible();
  await expect(node(page, 'R1').locator('img')).toHaveCount(0);
  await expect(node(page, 'R1').locator('svg').first()).toBeVisible();
});
