// SPDX-License-Identifier: Apache-2.0
// The application shell: layout, themes, welcome screen, starters, preferences, command palette,
// shortcut reference and in-app help (FR-APP-03..08, FR-KEY-01, DOC-05).
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, node, openApp, serialized, startBlank, startFrom } from './helpers.ts';

async function palette(page: Page, query: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(query);
  return page.getByRole('listbox', { name: 'Results' });
}

const canvasBackground = (page: Page) =>
  page.locator('.react-flow').evaluate((el) => getComputedStyle(el).backgroundColor);

test('FR-APP-03 library left, canvas center, inspector right, problems below, toolbar on top', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const toggleProblems = page.getByRole('contentinfo').getByRole('button', { name: /problems panel/i });
  await toggleProblems.click();
  const box = async (name: string, role: 'toolbar' | 'complementary' | 'main' | 'region') =>
    (await page.getByRole(role, { name, exact: true }).boundingBox())!;
  const toolbar = await box('Main toolbar', 'toolbar');
  const side = await box('Sidebar', 'complementary');
  const main = await box('Diagram', 'main');
  const inspector = await box('Inspector', 'complementary');
  const problems = await box('Problems', 'region');
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(side.y + 1);
  expect(side.x + side.width).toBeLessThanOrEqual(main.x + 1);
  expect(main.x + main.width).toBeLessThanOrEqual(inspector.x + 1);
  expect(problems.y).toBeGreaterThan(main.y + main.height / 2);
  expect(problems.x).toBeGreaterThanOrEqual(main.x - 1);
  // The library has a search box; the problems panel collapses.
  await expect(page.getByRole('searchbox', { name: 'Search device library' })).toBeVisible();
  await toggleProblems.click();
  await expect(page.getByRole('region', { name: 'Problems', exact: true })).toHaveCount(0);
});

test('FR-APP-04 light, dark and follow-system themes; the canvas follows', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await startFrom(page, /Small office/);
  const light = await canvasBackground(page);

  const setTheme = async (name: string) => {
    await (await palette(page, 'Preferences')).getByRole('option').first().click();
    const dialog = page.getByRole('dialog', { name: 'Preferences' });
    await dialog.getByRole('radio', { name }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  };
  await setTheme('Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await canvasBackground(page);
  expect(dark).not.toBe(light);

  // "System" follows the OS setting, live.
  await setTheme('System');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  expect(await canvasBackground(page)).toBe(light);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => canvasBackground(page)).toBe(dark);
});

test('FR-APP-05 welcome: blank, template, open file and the last 10 recent files', async ({ page }) => {
  await openApp(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to LineWise' });
  for (const name of ['New blank diagram', 'Open file…'])
    await expect(welcome.getByRole('button', { name })).toBeVisible();
  await expect(welcome.getByText('Start from a template')).toBeVisible();
  await expect(welcome.getByText('Files you open or save appear here.')).toBeVisible();
  await startBlank(page);

  // Open twelve files; the welcome screen lists the ten most recent.
  const text = await serialized(page);
  await page.evaluate((t) => {
    const w = window as unknown as {
      __linewise: { nextOpen: { path: string; name: string; text: string }[][] };
    };
    for (let i = 1; i <= 12; i++)
      w.__linewise.nextOpen.push([{ path: `/d/net-${i}.lwise`, name: `net-${i}.lwise`, text: t }]);
  }, text);
  for (let i = 1; i <= 12; i++) {
    await page.evaluate(() =>
      (window as unknown as { __linewise: { emitMenu: (c: string) => void } }).__linewise.emitMenu(
        'file.open',
      ),
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Open diagrams' })
        .getByRole('button', { name: `net-${i}`, exact: true }),
    ).toBeVisible();
  }
  await page.keyboard.press(`${MOD}+n`);
  await expect(welcome).toBeVisible();
  const recent = welcome.getByRole('list', { name: 'Recent' }).getByRole('listitem');
  await expect(recent).toHaveCount(10);
  await expect(recent.first()).toContainText('net-12');
  await expect(recent.last()).toContainText('net-3');
});

test('FR-APP-06 every starter template opens with devices and links', async ({ page }) => {
  await openApp(page);
  const starters = [
    'Small office',
    'Three-tier campus',
    'Collapsed-core campus',
    'Spine-leaf data center',
    'Hub-and-spoke WAN',
    'DMVPN',
    'CCNA lab',
  ];
  for (const [i, name] of starters.entries()) {
    if (i > 0) {
      await page.keyboard.press(`${MOD}+n`);
      await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
    }
    await startFrom(page, new RegExp(`^${name}`));
    const d = await doc(page);
    expect(d.devices.length, name).toBeGreaterThan(1);
    await expect(page.locator('.react-flow__node-device').first()).toBeVisible();
  }
  // The CCNA lab is 3 routers and 2 switches.
  const ccna = (await doc(page)) as unknown as { devices: { role: string }[] };
  expect(ccna.devices.filter((x) => x.role === 'router')).toHaveLength(3);
  expect(ccna.devices.filter((x) => /switch/.test(x.role))).toHaveLength(2);
});

test('FR-APP-07 preferences hold every listed setting and survive a restart', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await (await palette(page, 'Preferences')).getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'Preferences' });
  for (const label of [
    'Grid size',
    'Default link style',
    'Snap to grid',
    'Recovery copy every',
    'Send anonymous crash reports',
    'Language',
    'Default PNG scale',
  ])
    await expect(dialog.getByLabel(label, { exact: false }).first(), label).toBeVisible();
  await expect(dialog.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
  // Telemetry is off by default (NFR-PRIV-02).
  await expect(dialog.getByLabel('Send anonymous crash reports')).not.toBeChecked();
  await dialog.getByLabel('Snap to grid').setChecked(false);
  await dialog.getByLabel('Show minimap').setChecked(false);
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
  await startBlank(page);
  await (await palette(page, 'Preferences')).getByRole('option').first().click();
  await expect(dialog.getByLabel('Snap to grid')).not.toBeChecked();
  await expect(dialog.getByLabel('Show minimap')).not.toBeChecked();
  // The update-check switch is in the desktop build only (the browser build makes no update calls);
  // its default and storage are covered in components.test.tsx (Preferences).
});

