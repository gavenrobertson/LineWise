// SPDX-License-Identifier: Apache-2.0
import { expect, type Page } from '@playwright/test';

export interface TestDoc {
  name: string;
  devices: {
    id: string;
    hostname: string;
    role: string;
    mgmtIp: string;
    interfaces: {
      id: string;
      name: string;
      shortName: string;
      ipv4: { address: string; prefix: number }[];
      mode: string;
      accessVlan?: number;
    }[];
  }[];
  links: {
    id: string;
    endpointA: { deviceId: string; interfaceId: string };
    endpointB: { deviceId: string; interfaceId: string };
  }[];
  vlans: { number: number; name: string }[];
  vrfs: { name: string }[];
  pages: { id: string; name: string }[];
}

/** Open the app with an optional clean slate. */
export async function openApp(page: Page, opts: { keepStorage?: boolean } = {}): Promise<void> {
  if (!opts.keepStorage) {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('lw-e2e-init')) {
        localStorage.clear();
        sessionStorage.setItem('lw-e2e-init', '1');
      }
    });
  }
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
  await page.waitForFunction(() => '__lwTest' in window);
}

export async function doc(page: Page): Promise<TestDoc> {
  return page.evaluate(() => (window as unknown as { __lwTest: { doc: () => TestDoc } }).__lwTest.doc());
}

export async function serialized(page: Page): Promise<string> {
  return page.evaluate(() =>
    (window as unknown as { __lwTest: { serialize: () => string } }).__lwTest.serialize(),
  );
}

export async function issues(page: Page): Promise<{ ruleId: string; message: string }[]> {
  return page.evaluate(() =>
    (
      window as unknown as { __lwTest: { issues: () => { ruleId: string; message: string }[] } }
    ).__lwTest.issues(),
  );
}

export function node(page: Page, hostname: string) {
  return page.locator('.react-flow__node-device').filter({ has: page.getByText(hostname, { exact: true }) });
}

/** Ctrl on Windows/Linux runners, Cmd on macOS. */
export const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

export async function startBlank(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New blank diagram' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function startFrom(page: Page, starter: RegExp): Promise<void> {
  await page.getByRole('button', { name: starter }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Exported files captured by the BrowserPlatform test hooks. */
export async function exportsList(
  page: Page,
): Promise<{ name: string; text: string | null; bytes: number[] | null }[]> {
  return page.evaluate(() =>
    (window.__linewise?.exports ?? []).map((e) => ({
      name: e.name,
      text: typeof e.data === 'string' ? e.data : null,
      bytes: typeof e.data === 'string' ? null : Array.from(e.data),
    })),
  );
}

export async function savedFile(page: Page, path: string): Promise<string | undefined> {
  return page.evaluate((p) => {
    const v = window.__linewise?.files.get(p);
    return typeof v === 'string' ? v : undefined;
  }, path);
}

export async function queueSavePath(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => window.__linewise?.nextSavePath.push(p), path);
}

/** Place a device from the library by clicking it (the keyboard path is covered in journey 7). */
export async function place(page: Page, templateName: string): Promise<void> {
  const library = page.getByRole('tabpanel', { name: 'Library' });
  if (!(await library.isVisible())) await page.getByRole('tab', { name: 'Library' }).click();
  await library.getByRole('searchbox').fill(templateName);
  await library
    .getByRole('button', { name: `Place ${templateName}` })
    .first()
    .click();
  await library.getByRole('searchbox').fill('');
}
