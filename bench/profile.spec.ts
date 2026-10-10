// SPDX-License-Identifier: Apache-2.0
/**
 * Developer tool, not part of the gate: CPU profile of one hostname edit with 500 devices.
 *   BENCH_SPEC=profile.spec.ts pnpm exec playwright test -c playwright.config.ts
 * For readable names, build the app unminified first: pnpm --filter @linewise/desktop exec vite build --minify false
 * Writes bench/results/profile.txt (self and inclusive time per function).
 */
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

test('profile a property edit', async ({ page }) => {
  await page.route('**/__bench/*', (route) =>
    route.fulfill({
      path: join(import.meta.dirname, 'fixtures', route.request().url().split('/').pop() as string),
    }),
  );
  await page.goto('/');
  await page.waitForFunction(() => '__lwTest' in window);
  await page.evaluate(async () => {
    const text = await (await fetch('/__bench/bench-500.lwise')).text();
    const w = window as unknown as { __linewise: { nextOpen: unknown[][]; emitMenu: (c: string) => void } };
    w.__linewise.nextOpen.push([{ path: 'b.lwise', name: 'b.lwise', text }]);
    w.__linewise.emitMenu('file.open');
  });
  await page.waitForTimeout(3000);
  await page.locator('.react-flow__node-device').filter({ visible: true }).first().click();
  await page.locator('#inspector-hostname').fill('PROFILED');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.locator('#inspector-hostname').press('Enter');
  await page.waitForTimeout(600);
  const { profile } = (await cdp.send('Profiler.stop')) as {
    profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
  };
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = (n: ProfileNode) =>
    `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
  const self = new Map<string, number>();
  const incl = new Map<string, number>();
  profile.samples.forEach((sample, i) => {
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    const leaf = byId.get(sample) as ProfileNode;
    self.set(name(leaf), (self.get(name(leaf)) ?? 0) + dt);
    const seen = new Set<string>();
    for (let id: number | undefined = sample; id !== undefined; id = parent.get(id)) {
      const k = name(byId.get(id) as ProfileNode);
      if (seen.has(k)) continue;
      seen.add(k);
      incl.set(k, (incl.get(k) ?? 0) + dt);
    }
  });
  const top = (m: Map<string, number>) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([k, v]) => `${v.toFixed(1).padStart(8)}ms ${k}`)
      .join('\n');
  mkdirSync(join(import.meta.dirname, 'results'), { recursive: true });
  writeFileSync(
    join(import.meta.dirname, 'results', 'profile.txt'),
    `SELF\n${top(self)}\n\nINCLUSIVE\n${top(incl)}\n`,
  );
});
