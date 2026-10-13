// SPDX-License-Identifier: Apache-2.0
/**
 * FR-UX-14 sweep: on every screen, menu and dialog, everything that reacts to the pointer (controls,
 * tabs, options, menu and tree items, toggling labels, rows that tint on hover, canvas objects)
 * shows the hand, disabled ones show not-allowed. Text fields are left with the I-beam.
 */
import { expect, test, type Page } from '@playwright/test';
import { MOD, node, openApp, startFrom, viewportSettled } from './helpers.ts';

const bad: string[] = [];
let checked = 0;

async function sweep(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const INTERACTIVE =
      "button, a[href], select, summary, [role=button], [role=tab], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=radio], [role=checkbox], [role=switch], [role=treeitem], [role=combobox], input[type=checkbox], input[type=radio], label, .react-flow__node, .react-flow__edge, .react-flow__minimap, [class*='hover:'], [onclick]";
    const out: { desc: string; cursor: string }[] = [];
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>(INTERACTIVE)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[inert], [aria-hidden="true"]') && !el.closest('.react-flow')) continue;
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type;
      // Text entry keeps the I-beam.
      if (
        tag === 'textarea' ||
        (tag === 'input' &&
          !['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit'].includes(type))
      )
        continue;
      if (tag === 'input' && el.getAttribute('role') === 'combobox') continue;
      const disabled =
        (el as HTMLButtonElement).disabled ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('data-disabled');
      // A label only reacts if it wraps or names a control.
      if (
        tag === 'label' &&
        !el.querySelector('input[type=checkbox], input[type=radio]') &&
        !(el as HTMLLabelElement).htmlFor
      )
        continue;
      if (tag === 'label') {
        const c = (el as HTMLLabelElement).control;
        const toggles =
          c &&
          (['checkbox', 'radio'].includes(c.getAttribute('type') ?? '') ||
            ['checkbox', 'switch', 'radio'].includes(c.getAttribute('role') ?? ''));
        if (!toggles) continue;
      }
      n++;
      const want = disabled ? 'not-allowed' : 'pointer';
      if (cs.cursor !== want) {
        const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
        out.push({
          desc: `${tag}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${name}" class="${String((el as HTMLElement).className?.toString?.() ?? '').slice(0, 80)}" want ${want}`,
          cursor: cs.cursor,
        });
      }
    }
    return { out, n };
  });
  checked += found.n;
  for (const f of found.out) bad.push(`[${where}] ${f.desc} got ${f.cursor}`);
}

async function viaPalette(page: Page, label: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(label);
  await page
    .getByRole('option', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .first()
    .click();
}

test('FR-UX-14 every hoverable element on every screen shows the pointer cursor', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await sweep(page, 'welcome');
  await startFrom(page, /CCNA lab/);
  await viewportSettled(page);
  await sweep(page, 'main');
  for (const tab of ['Outline', 'Layers']) {
    await page.getByRole('tab', { name: tab }).click();
    await sweep(page, `sidebar ${tab}`);
  }
  await page.getByRole('tab', { name: 'Library' }).click();
  await node(page, 'R1').click();
  await sweep(page, 'device selected (inspector)');
  await page.locator('.react-flow__edge').first().click({ force: true });
  await sweep(page, 'link selected');
  await page.getByRole('toolbar').getByRole('button', { name: 'Toggle problems panel' }).click();
  await sweep(page, 'problems panel');
  await page.getByRole('button', { name: 'Arrange' }).click();
  await sweep(page, 'arrange menu');
  await page.keyboard.press('Escape');
  await page.keyboard.press(`${MOD}+k`);
  await expect(page.getByRole('combobox')).toBeVisible();
  await sweep(page, 'palette');
  await page.keyboard.press('Escape');
  for (const d of [
    'Preferences…',
    'Export…',
    'Import…',
    'VLAN manager…',
    'Subnets and IPAM…',
    'Subnet calculator…',
    'Keyboard shortcuts',
    'About LineWise',
    'Auto-layout…',
  ]) {
    await viaPalette(page, d);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.waitForTimeout(250);
    await sweep(page, `dialog ${d}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'New device template…' }).click();
  await page.waitForTimeout(250);
  await sweep(page, 'template editor');
  await page.keyboard.press('Escape');
  expect(checked).toBeGreaterThan(1000);
  expect([...new Set(bad)]).toEqual([]);
});
