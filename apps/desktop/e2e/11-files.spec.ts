// SPDX-License-Identifier: Apache-2.0
// Files and the clipboard across diagrams: autosave on blur, invalid and newer files, paste
// into another tab, and the configurable snap grid (FR-FMT-03, FR-FMT-05, FR-FMT-07,
// FR-CAN-02, FR-CAN-08).
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, node, openApp, place, serialized, startBlank } from './helpers.ts';

/** Open `text` through File → Open, as if the user picked `name`. */
async function openText(page: Page, name: string, text: string) {
  await page.evaluate(
    ([n, t]) => {
      const w = window as unknown as {
        __linewise: {
          nextOpen: { path: string; name: string; text: string }[][];
          emitMenu: (c: string) => void;
        };
      };
      w.__linewise.nextOpen.push([{ path: n as string, name: n as string, text: t as string }]);
      w.__linewise.emitMenu('file.open');
    },
    [name, text],
  );
}

test('FR-FMT-07 autosaves a recovery copy when the window loses focus', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  const recovered = () =>
    page.evaluate(() => {
      const entries = JSON.parse(localStorage.getItem('linewise.recovery') ?? '[]') as { text: string }[];
      return entries.map((e) => (JSON.parse(e.text) as { devices: unknown[] }).devices.length);
    });
  // The default interval is 60 s, so a copy this soon can only come from the blur.
  expect(await recovered()).toEqual([]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(recovered).toEqual([1]);
});

test('FR-FMT-05 an invalid file opens the problems dialog and can load what is valid', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  await place(page, 'Router – 4×GE');
  const good = JSON.parse(await serialized(page)) as { devices: { hostname: string; role: string }[] };
  // Break the second device: an unknown role fails the schema.
  good.devices[1]!.role = 'teleporter';
  await openText(page, 'broken.lwise', JSON.stringify(good));
  const dialog = page.getByRole('dialog', { name: 'This file has problems' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/devices\.1\.role/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Open recovered copy' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await doc(page)).devices.length).toBe(1);
});

test('FR-FMT-03 a file from a newer version opens read-only', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  const newer = JSON.parse(await serialized(page)) as { schemaVersion: number };
  newer.schemaVersion = 99;
  await openText(page, 'future.lwise', JSON.stringify(newer));
  await expect(page.getByText(/newer version of LineWise/).first()).toBeVisible();
  await expect(page.getByText('Read-only', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.title()).toMatch(/read-only/);
});

test('FR-CAN-08 copy in one diagram and paste into another', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  await node(page, 'R1').click();
  await page.keyboard.press(`${MOD}+c`);
  await page
    .getByRole('navigation', { name: 'Open diagrams' })
    .getByRole('button', { name: 'New diagram' })
    .click();
  await startBlank(page);
  await expect.poll(async () => (await doc(page)).devices.length).toBe(0);
  await page.locator('.react-flow__pane').click({ position: { x: 300, y: 300 } });
  await page.keyboard.press(`${MOD}+v`);
  await expect.poll(async () => (await doc(page)).devices.map((d) => d.hostname)).toEqual(['R1']);
});

test('FR-CAN-02 the snap grid follows the grid size preference', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('lw-e2e-prefs')) {
      localStorage.clear();
      localStorage.setItem('linewise.prefs', JSON.stringify({ gridSize: 40, snapToGrid: true }));
      sessionStorage.setItem('lw-e2e-prefs', '1');
      sessionStorage.setItem('lw-e2e-init', '1');
    }
  });
  await openApp(page, { keepStorage: true });
  await startBlank(page);
  await place(page, 'Router – 4×GE');
  const before = await page.evaluate(() =>
    JSON.stringify(
      (window as unknown as { __lwTest: { doc: () => { pages: unknown[] } } }).__lwTest.doc().pages[0],
    ),
  );
  const box = (await node(page, 'R1').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + 20);
  await page.mouse.move(box.x + box.width / 2 + 133, box.y + 20 + 71, { steps: 10 });
  await page.mouse.up();
  const d = (await doc(page)) as unknown as {
    devices: { id: string }[];
    pages: { nodePositions: Record<string, { x: number; y: number }> }[];
  };
  expect(JSON.stringify(d.pages[0])).not.toBe(before);
  const p = d.pages[0]!.nodePositions[d.devices[0]!.id]!;
  // Snapping uses half the grid size (20 px) for the node's top-left corner.
  const topLeft = { x: p.x - 48, y: p.y - 28 };
  expect(topLeft.x % 20).toBe(0);
  expect(topLeft.y % 20).toBe(0);
});
