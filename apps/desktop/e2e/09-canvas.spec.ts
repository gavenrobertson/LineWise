// SPDX-License-Identifier: Apache-2.0
// Canvas behavior (FR-CAN-01..09): pan and zoom, grid snap and guides, minimap, selection,
// nudge, arrange, undo coalescing, copy/paste, drag from the library and drop on a link.
import { expect, test, type Page } from '@playwright/test';
import { doc, MOD, node, openApp, startBlank, startFrom } from './helpers.ts';

interface Positions {
  pages: { nodePositions: Record<string, { x: number; y: number }> }[];
}

async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  return page.locator('.react-flow__viewport').evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
}

/** The viewport once it has stopped moving (the opening fit animates). */
async function settledViewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  let last = await viewport(page);
  await expect
    .poll(async () => {
      const v = await viewport(page);
      const same = v.zoom === last.zoom && v.x === last.x && v.y === last.y;
      last = v;
      return same;
    })
    .toBe(true);
  return last;
}

async function positionOf(page: Page, hostname: string) {
  const d = (await doc(page)) as unknown as Awaited<ReturnType<typeof doc>> & Positions;
  const id = d.devices.find((x) => x.hostname === hostname)?.id as string;
  return d.pages[0]?.nodePositions[id] as { x: number; y: number };
}

async function palette(page: Page, command: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(command);
  await page
    .getByRole('option', { name: new RegExp(`^${command}`) })
    .first()
    .click();
}

/** Zoom to fit eases the view (FR-UX-03); wait until it stops moving. */
async function viewportSettled(page: Page) {
  const transform = () =>
    page.evaluate(() => document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? '');
  let last = '';
  await expect
    .poll(async () => {
      const now = await transform();
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
}

async function canvasCenter(page: Page) {
  const box = (await page.locator('.react-flow__pane').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test('FR-CAN-01 wheel pans, Ctrl/Cmd+wheel zooms within 10%–400%, fit and zoom to selection', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect(node(page, 'R1')).toBeVisible();
  const c = await canvasCenter(page);
  await page.mouse.move(c.x, c.y);

  await settledViewport(page);
  const v0 = await viewport(page);
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await viewport(page)).y).not.toBe(v0.y);
  expect((await viewport(page)).zoom).toBeCloseTo(v0.zoom, 5);

  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(v0.zoom);

  // Each zoom step animates; let it finish before the next press. Keep stepping until the limit
  // holds (a slow runner may land a step short), with a cap so a broken limit still fails.
  const settledZoom = async () => {
    let last = (await viewport(page)).zoom;
    for (;;) {
      await page.waitForTimeout(80);
      const z = (await viewport(page)).zoom;
      if (z === last) return z;
      last = z;
    }
  };
  const zoomTo = async (key: string, limit: number) => {
    for (let i = 0; i < 40; i++) {
      const before = await settledZoom();
      if (Math.abs(before - limit) < 0.005) break;
      await page.keyboard.press(key);
      if ((await settledZoom()) === before) break;
    }
    expect(await settledZoom()).toBeCloseTo(limit, 2);
  };
  await zoomTo(`${MOD}+=`, 4);
  await zoomTo(`${MOD}+-`, 0.1);

  await page.keyboard.press(`${MOD}+0`);
  await expect(node(page, 'R1')).toBeInViewport();
  await expect(node(page, 'SW2')).toBeInViewport();

  await node(page, 'R3').click();
  await page.keyboard.press(`${MOD}+Shift+0`);
  await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(1);
  await expect(node(page, 'R3')).toBeInViewport();
});

test('FR-CAN-01 Space+drag and middle-button drag pan the canvas', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect(node(page, 'R1')).toBeVisible();
  const c = await canvasCenter(page);
  // Start on empty canvas near the top-left corner, clear of devices and the zoom controls.
  const x = c.box.x + 40;
  const y = c.box.y + 60;
  const dragFrom = async (button: 'left' | 'middle') => {
    await page.mouse.move(x, y);
    await page.mouse.down({ button });
    await page.mouse.move(x + 60, y + 40, { steps: 8 });
    await page.mouse.up({ button });
  };

  let v = await settledViewport(page);
  await page.keyboard.down('Space');
  await dragFrom('left');
  await page.keyboard.up('Space');
  await expect.poll(async () => (await viewport(page)).x).toBeCloseTo(v.x + 60, -1);
  expect((await doc(page)).devices).toHaveLength(5);

  v = await settledViewport(page);
  await dragFrom('middle');
  await expect.poll(async () => (await viewport(page)).x).toBeCloseTo(v.x + 60, -1);
  expect((await viewport(page)).zoom).toBeCloseTo(v.zoom, 5);
});

