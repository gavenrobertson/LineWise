// SPDX-License-Identifier: Apache-2.0
/**
 * Performance benchmarks against NFR-PERF-01..07, with the generated fixtures in bench/fixtures.
 * Timings are taken inside the page with requestAnimationFrame, so they include rendering.
 *
 * Gates: every NFR target in TARGETS must be met, and when bench/baseline.json was recorded on
 * the same kind of machine, no metric may be more than 20% worse than its baseline.
 * Results go to bench/results/results.json; `BENCH_UPDATE_BASELINE=1` writes a new baseline.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, totalmem } from 'node:os';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const FIXTURES = join(HERE, 'fixtures');
const RESULTS = join(HERE, 'results');

/** NFR targets: [metric, limit, unit, direction]. */
const TARGETS: Record<string, { limit: number; unit: string; better: 'lower' | 'higher'; req: string }> = {
  coldStartMs: { limit: 2000, unit: 'ms', better: 'lower', req: 'NFR-PERF-01' },
  open500Ms: { limit: 2000, unit: 'ms', better: 'lower', req: 'NFR-PERF-02' },
  open2000Ms: { limit: 5000, unit: 'ms', better: 'lower', req: 'NFR-PERF-02' },
  pan500Fps: { limit: 60 * 0.9, unit: 'fps', better: 'higher', req: 'NFR-PERF-03' },
  pan2000Fps: { limit: 30, unit: 'fps', better: 'higher', req: 'NFR-PERF-03' },
  drag500FrameP95Ms: { limit: 16.7 * 1.25, unit: 'ms', better: 'lower', req: 'NFR-PERF-04' },
  edit500Ms: { limit: 50, unit: 'ms', better: 'lower', req: 'NFR-PERF-04' },
  layout500Ms: { limit: 3000, unit: 'ms', better: 'lower', req: 'NFR-PERF-05' },
  heap500Mb: { limit: 250, unit: 'MB', better: 'lower', req: 'NFR-PERF-06' },
};

const results: Record<string, number> = {};

function machine() {
  return {
    os: platform(),
    cpu: cpus()[0]?.model ?? 'unknown',
    cores: cpus().length,
    memGb: Math.round(totalmem() / 2 ** 30),
  };
}

async function boot(page: Page) {
  await page.route('**/__bench/*', (route) =>
    route.fulfill({ path: join(FIXTURES, route.request().url().split('/').pop() as string) }),
  );
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Welcome to LineWise' })).toBeVisible();
  await page.waitForFunction(() => '__lwTest' in window);
}

/** Open a fixture through File → Open; returns ms from the command until the canvas painted it. */
async function open(page: Page, n: number): Promise<number> {
  return page.evaluate(async (count) => {
    const text = await (await fetch(`/__bench/bench-${count}.lwise`)).text();
    const w = window as unknown as {
      __linewise: {
        nextOpen: { path: string; name: string; text: string }[][];
        emitMenu: (c: string) => void;
      };
      __lwTest: { doc: () => { devices: unknown[] } };
    };
    w.__linewise.nextOpen.push([{ path: `bench-${count}.lwise`, name: `bench-${count}.lwise`, text }]);
    const t0 = performance.now();
    w.__linewise.emitMenu('file.open');
    return new Promise<number>((resolve) => {
      const tick = () => {
        if (w.__lwTest.doc().devices.length === count && document.querySelector('.react-flow__node-device'))
          requestAnimationFrame(() => resolve(performance.now() - t0));
        else requestAnimationFrame(tick);
      };
      tick();
    });
  }, n);
}

/** Frame statistics while `action` runs. */
async function frames(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await action();
  const elapsed = Date.now() - t0;
  const deltas = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames.slice(1);
  });
  const sorted = [...deltas].sort((a, b) => a - b);
  return { fps: (deltas.length / elapsed) * 1000, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0 };
}

async function pan(page: Page): Promise<number> {
  const box = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const { fps } = await frames(page, async () => {
    for (let i = 0; i < 90; i++) {
      await page.mouse.wheel(i % 30 < 15 ? 40 : -40, 25);
      if (i % 10 === 0) {
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, i % 20 === 0 ? -60 : 60);
        await page.keyboard.up('Control');
      }
    }
  });
  return fps;
}

test.describe.configure({ mode: 'serial' });

test('NFR-PERF-01 cold start to a usable welcome screen', async ({ page }) => {
  const t0 = Date.now();
  await boot(page);
  results.coldStartMs = Date.now() - t0;
});

