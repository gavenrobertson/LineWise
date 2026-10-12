// SPDX-License-Identifier: Apache-2.0
/** Pointer cursors (FR-UX-14), eased exits (FR-UX-15), dark by default with a toolbar switch (FR-UX-16). */
import { expect, test } from '@playwright/test';
import { MOD, node, openApp, startFrom, viewportSettled } from './helpers.ts';

test('FR-UX-16 the app opens dark; the toolbar button switches to light and back, and is remembered', async ({
  page,
}) => {
  // Even on a light OS, a new profile opens dark.
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await startFrom(page, /CCNA lab/);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = await bg();

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(bg).not.toBe(dark);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await startFrom(page, /CCNA lab/);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(bg).toBe(dark);
});

test('FR-UX-14 everything that reacts to the pointer shows the hand', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await viewportSettled(page);
  const cursor = (l: ReturnType<typeof page.locator>) => l.evaluate((el) => getComputedStyle(el).cursor);
  const toolbar = page.getByRole('toolbar');
  expect(await cursor(toolbar.getByRole('button', { name: 'Save', exact: true }))).toBe('pointer');
  expect(await cursor(page.getByRole('button', { name: 'Switch to light mode' }))).toBe('pointer');
  expect(await cursor(page.getByRole('radio', { name: 'L2' }))).toBe('pointer');
  expect(await cursor(page.getByRole('tab', { name: 'Outline' }))).toBe('pointer');
  expect(await cursor(page.getByRole('combobox', { name: 'Highlight VLAN' }))).toBe('pointer');
  expect(await cursor(node(page, 'R1'))).toBe('pointer');
  expect(await cursor(page.locator('.react-flow__edge').first())).toBe('pointer');
  // Disabled controls say so; text fields keep the I-beam.
  expect(await cursor(toolbar.getByRole('button', { name: 'Redo' }))).toBe('not-allowed');
  expect(await cursor(page.getByRole('searchbox').first())).toBe('text');
});

test('FR-UX-15 the palette and panels ease out instead of vanishing, and a shortcut right after still works', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await page.keyboard.press(`${MOD}+k`);
  const palette = page.getByRole('combobox');
  await expect(palette).toBeVisible();
  // Escape plays the exit (the sheet is still there, closing), then it goes.
  await page.keyboard.press('Escape');
  await expect(page.locator('.lw-sheet[data-state="closed"]')).toHaveCount(1);
  await expect(page.locator('.lw-sheet')).toHaveCount(0);
  // Focus left the closing sheet, so the shortcut opens it again at once.
  const toggle = (await page.getByRole('button', { name: 'Toggle inspector' }).boundingBox())!;
  await page.keyboard.press(`${MOD}+k`);
  await expect(palette).toBeVisible();
  // A click straight after closing lands too: the page takes clicks again while the sheet fades.
  // (A raw mouse click, which does not wait for the page to accept it, as a quick user's would not.)
  await page.keyboard.press('Escape');
  await page.mouse.click(toggle.x + toggle.width / 2, toggle.y + toggle.height / 2);
  await expect(page.locator('aside.lw-panel-right')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle inspector' }).click();
  await expect(page.locator('.lw-sheet')).toHaveCount(0);

  const inspector = page.locator('aside.lw-panel-right');
  await expect(inspector).toHaveAttribute('data-state', 'open');
  await page.getByRole('button', { name: 'Toggle inspector' }).click();
  await expect(inspector).toHaveAttribute('data-state', 'closed');
  await expect(inspector).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle inspector' }).click();
  await expect(inspector).toHaveAttribute('data-state', 'open');
});