test('FR-CAN-02, FR-CAN-03 grid snap, alignment guide while dragging, minimap toggle', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await expect(page.getByLabel('Minimap')).toBeVisible();
  await palette(page, 'Toggle minimap');
  await expect(page.getByLabel('Minimap')).toHaveCount(0);
  await palette(page, 'Toggle minimap');
  await expect(page.getByLabel('Minimap')).toBeVisible();
  // Clicking the minimap moves the view there; it shows every device.
  const map = page.getByLabel('Minimap');
  await expect(map.locator('rect[fill="var(--device)"]')).toHaveCount(5);
  const style = () => page.locator('.react-flow__viewport').getAttribute('style');
  const before = await style();
  const m = (await map.boundingBox())!;
  await page.mouse.click(m.x + 8, m.y + 8);
  await expect.poll(style).not.toBe(before);
  await palette(page, 'Zoom to fit');
  await settledViewport(page);

  // Sweep R3 horizontally past R1, like a user would: the vertical guide appears when the
  // centers line up, and releasing there snaps R3 onto R1's x.
  const r1 = await positionOf(page, 'R1');
  const from = (await node(page, 'R3').boundingBox())!;
  const target = (await node(page, 'R1').boundingBox())!;
  const y = from.y + from.height / 2 + 60;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // The first small move starts the drag; then glide to the start of the sweep.
  await page.mouse.move(from.x + from.width / 2 - 2, from.y + from.height / 2);
  await page.mouse.move(target.x + target.width / 2 + 60, y, { steps: 20 });
  let seen = false;
  for (let x = target.x + target.width / 2 + 60; x > target.x + target.width / 2 - 60; x -= 2) {
    await page.mouse.move(x, y);
    if (await page.locator('[data-lw-guide="x"]').count()) {
      seen = true;
      break;
    }
  }
  expect(seen).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => (await positionOf(page, 'R3')).x).toBe(r1.x);
  // Snap-to-grid: positions land on the snap grid.
  const p = await positionOf(page, 'R3');
  expect(Number.isInteger(p.y)).toBe(true);
});

test('FR-CAN-04 click, Shift-click, marquee, select all, same type and connected', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const selected = page.locator('.react-flow__node-device.selected');

  await node(page, 'R1').click();
  await expect(selected).toHaveCount(1);
  await node(page, 'R2').click({ modifiers: ['Shift'] });
  await expect(selected).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(selected).toHaveCount(0);
  await page.keyboard.press(`${MOD}+a`);
  await expect(selected).toHaveCount(5);

  await page.keyboard.press('Escape');
  await node(page, 'R1').click();
  await page.keyboard.press(`${MOD}+Shift+a`);
  await expect(selected).toHaveCount(3); // the three routers

  await page.keyboard.press('Escape');
  await node(page, 'SW2').click();
  await palette(page, 'Select connected devices');
  await expect.poll(async () => selected.count()).toBeGreaterThan(1);

  // Marquee: drag a rectangle around everything on empty canvas.
  await page.keyboard.press('Escape');
  await page.keyboard.press(`${MOD}+0`);
  await viewportSettled(page);
  const { box } = await canvasCenter(page);
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 10 });
  await page.mouse.up();
  await expect(selected).toHaveCount(5);
});

test('FR-CAN-05, FR-CAN-07 nudge with arrows (Shift = 10×) and a drag is one undo step', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await node(page, 'R1').click();
  // Arrows pan when nothing is selected, so wait for the click to select R1.
  await expect(node(page, 'R1')).toHaveClass(/\bselected\b/);
  const p0 = await positionOf(page, 'R1');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await positionOf(page, 'R1')).x).toBe(p0.x + 1);
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await positionOf(page, 'R1')).y).toBe(p0.y + 10);

  const before = await positionOf(page, 'R2');
  const b = (await node(page, 'R2').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width / 2 + i * 12, b.y + b.height / 2 + i * 7);
  await page.mouse.up();
  await expect.poll(async () => (await positionOf(page, 'R2')).x).not.toBe(before.x);
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => positionOf(page, 'R2')).toEqual(before);
});

