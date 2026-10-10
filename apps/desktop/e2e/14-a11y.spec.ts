// SPDX-License-Identifier: Apache-2.0
// Accessibility (NFR-A11Y-04, NFR-A11Y-05): axe-core with WCAG 2.1 AA rules, including colour
// contrast (which jsdom cannot check), on every screen and dialog, in light and dark themes.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { MOD, openApp, startFrom } from './helpers.ts';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

async function axe(page: Page, what: string) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    const w = window as unknown as {
      axe: {
        run: (
          ctx: Document,
          opts: unknown,
        ) => Promise<{
          violations: { id: string; help: string; nodes: { target: string[]; failureSummary?: string }[] }[];
        }>;
      };
    };
    const r = await w.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return r.violations.map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes
        .slice(0, 6)
        .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(1, 2).join('') ?? ''}`),
    }));
  });
  const msg = violations.map((v) => `${what}: ${v.id} (${v.help})\n    ${v.nodes.join('\n    ')}`).join('\n');
  expect(violations, msg).toEqual([]);
}

async function palette(page: Page, command: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(command);
  await page
    .getByRole('option', { name: new RegExp(`^${command}`) })
    .first()
    .click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`NFR-A11Y-05 axe, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    });

    test('welcome screen', async ({ page }) => {
      await openApp(page);
      await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
      await axe(page, 'welcome');
    });

    test('main window in each view, with the problems panel open', async ({ page }) => {
      await openApp(page);
      await startFrom(page, /Three-tier campus/);
      for (const layer of ['L1', 'L2', 'L3']) {
        await page.getByRole('radio', { name: layer }).click();
        await axe(page, `main ${layer}`);
      }
      await page.getByRole('button', { name: 'Toggle problems panel', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Problems' })).toBeVisible();
      await axe(page, 'problems panel');
      for (const tab of ['Outline', 'Layers', 'Library']) {
        await page.getByRole('tab', { name: tab }).click();
        await axe(page, `sidebar ${tab}`);
      }
    });

    test('dialogs', async ({ page }) => {
      await openApp(page);
      await startFrom(page, /CCNA lab/);
      for (const [cmd, title] of [
        ['Import', 'Import network data'],
        ['Export', 'Export'],
        ['VLAN manager', 'VLANs'],
        ['Subnets', 'Subnets and IPAM'],
        ['Subnet calculator', /calculator/i],
        ['Preferences', 'Preferences'],
        ['Keyboard shortcuts', 'Keyboard shortcuts'],
        ['About', /About/],
        ['Auto-layout', /layout/i],
      ] as const) {
        await palette(page, cmd);
        const dialog = page.getByRole('dialog', { name: title });
        await expect(dialog).toBeVisible();
        await axe(page, `dialog ${cmd}`);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      await page.keyboard.press(`${MOD}+k`);
      await expect(page.getByRole('combobox')).toBeVisible();
      await axe(page, 'command palette');
    });
  });
}