test('FR-APP-08 the command palette runs menu actions and finds devices by hostname or IP', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  // A menu action.
  await (await palette(page, 'Validate now')).getByRole('option', { name: /^Validate now/ }).click();
  await expect(page.getByRole('region', { name: 'Problems', exact: true })).toBeVisible();

  // A device by hostname: it is selected and shown in the inspector.
  await (await palette(page, 'SW2')).getByRole('option', { name: /^SW2/ }).first().click();
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).locator('#inspector-hostname'),
  ).toHaveValue('SW2');
  await expect(node(page, 'SW2')).toHaveClass(/selected/);

  // A device by one of its IP addresses.
  type D = { devices: { hostname: string; interfaces: { ipv4: { address: string }[] }[] }[] };
  const d = (await doc(page)) as unknown as D;
  const owner = d.devices.find((x) => x.interfaces.some((i) => i.ipv4.length))!;
  const ip = owner.interfaces.find((i) => i.ipv4.length)!.ipv4[0]!.address.split('/')[0]!;
  await (await palette(page, ip)).getByRole('option').first().click();
  await expect(page.locator('#inspector-hostname')).toHaveValue(owner.hostname);
});

test('FR-KEY-01, DOC-05 shortcut sheet under Help, toolbar tooltips, empty-state hint, documentation link', async ({
  page,
}) => {
  await openApp(page);
  await startBlank(page);
  // Empty-state hint on a blank page.
  await expect(page.getByText('Start your network')).toBeVisible();
  await expect(page.getByText(/Drag a device from the library/)).toBeVisible();

  // Every toolbar button has a name and a tooltip. Focus opens a tooltip too, so start unfocused.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const buttons = page.getByRole('toolbar', { name: 'Main toolbar' }).getByRole('button');
  const n = await buttons.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible())) continue;
    const name = (await b.getAttribute('aria-label')) ?? (await b.textContent()) ?? '';
    expect(name.trim(), `toolbar button ${i}`).not.toBe('');
    // A native tooltip (title) counts; it is drawn by the OS, outside the page.
    if (await b.getAttribute('title')) continue;
    await b.hover();
    await expect(page.getByRole('tooltip').first(), `tooltip for ${name}`).toBeVisible();
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    // Several moves, like a real mouse: Radix closes once the pointer is clear of the tooltip.
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2, { steps: 5 });
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  }

  // Help → Keyboard shortcuts, with the platform's modifier.
  await page.keyboard.press(`${MOD}+/`);
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(process.platform === 'darwin' ? '⌘' : 'Ctrl');
  await expect(sheet.getByText('Save', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Help → Documentation opens the browser.
  await page.evaluate(() => {
    const w = window as unknown as { __opened?: string };
    window.open = (url) => ((w.__opened = String(url)), null);
  });
  await (await palette(page, 'Documentation')).getByRole('option', { name: /^Documentation/ }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __opened?: string }).__opened))
    .toBe('https://gavenrobertson.github.io/LineWise/');
});