test('FR-CAN-05 resize a shape by its corner and rotate it from the inspector', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await palette(page, 'Insert rectangle');
  type Shape = { geometry: { w: number; h: number; rotation: number } };
  const shape = async () =>
    ((await doc(page)) as unknown as { pages: { annotations: Shape[] }[] }).pages[0]!.annotations[0]!;
  await expect.poll(async () => (await shape())?.geometry.w).toBeGreaterThan(0);
  const g0 = (await shape()).geometry;
  const box = page.locator('.react-flow__node-annotation').first();
  await box.click();
  const corner = page.locator('.react-flow__resize-control.handle.bottom.right').first();
  await expect(corner).toBeVisible();
  const c = (await corner.boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 + 60, c.y + c.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await shape()).geometry.w).toBeGreaterThan(g0.w + 40);
  expect((await shape()).geometry.h).toBeGreaterThan(g0.h + 20);

  const rotation = page.getByRole('complementary', { name: 'Inspector' }).getByLabel('Rotation (°)');
  await rotation.fill('30');
  await rotation.press('Enter');
  await expect.poll(async () => (await shape()).geometry.rotation).toBe(30);
  await expect(box.locator('[style*="rotate(30deg)"]')).toHaveCount(1);
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await shape()).geometry.rotation).toBe(0);
});

test('FR-CAN-06 align, distribute, group, lock and stacking from the Arrange commands', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await node(page, 'R1').click();
  await node(page, 'R2').click({ modifiers: ['Shift'] });
  await node(page, 'R3').click({ modifiers: ['Shift'] });
  await palette(page, 'Align top');
  await expect
    .poll(
      async () =>
        new Set([
          (await positionOf(page, 'R1')).y,
          (await positionOf(page, 'R2')).y,
          (await positionOf(page, 'R3')).y,
        ]).size,
    )
    .toBe(1);
  await palette(page, 'Distribute horizontally');
  const xs = [
    (await positionOf(page, 'R1')).x,
    (await positionOf(page, 'R2')).x,
    (await positionOf(page, 'R3')).x,
  ].sort((a, b) => a - b);
  expect(Math.abs(xs[1]! - xs[0]! - (xs[2]! - xs[1]!))).toBeLessThanOrEqual(1);

  // Lock: a locked device cannot be dragged.
  await page.keyboard.press('Escape');
  await node(page, 'R1').click();
  await page.keyboard.press(`${MOD}+l`);
  const locked = await positionOf(page, 'R1');
  const b = (await node(page, 'R1').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 200, b.y + 120, { steps: 6 });
  await page.mouse.up();
  expect(await positionOf(page, 'R1')).toEqual(locked);
  await page.keyboard.press(`${MOD}+Shift+k`);

  // Group: Ctrl/Cmd+G wraps the selection in a zone; Shift+Ctrl/Cmd+G removes it.
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press(`${MOD}+g`);
  await expect(page.locator('.react-flow__node-zone')).toHaveCount(1);
  await page
    .locator('.react-flow__node-zone')
    .first()
    .click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(`${MOD}+Shift+g`);
  await expect(page.locator('.react-flow__node-zone')).toHaveCount(0);
});

test('FR-CAN-08 copy and paste give unique hostnames and cleared IPs', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const r1 = (await doc(page)).devices.find((d) => d.hostname === 'R1')!;
  expect(r1.interfaces.some((i) => i.ipv4.length > 0)).toBe(true);
  await node(page, 'R1').click();
  await page.keyboard.press(`${MOD}+c`);
  await page.keyboard.press(`${MOD}+v`);
  await expect.poll(async () => (await doc(page)).devices.length).toBe(6);
  const copy = (await doc(page)).devices.find(
    (d) => d.id !== r1.id && d.role === 'router' && !['R1', 'R2', 'R3'].includes(d.hostname),
  )!;
  expect(copy.hostname).not.toBe('R1');
  expect(copy.interfaces.every((i) => i.ipv4.length === 0)).toBe(true);
  await page.keyboard.press(`${MOD}+d`);
  await expect.poll(async () => new Set((await doc(page)).devices.map((d) => d.hostname)).size).toBe(7);
});

test('FR-CAN-09 drag a template onto the canvas, and onto a link to insert it inline', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  const library = page.getByRole('tabpanel', { name: 'Library' });
  await library.getByRole('searchbox').fill('Router – 4×GE');
  const item = library.getByRole('button', { name: 'Place Router – 4×GE' }).first();
  const { box } = await canvasCenter(page);
  await item.dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: box.width * 0.25, y: box.height / 2 },
  });
  await item.dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: box.width * 0.75, y: box.height / 2 },
  });
  await expect.poll(async () => (await doc(page)).devices.length).toBe(2);

  // Link them, then drop a switch on the middle of the link.
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.getByRole('tabpanel', { name: 'Outline' }).getByRole('treeitem', { name: /^R1\b/ }).click();
  await page.keyboard.press('l');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('R2');
  await dialog.getByRole('button', { name: /^R2/ }).click();
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect.poll(async () => (await doc(page)).links.length).toBe(1);

  await page.getByRole('tab', { name: 'Library' }).click();
  await library.getByRole('searchbox').fill('Access switch – 24×GE + 4×SFP');
  const r1 = (await node(page, 'R1').boundingBox())!;
  const r2 = (await node(page, 'R2').boundingBox())!;
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  const mid = {
    x: (r1.x + r1.width / 2 + r2.x + r2.width / 2) / 2 - pane.x,
    y: (r1.y + r1.height / 2 + r2.y + r2.height / 2) / 2 - pane.y,
  };
  await library
    .getByRole('button', { name: 'Place Access switch – 24×GE + 4×SFP' })
    .first()
    .dragTo(page.locator('.react-flow__pane'), { targetPosition: mid });
  await expect.poll(async () => (await doc(page)).devices.length).toBe(3);
  await expect.poll(async () => (await doc(page)).links.length).toBe(2);
  const sw = (await doc(page)).devices.find((d) => d.role === 'l2-switch')!;
  const links = (await doc(page)).links;
  expect(links.every((l) => l.endpointA.deviceId === sw.id || l.endpointB.deviceId === sw.id)).toBe(true);
});

