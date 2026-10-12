// SPDX-License-Identifier: Apache-2.0
/** The UX polish pass (FR-UX-02, FR-UX-04, FR-UX-07, FR-UX-08): labels, cards, tooltips, motion. */
import { expect, test } from '@playwright/test';
import { MOD, openApp, startFrom, tabKey } from './helpers.ts';

test('FR-UX-04 link labels are pills of at least 11 px at 100% zoom', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  // CCNA lab fits at 100%.
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  const sizes = await page
    .locator('.lw-edge-label .lw-pill')
    .evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(4);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(11);
});

test('FR-UX-07 hovering or focusing a link shows its card', async ({ page, browserName }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const edge = page.locator('.react-flow__edge').first();
  const name = (await edge.getAttribute('aria-label')) ?? '';
  expect(name).toMatch(/^Link \S+ \S+ to \S+ \S+$/);
  const box = (await edge.boundingBox())!;
  // The middle of the link's box is on a straight link.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  const card = page.locator('[data-lw-linkcard]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Medium');
  await expect(card).toContainText('Addresses');
  await page.mouse.move(5, 300, { steps: 4 });
  await expect(card).toHaveCount(0);

  // Keyboard: Tab to a link.
  await edge.focus();
  await page.keyboard.press(tabKey(browserName));
  await page.keyboard.press(`Shift+${tabKey(browserName)}`);
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});

test('FR-UX-08 a toolbar tooltip opens on keyboard focus with its shortcut as key caps', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  // Tab from Open… to Save, as a keyboard user would.
  await page.getByRole('toolbar').getByRole('button', { name: 'Open…' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  // A tooltip that is fading out keeps its element for a moment; count only the open one.
  const tip = page.locator('[data-lw-tooltip]:not([data-state="closed"])');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Save');
  const caps = await tip.locator('kbd').allTextContents();
  expect(caps).toEqual([process.platform === 'darwin' ? '⌘' : 'Ctrl', 'S']);
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
});

test('FR-UX-02 with reduced motion nothing animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  await page.keyboard.press(`${MOD}+k`);
  await expect(page.getByRole('combobox')).toBeVisible();
  const slow = await page.evaluate(() => {
    const out: string[] = [];
    const ms = (v: string) =>
      Math.max(...v.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 1 : 1000)));
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (ms(cs.transitionDuration) > 1 || (cs.animationName !== 'none' && ms(cs.animationDuration) > 1))
        out.push(`${el.tagName}.${el.className}`);
    }
    return out;
  });
  expect(slow).toEqual([]);
});