test('NFR-PERF-02..06 with 500 devices / ~800 links', async ({ page }) => {
  await boot(page);
  results.open500Ms = await open(page, 500);
  await page.keyboard.press('Control+0');
  results.pan500Fps = await pan(page);

  // Drag one device: frame times stay within a frame (NFR-PERF-04).
  await page.keyboard.press('Control+0');
  await page.waitForTimeout(400);
  const firstNode = page.locator('.react-flow__node-device').filter({ visible: true }).first();
  await firstNode.waitFor();
  const nodeBox = (await firstNode.boundingBox())!;
  const drag = await frames(page, async () => {
    await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + 20);
    await page.mouse.down();
    for (let i = 1; i <= 40; i++)
      await page.mouse.move(nodeBox.x + nodeBox.width / 2 + i * 4, nodeBox.y + 20 + i * 2);
    await page.mouse.up();
  });
  results.drag500FrameP95Ms = drag.p95;

  // Property edit to canvas update (NFR-PERF-04): median of five edits.
  await page.locator('.react-flow__node-device').filter({ visible: true }).first().click();
  const field = page.locator('#inspector-hostname');
  const edits: number[] = [];
  for (let k = 0; k < 5; k++) {
    const name = `PERF-EDIT-${k}`;
    await field.fill(name);
    await page.waitForTimeout(300);
    edits.push(
      await page.evaluate(
        (expected) =>
          new Promise<number>((resolve) => {
            const input = document.querySelector('#inspector-hostname') as HTMLInputElement;
            const t0 = performance.now();
            const check = () => {
              if (
                [...document.querySelectorAll('.react-flow__node-device')].some((n) =>
                  n.textContent?.includes(expected),
                )
              )
                resolve(performance.now() - t0);
              else requestAnimationFrame(check);
            };
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            requestAnimationFrame(check);
          }),
        name,
      ),
    );
  }
  results.edit500Ms = [...edits].sort((x, y) => x - y)[2] as number;

  // Auto-layout of 500 nodes in the worker (NFR-PERF-05).
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Shift+l');
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('radio', { name: /Hierarchical/ })
    .first()
    .click();
  // A short fingerprint of the page layout (comparing the full positions would print megabytes on failure).
  const layoutHash = () =>
    page.evaluate(() => {
      const p =
        (
          window as unknown as {
            __lwTest: { doc: () => { pages: { nodePositions: Record<string, { x: number; y: number }> }[] } };
          }
        ).__lwTest.doc().pages[0]?.nodePositions ?? {};
      let h = 0;
      for (const [k, v] of Object.entries(p)) h = (h * 31 + k.length * 7 + v.x * 13 + v.y * 17) % 1e9;
      return h;
    });
  const before = await layoutHash();
  const t0 = Date.now();
  await dialog.getByRole('button', { name: 'Apply layout' }).click();
  await expect.poll(layoutHash, { timeout: 30_000, intervals: [50] }).not.toBe(before);
  results.layout500Ms = Date.now() - t0;

  // JS heap with a 500-device diagram open (part of NFR-PERF-06; the native process is measured in the release checklist).
  const heap = await page.evaluate(
    () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
  );
  results.heap500Mb = Math.round(heap / 2 ** 20);
});

test('NFR-PERF-02, NFR-PERF-03 with 2,000 devices / ~3,000 links', async ({ page }) => {
  await boot(page);
  results.open2000Ms = await open(page, 2000);
  await page.keyboard.press('Control+0');
  results.pan2000Fps = await pan(page);
});

test('NFR-PERF-07 5,000 devices open (recorded, no target)', async ({ page }) => {
  test.skip(!!process.env.BENCH_SKIP_5000, 'BENCH_SKIP_5000 set');
  await boot(page);
  results.open5000Ms = await open(page, 5000);
});

test.afterAll(() => {
  mkdirSync(RESULTS, { recursive: true });
  const report = { date: new Date().toISOString(), machine: machine(), results, targets: TARGETS };
  writeFileSync(join(RESULTS, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  const rows = Object.entries(results).map(([k, v]) => {
    const t = TARGETS[k];
    const ok = !t || (t.better === 'lower' ? v <= t.limit : v >= t.limit);
    return `${ok ? 'PASS' : 'FAIL'}  ${k.padEnd(20)} ${v.toFixed(1).padStart(9)} ${t ? `${t.better === 'lower' ? '≤' : '≥'} ${t.limit} ${t.unit} (${t.req})` : ''}`;
  });
  console.log(`\nBenchmarks on ${JSON.stringify(machine())}\n${rows.join('\n')}`);
  if (process.env.BENCH_UPDATE_BASELINE === '1')
    writeFileSync(
      join(HERE, 'baseline.json'),
      `${JSON.stringify({ machine: machine(), results }, null, 2)}\n`,
    );
});

test('gates: NFR targets and the 20% regression budget', () => {
  const failures: string[] = [];
  for (const [k, t] of Object.entries(TARGETS)) {
    const v = results[k];
    if (v === undefined) continue;
    if (t.better === 'lower' ? v > t.limit : v < t.limit)
      failures.push(`${k} = ${v.toFixed(1)} ${t.unit}, target ${t.limit} (${t.req})`);
  }
  const baselineFile = join(HERE, 'baseline.json');
  if (existsSync(baselineFile)) {
    const base = JSON.parse(readFileSync(baselineFile, 'utf8')) as {
      machine: ReturnType<typeof machine>;
      results: Record<string, number>;
    };
    const same =
      base.machine.os === machine().os &&
      base.machine.cpu === machine().cpu &&
      base.machine.cores === machine().cores;
    if (!same)
      console.log(
        `Baseline was recorded on ${JSON.stringify(base.machine)}; skipping the regression comparison on this machine.`,
      );
    else
      for (const [k, b] of Object.entries(base.results)) {
        const v = results[k];
        if (v === undefined || !b) continue;
        const higherBetter = TARGETS[k]?.better === 'higher';
        const worse = higherBetter ? (b - v) / b : (v - b) / b;
        if (worse > 0.2)
          failures.push(`${k} regressed ${(worse * 100).toFixed(0)}% (${b.toFixed(1)} → ${v.toFixed(1)})`);
      }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});