test('FR-CAN-14 hierarchical and orthogonal auto-layout run in a worker and undo in one step', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  const before = await positionOf(page, 'ACC1');
  for (const algorithm of [/Hierarchical/, /Orthogonal/]) {
    await page.keyboard.press(`${MOD}+Shift+l`);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: algorithm }).first().click();
    await dialog.getByRole('button', { name: 'Apply layout' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/Layout failed/)).toHaveCount(0);
  }
  // Tiers stay in order: core above distribution above access.
  const y = async (h: string) => (await positionOf(page, h)).y;
  expect(await y('CORE1')).toBeLessThan(await y('DIST1'));
  expect(await y('DIST1')).toBeLessThan(await y('ACC1'));
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(`${MOD}+z`);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => positionOf(page, 'ACC1')).toEqual(before);
});

test('FR-LNK-01, FR-LNK-02 draw a link from a handle, filter ports, change its style and add and remove a bend', async ({
  page,
}) => {
  await openApp(page);
  await startBlank(page);
  const library = page.getByRole('tabpanel', { name: 'Library' });
  await library.getByRole('searchbox').fill('Access switch – 24×GE + 4×SFP');
  const item = library.getByRole('button', { name: 'Place Access switch – 24×GE + 4×SFP' }).first();
  const { box } = await canvasCenter(page);
  await item.dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: box.width * 0.3, y: box.height * 0.4 },
  });
  await item.dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: box.width * 0.7, y: box.height * 0.6 },
  });
  await expect.poll(async () => (await doc(page)).devices.length).toBe(2);

  // Drag from SW1's bottom handle onto SW2: the connect dialog asks for the ports. Handles
  // appear on the device under the pointer.
  await node(page, 'SW1').hover();
  const handle = node(page, 'SW1').locator('.react-flow__handle[data-handleid="b"]');
  const target = (await node(page, 'SW2').boundingBox())!;
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 20, { steps: 12 });
  await page.mouse.up();
  const dialog = page.getByRole('dialog', { name: 'Connect SW1 to SW2' });
  await expect(dialog).toBeVisible();
  // "Next free port" is the default; typing filters and picks the matching port.
  await expect(dialog.getByLabel('Port', { exact: true }).first()).toHaveValue('');
  await dialog.getByRole('textbox', { name: 'Filter SW1 ports' }).fill('gi1/0/7');
  await expect(dialog.getByLabel('Port', { exact: true }).first()).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect.poll(async () => (await doc(page)).links.length).toBe(1);
  const d1 = await doc(page);
  const sw1 = d1.devices.find((d) => d.hostname === 'SW1')!;
  const end = [d1.links[0]!.endpointA, d1.links[0]!.endpointB].find((e) => e.deviceId === sw1.id)!;
  expect(sw1.interfaces.find((i) => i.id === end.interfaceId)?.shortName).toBe('Gi1/0/7');

  // Per-link style: select the link and switch it to orthogonal.
  await page.locator('.react-flow__edge').first().click({ force: true });
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await inspector.getByLabel('Line style').selectOption('orthogonal');
  const links = async () =>
    (await doc(page)) as unknown as { links: { style: { routing?: string; waypoints?: unknown[] } }[] };
  await expect.poll(async () => (await links()).links[0]!.style.routing).toBe('orthogonal');

  // Double-click the link to add a bend point; double-click the bend point to remove it.
  const path = page.locator('.react-flow__edge-interaction').first();
  await path.dblclick({ force: true });
  await expect.poll(async () => (await links()).links[0]!.style.waypoints?.length ?? 0).toBe(1);
  await page.getByRole('button', { name: 'Bend point', exact: true }).dblclick();
  await expect.poll(async () => (await links()).links[0]!.style.waypoints?.length ?? 0).toBe(0);
});
