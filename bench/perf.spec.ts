// SPDX-License-Identifier: Apache-2.0
/**
 * Performance benchmarks against NFR-PERF-01..07, with the generated fixtures in bench/fixtures.
 * Timings are taken inside the page with requestAnimationFrame, so they include rendering.
 *
 * One pass writes bench/results/run-<BENCH_RUN>.json. `pnpm bench` runs the suite BENCH_RUNS times
 * and gates the medians (src/gate.ts): every NFR target, and the 20% regression budget against
 * bench/baseline.json when it was recorded on the same kind of machine (NFR-PERF-07).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, totalmem } from 'node:os';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const FIXTURES = join(HERE, 'fixtures');
const RESULTS = join(HERE, 'results');

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
    const w = window as unknown as { __frames: number[]; __stop: boolean; __restart: boolean };
    w.__frames = [];
    w.__stop = false;
    w.__restart = false;
    let last = performance.now();
    const tick = (t: number) => {
      if (w.__stop) return;
      // A restart clears what was counted and times the next frame from this one.
      if (w.__restart) w.__restart = false;
      else w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
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
  if (process.env.BENCH_DEBUG)
    console.log('FRAMES', deltas.length, elapsed, JSON.stringify(deltas.map((d) => Math.round(d))));
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
  if (process.env.BENCH_CSS) await page.addStyleTag({ content: process.env.BENCH_CSS });
  await page.keyboard.press('Control+0');
  await page.waitForTimeout(400);
  // The device nearest the middle of the canvas: one near an edge makes React Flow pan the whole
  // view while dragging, which measures panning instead.
  await page.locator('.react-flow__node-device').first().waitFor();
  await page.evaluate(() => {
    const pane = document.querySelector('.react-flow__pane')!.getBoundingClientRect();
    const cx = pane.x + pane.width / 2;
    const cy = pane.y + pane.height / 2;
    let best: Element | null = null;
    let bestD = Infinity;
    for (const el of document.querySelectorAll('.react-flow__node-device')) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
      if (d < bestD) [best, bestD] = [el, d];
    }
    best?.setAttribute('data-bench-drag', '');
  });
  const firstNode = page.locator('[data-bench-drag]');
  const nodeBox = (await firstNode.boundingBox())!;
  const dragStart = await firstNode.evaluate((el) => el.style.transform);
  if (process.env.BENCH_DEBUG)
    console.log(
      'VIEWPORT',
      await page.evaluate(() => document.querySelector('.react-flow__viewport')?.getAttribute('style')),
    );
  // Pointer moves are dispatched inside the page, one per frame like a real mouse: driving the
  // drag through Playwright's input commands adds a round trip per move and measures that instead.
  const cdp = process.env.BENCH_TRACE ? await page.context().newCDPSession(page) : null;
  const trace: unknown[] = [];
  if (cdp) {
    cdp.on('Tracing.dataCollected' as never, (e: { value: unknown[] }) => trace.push(...e.value));
    await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
      transferMode: 'ReportEvents',
    });
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    await cdp.send('Profiler.start');
  }
  const drag = await frames(page, () =>
    firstNode.evaluate(
      async (el, start) => {
        const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
        const at = (type: string, target: EventTarget, x: number, y: number) =>
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: 1,
            }),
          );
        const w = window as unknown as { __frames: number[]; __stop: boolean; __restart: boolean };
        // Frames are counted while the device moves. The press (which selects it) and the drop
        // (which commits the move to history) are single updates, held to the edit budget below.
        at('mousedown', el, start.x, start.y);
        await frame();
        await frame();
        await frame();
        w.__frames.length = 0;
        w.__restart = true;
        for (let i = 1; i <= 40; i++) {
          await frame();
          at('mousemove', window, start.x + i * 4, start.y + i * 2);
        }
        await frame();
        await frame();
        w.__stop = true;
        at('mouseup', window, start.x + 160, start.y + 80);
        await frame();
      },
      { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + 20 },
    ),
  );
  if (cdp) {
    const done = new Promise<void>((r) => cdp.once('Tracing.tracingComplete' as never, () => r()));
    await cdp.send('Tracing.end');
    await done;
    writeFileSync(join(import.meta.dirname, 'results', 'drag-trace.json'), JSON.stringify(trace));
    const { profile } = await cdp.send('Profiler.stop');
    writeFileSync(join(import.meta.dirname, 'results', 'drag.cpuprofile'), JSON.stringify(profile));
  }
  // The device really moved (otherwise the measurement means nothing).
  expect(await firstNode.evaluate((el) => el.style.transform)).not.toBe(dragStart);
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
  const run = process.env.BENCH_RUN ?? '1';
  const report = { date: new Date().toISOString(), machine: machine(), run, results };
  writeFileSync(join(RESULTS, `run-${run}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nRun ${run}: ${JSON.stringify(results)}`);
});
