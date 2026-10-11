// SPDX-License-Identifier: Apache-2.0
/**
 * Developer tool, not part of the gate: CPU profile of one hostname edit with 500 devices, or of a
 * device drag with BENCH_PROFILE=drag.
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
  if (process.env.BENCH_DEBUG)
    console.log(
      'ZOOM',
      await page.evaluate(() => document.querySelector('.react-flow__viewport')?.getAttribute('style')),
      await page.evaluate(() => document.querySelector('.react-flow')?.className),
      await page.evaluate(() => document.querySelectorAll('.react-flow__node-device')[3]?.outerHTML),
    );
  if (process.env.BENCH_CSS) await page.addStyleTag({ content: process.env.BENCH_CSS });
  for (const cmd of process.env.BENCH_MENU?.split(',').filter(Boolean) ?? [])
    await page.evaluate(
      (c) => (window as unknown as { __linewise: { emitMenu: (c: string) => void } }).__linewise.emitMenu(c),
      cmd,
    );
  if (process.env.BENCH_MENU) await page.waitForTimeout(500);
  const drag = process.env.BENCH_PROFILE?.startsWith('drag');
  // BENCH_PROFILE=dragstart records the press and the first moves too, at 100% zoom like the bench.
  const full = process.env.BENCH_PROFILE === 'dragstart';
  // Drag mode records only the steady part of a drag: the press, the first moves and the drop
  // happen outside the recording.
  const step = (phase: 'press' | 'move' | 'drop') =>
    page.evaluate(
      async ({ phase }) => {
        const w = window as unknown as { __lwDragAt: { x: number; y: number; el: Element } };
        const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
        const at = (type: string, target: EventTarget, x: number, y: number) =>
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              view: window,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: 1,
            }),
          );
        if (phase === 'press') {
          const el = document.querySelectorAll('.react-flow__node-device')[3] as Element;
          const r = el.getBoundingClientRect();
          w.__lwDragAt = { x: r.x + r.width / 2, y: r.y + 20, el };
          at('mousedown', el, w.__lwDragAt.x, w.__lwDragAt.y);
        }
        const p = w.__lwDragAt;
        if (phase === 'drop') return void at('mouseup', window, p.x, p.y);
        for (let i = 0; i < (phase === 'press' ? 5 : 30); i++) {
          await frame();
          p.x += 4;
          p.y += 2;
          at('mousemove', window, p.x, p.y);
        }
        await frame();
      },
      { phase },
    );
  if (drag) {
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    if (full) {
      await page.keyboard.press('Control+0');
      await page.waitForTimeout(400);
    } else await step('press');
  } else {
    await page.locator('.react-flow__node-device').filter({ visible: true }).first().click();
    await page.locator('#inspector-hostname').fill('PROFILED');
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  // BENCH_TRACE=1 also records the renderer's own work (style, layout, paint) per phase.
  const trace: { name: string; ph: string; dur?: number; ts: number; tid: number; cat: string }[] = [];
  if (process.env.BENCH_TRACE) {
    cdp.on('Tracing.dataCollected', (e) => trace.push(...(e.value as unknown as typeof trace)));
    await cdp.send('Tracing.start', {
      categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
      transferMode: 'ReportEvents',
    });
  }
  if (full) await step('press');
  if (process.env.BENCH_LAYERS) {
    // Composited layers and why they exist, sampled during the drag.
    let layers: { layerId: string; drawsContent: boolean; width: number; height: number }[] = [];
    cdp.on('LayerTree.layerTreeDidChange' as never, (e: { layers?: typeof layers }) => {
      if (e.layers) layers = e.layers;
    });
    await cdp.send('LayerTree.enable' as never);
    await step('move');
    const reasons = new Map<string, number>();
    for (const l of layers.slice(0, 400)) {
      const r = (await cdp.send(
        'LayerTree.compositingReasons' as never,
        { layerId: l.layerId } as never,
      )) as {
        compositingReasonIds?: string[];
      };
      for (const id of r.compositingReasonIds ?? ['(none)']) reasons.set(id, (reasons.get(id) ?? 0) + 1);
    }
    console.log(
      'LAYERS',
      layers.length,
      JSON.stringify([...reasons].sort((a, b) => b[1] - a[1]).slice(0, 15)),
    );
  } else if (drag) await step('move');
  else {
    await page.locator('#inspector-hostname').press('Enter');
    await page.waitForTimeout(600);
  }
  const { profile } = (await cdp.send('Profiler.stop')) as {
    profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
  };
  let phases = '';
  if (process.env.BENCH_TRACE) {
    const done = new Promise<void>((r) => cdp.once('Tracing.tracingComplete', () => r()));
    await cdp.send('Tracing.end');
    await done;
    mkdirSync(join(import.meta.dirname, 'results'), { recursive: true });
    writeFileSync(join(import.meta.dirname, 'results', 'trace.json'), JSON.stringify(trace));
    const sum = new Map<string, number>();
    for (const e of trace) if (e.ph === 'X' && e.dur) sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur / 1000);
    phases = `\nTRACE (ms, all threads)\n${[...sum]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([k, v]) => `${v.toFixed(1).padStart(8)}ms ${k}`)
      .join('\n')}\n`;
  }
  if (drag) await step('drop');
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
      .slice(0, Number(process.env.BENCH_TOP ?? 60))
      .map(([k, v]) => `${v.toFixed(1).padStart(8)}ms ${k}`)
      .join('\n');
  mkdirSync(join(import.meta.dirname, 'results'), { recursive: true });
  writeFileSync(
    join(import.meta.dirname, 'results', 'profile.txt'),
    `SELF\n${top(self)}\n\nINCLUSIVE\n${top(incl)}\n${phases}`,
  );
});
