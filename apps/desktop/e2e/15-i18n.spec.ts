// SPDX-License-Identifier: Apache-2.0
// NFR-I18N-01, NFR-I18N-02: a language added at run time (a pseudo-locale with every string 40%
// longer and accented) translates the visible UI, and the layout holds: nothing pushes the window
// or a dialog sideways.
import { expect, test, type Page } from '@playwright/test';
import { MOD, openApp, startFrom } from './helpers.ts';

/** The pseudo-locale's accents (main.tsx __lwTest.pseudoLocale), for finding translated text. */
const pseudo = (s: string) =>
  s.replace(
    /[aeiouAEO]/g,
    (c) => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', O: 'Ó' })[c] ?? c,
  );

async function noHorizontalOverflow(page: Page, what: string) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const over = [...document.querySelectorAll<HTMLElement>('[role="dialog"], header, footer, aside, nav')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto')
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.getAttribute('role') ?? ''}] ${el.scrollWidth}>${el.clientWidth}`,
      );
    return { page: doc.scrollWidth - doc.clientWidth, tall: doc.scrollHeight - doc.clientHeight, over };
  });
  expect(r.page, `${what}: the window scrolls sideways`).toBeLessThanOrEqual(0);
  // The app fills the window; panels scroll, the page never does.
  expect(r.tall, `${what}: the window scrolls down`).toBeLessThanOrEqual(0);
  expect(r.over, what).toEqual([]);
}

test('NFR-I18N-01, NFR-I18N-02 a new language needs no code change, and 40% longer strings fit', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await page.evaluate(() =>
    (window as unknown as { __lwTest: { pseudoLocale: () => Promise<void> } }).__lwTest.pseudoLocale(),
  );
  // The toolbar, sidebar and status bar now show the pseudo-locale.
  await expect(page.getByRole('tab', { name: new RegExp(`^${pseudo('Library')}~+`) })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByText(/~{2,}/).first()).toBeVisible();
  await noHorizontalOverflow(page, 'main window');

  for (const cmd of ['Preferences', 'VLAN manager', 'Export'].map(pseudo)) {
    await page.keyboard.press(`${MOD}+k`);
    await page.getByRole('combobox').fill(cmd);
    await page
      .getByRole('option', { name: new RegExp(`^${cmd}`) })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noHorizontalOverflow(page, cmd);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
