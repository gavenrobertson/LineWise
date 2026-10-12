// SPDX-License-Identifier: Apache-2.0
// Network features in the UI (M2): point-to-point addressing, IPAM, hover cards, the template
// editor, annotations, zones, pages with off-page references and layers.
import { expect, test, type Page } from '@playwright/test';
import { doc, exportsList, MOD, node, openApp, startBlank, startFrom, viewportSettled } from './helpers.ts';

async function palette(page: Page, command: string) {
  await page.keyboard.press(`${MOD}+k`);
  await page.getByRole('combobox').fill(command);
  await page
    .getByRole('option', { name: new RegExp(`^${command}`) })
    .first()
    .click();
}

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

test('FR-NET-08, FR-NET-06 point-to-point addressing from a pool, then IPAM shows the subnet in use', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const d = await doc(page);
  const routers = new Set(d.devices.filter((x) => x.role === 'router').map((x) => x.id));
  const rr = d.links.findIndex((l) => routers.has(l.endpointA.deviceId) && routers.has(l.endpointB.deviceId));
  expect(rr).toBeGreaterThanOrEqual(0);
  const linkId = d.links[rr]!.id;
  await page.locator(`.react-flow__edge[data-id="${linkId}"]`).click({ force: true });
  await inspector(page).getByLabel('Pool').fill('10.99.0.0/24');
  await inspector(page).getByRole('button', { name: 'Assign /30' }).click();

  const ends = async () => {
    const x = await doc(page);
    const l = x.links.find((k) => k.id === linkId)!;
    return [l.endpointA, l.endpointB].map(
      (e) =>
        x.devices.find((dv) => dv.id === e.deviceId)!.interfaces.find((i) => i.id === e.interfaceId)!.ipv4[0]
          ?.address,
    );
  };
  await expect.poll(ends).toEqual(['10.99.0.1', '10.99.0.2']);

  // The new /30 is in IPAM, fully used, with no free address left.
  await palette(page, 'Subnets');
  const ipam = page.getByRole('dialog', { name: 'Subnets and IPAM' });
  await expect(ipam).toBeVisible();
  const row = ipam.getByRole('row').filter({ hasText: '10.99.0.0/30' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('meter', { name: 'Utilization of 10.99.0.0/30' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );

  // Adding an overlapping subnet is flagged.
  await ipam.getByLabel('Subnet', { exact: true }).first().fill('10.99.0.0/24');
  await ipam.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(ipam.getByText('overlap').first()).toBeVisible();
});

test('FR-NET-09 hovering a device shows its info card', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const r1 = (await doc(page)).devices.find((x) => x.hostname === 'R1')!;
  // One shared card for the canvas (FR-UX-09), opened from the device under the pointer. Wait
  // for zoom to fit to finish first: a moving view closes the card and slides R1 away.
  await viewportSettled(page);
  await node(page, 'R1').locator('.lw-device-icon').hover();
  const card = page.locator('[data-lw-linkcard]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('R1');
  await expect(card).toContainText(/router/i);
  await expect(card).toContainText(new RegExp(`of ${r1.interfaces.length} in use`));
  // Moving away closes it.
  await page.mouse.move(5, 300, { steps: 4 });
  await expect(card).toHaveCount(0);
});

test('FR-TPL-04 build a template from scratch with a range, save it and place it', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  const library = page.getByRole('tabpanel', { name: 'Library' });
  await library.getByRole('button', { name: 'New device template…' }).click();
  const editor = page.getByRole('dialog', { name: 'New device template' });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Name', { exact: true }).fill('Lab switch 12');
  await editor.getByLabel('Vendor').fill('Lab');
  await editor.getByLabel('Model').fill('LS-12');
  await editor.getByLabel('Name or range').first().fill('Gi0/1-12');
  await expect(editor.getByText('Interfaces (12 ports)')).toBeVisible();

  // Export as JSON, then import an edited copy back into the editor.
  await editor.getByRole('button', { name: 'Export JSON…' }).click();
  await expect.poll(async () => (await exportsList(page)).length).toBe(1);
  const exported = JSON.parse((await exportsList(page))[0]!.text!) as {
    name: string;
    vendor: string;
    interfaces: { range?: string }[];
  };
  expect(exported).toMatchObject({ name: 'Lab switch 12', vendor: 'Lab' });
  expect(exported.interfaces[0]!.range).toBe('Gi0/1-12');
  const edited = { ...exported, name: 'Lab switch 12', model: 'LS-12B' };
  await page.evaluate((text) => {
    (
      window as unknown as { __linewise: { nextOpen: { path: string; name: string; text: string }[][] } }
    ).__linewise.nextOpen.push([{ path: 'ls-12b.json', name: 'ls-12b.json', text }]);
  }, JSON.stringify(edited));
  await editor.getByRole('button', { name: 'Import JSON…' }).click();
  await expect(editor.getByLabel('Model')).toHaveValue('LS-12B');
  await expect(editor.getByText('Interfaces (12 ports)')).toBeVisible();
  await editor.getByRole('button', { name: 'Save to library' }).click();
  await expect(editor).toHaveCount(0);

  await library.getByRole('searchbox').fill('Lab switch 12');
  await library.getByRole('button', { name: 'Place Lab switch 12' }).first().click();
  await expect.poll(async () => (await doc(page)).devices[0]?.interfaces.length).toBe(12);
  expect((await doc(page)).devices[0]!.interfaces.at(-1)!.shortName).toBe('Gi0/12');
});

test('FR-CAN-11 zones nest, and moving a zone carries the zones and devices inside it', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  type Doc = {
    zones: { id: string; name: string; parentZoneId?: string }[];
    devices: { id: string }[];
    pages: {
      zoneBoxes: Record<string, { x: number; y: number }>;
      nodePositions: Record<string, { x: number; y: number }>;
    }[];
  };
  const state = async () => (await doc(page)) as unknown as Doc;

  // A building zone, grown up and to the left so a second zone fits inside it.
  await palette(page, 'Insert zone');
  await inspector(page).getByLabel('Name').fill('Building A');
  await inspector(page).getByLabel('Name').press('Enter');
  const building = page.getByLabel('Zone Building A');
  await expect(building).toBeVisible();
  const corner = page.locator('.react-flow__resize-control.handle.top.left').first();
  const c = (await corner.boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x - 200, c.y - 150, { steps: 8 });
  await page.mouse.up();

  // A floor zone inside it, with a router inside the floor.
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await palette(page, 'Insert zone');
  await inspector(page).getByLabel('Name').fill('Floor 1');
  await inspector(page).getByLabel('Name').press('Enter');
  await inspector(page).getByLabel('Inside').selectOption({ label: 'Building A' });
  await expect
    .poll(async () => {
      const d = await state();
      const b = d.zones.find((z) => z.name === 'Building A')!;
      return d.zones.find((z) => z.name === 'Floor 1')?.parentZoneId === b.id;
    })
    .toBe(true);
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await palette(page, 'Search device library');
  await page.keyboard.type('Router – 4×GE');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state()).devices.length).toBe(1);

  const before = await state();
  const floorId = before.zones.find((z) => z.name === 'Floor 1')!.id;
  const devId = before.devices[0]!.id;
  const floor0 = before.pages[0]!.zoneBoxes[floorId]!;
  const dev0 = before.pages[0]!.nodePositions[devId]!;

  // Drag the building by its label.
  const label = building.getByText('Building A');
  const l = (await label.boundingBox())!;
  await page.mouse.move(l.x + 10, l.y + l.height / 2);
  await page.mouse.down();
  await page.mouse.move(l.x + 12, l.y + l.height / 2);
  await page.mouse.move(l.x + 130, l.y + l.height / 2 + 80, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await state()).pages[0]!.zoneBoxes[floorId]!.x).not.toBe(floor0.x);
  const after = await state();
  const floor1 = after.pages[0]!.zoneBoxes[floorId]!;
  const dev1 = after.pages[0]!.nodePositions[devId]!;
  // The floor and the router moved by the same amount.
  expect(dev1.x - dev0.x).toBeCloseTo(floor1.x - floor0.x, 0);
  expect(dev1.y - dev0.y).toBeCloseTo(floor1.y - floor0.y, 0);
  expect(floor1.x - floor0.x).toBeGreaterThan(50);
});

test('FR-CAN-10 text, shapes, arrows, notes and embedded images', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  for (const cmd of [
    'Insert text',
    'Insert rectangle',
    'Insert ellipse',
    'Insert arrow',
    'Insert sticky note',
  ]) {
    await palette(page, cmd);
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  }
  // A 1×1 PNG, picked through the image dialog.
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    (ch) => ch.charCodeAt(0),
  );
  await page.evaluate(
    (bytes) => {
      (
        window as unknown as { __linewise: { nextBinary: { name: string; bytes: Uint8Array }[][] } }
      ).__linewise.nextBinary.push([{ name: 'logo.png', bytes: new Uint8Array(bytes) }]);
    },
    [...png],
  );
  await palette(page, 'Insert image');
  type Doc = {
    assets: Record<string, { mime: string }>;
    pages: { annotations: { kind: string; assetId?: string }[] }[];
  };
  await expect
    .poll(async () => ((await doc(page)) as unknown as Doc).pages[0]!.annotations.map((a) => a.kind).sort())
    .toEqual(['ellipse', 'image', 'line', 'note', 'rect', 'text']);
  const d = (await doc(page)) as unknown as Doc;
  const image = d.pages[0]!.annotations.find((a) => a.kind === 'image')!;
  expect(d.assets[image.assetId!]!.mime).toBe('image/png');
  await expect(page.locator('.react-flow__node-annotation img')).toHaveCount(1);
});

test('FR-CAN-12 a second page shows an off-page connector to a device on the first', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const pages = page.getByRole('navigation', { name: 'Pages' });
  await pages.getByRole('button', { name: 'New page' }).click();
  await expect(pages.getByRole('tab')).toHaveCount(2);
  await expect(node(page, 'R1')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Outline' }).click();
  const outline = page.getByRole('tabpanel', { name: 'Outline' });
  await outline
    .getByRole('listitem')
    .filter({ hasText: 'R1' })
    .getByRole('button', { name: 'Add connector' })
    .click();
  await expect(page.locator('.react-flow__node-offpage').filter({ hasText: 'R1' })).toBeVisible();
  // The device still lives on page 1 only.
  type Doc = {
    pages: { nodePositions: Record<string, unknown>; offPageRefs: { deviceId: string }[] }[];
    devices: { id: string; hostname: string }[];
  };
  const d = (await doc(page)) as unknown as Doc;
  const r1 = d.devices.find((x) => x.hostname === 'R1')!.id;
  expect(d.pages.filter((p) => r1 in p.nodePositions)).toHaveLength(1);
  expect(d.pages.some((p) => p.offPageRefs.some((r) => r.deviceId === r1))).toBe(true);

  // A device on this page linked to R1 draws its link to the connector. Devices live on one page,
  // so the file is edited to move R1's neighbour here.
  const text = await page.evaluate(() =>
    (window as unknown as { __lwTest: { serialize: () => string } }).__lwTest.serialize(),
  );
  const file = JSON.parse(text) as {
    links: { endpointA: { deviceId: string }; endpointB: { deviceId: string } }[];
    pages: { nodePositions: Record<string, unknown> }[];
  };
  const l = file.links.find((x) => x.endpointA.deviceId === r1 || x.endpointB.deviceId === r1)!;
  const peer = l.endpointA.deviceId === r1 ? l.endpointB.deviceId : l.endpointA.deviceId;
  file.pages[1]!.nodePositions[peer] = file.pages[0]!.nodePositions[peer];
  delete file.pages[0]!.nodePositions[peer];
  await page.evaluate((t) => {
    const w = window as unknown as {
      __linewise: {
        nextOpen: { path: string; name: string; text: string }[][];
        emitMenu: (c: string) => void;
      };
    };
    w.__linewise.nextOpen.push([{ path: 'moved.lwise', name: 'moved.lwise', text: t }]);
    w.__linewise.emitMenu('file.open');
  }, JSON.stringify(file));
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('tab')).toHaveCount(2);
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('tab').nth(1).click();
  await expect(page.locator('.react-flow__node-offpage').filter({ hasText: 'R1' })).toBeVisible();
  await expect
    .poll(() => page.locator('.react-flow__edge path.react-flow__edge-path').count())
    .toBeGreaterThan(0);
});

test('FR-CAN-13 user layers hide and lock their annotations; network views are listed', async ({ page }) => {
  await openApp(page);
  await startBlank(page);
  await palette(page, 'Insert sticky note');
  await page.getByRole('tab', { name: 'Layers' }).click();
  const layers = page.getByRole('tabpanel', { name: 'Layers' });
  await expect(layers.getByText('Network views')).toBeVisible();
  await layers.getByRole('button', { name: 'Add layer' }).first().click();
  // Put the note on the new layer.
  await page.locator('.react-flow__node-annotation').first().click();
  await inspector(page).getByLabel('Layer').selectOption({ index: 1 });
  type Doc = {
    pages: { annotations: { layerId?: string }[]; layers: { visible: boolean; locked: boolean }[] }[];
  };
  await expect
    .poll(async () => ((await doc(page)) as unknown as Doc).pages[0]!.annotations[0]!.layerId)
    .toBeTruthy();

  await layers.getByRole('button', { name: 'Hide layer' }).click();
  await expect(page.locator('.react-flow__node-annotation')).toHaveCount(0);
  await layers.getByRole('button', { name: 'Show layer' }).click();
  await expect(page.locator('.react-flow__node-annotation')).toHaveCount(1);
  await layers.getByRole('button', { name: 'Lock layer' }).click();
  await expect.poll(async () => ((await doc(page)) as unknown as Doc).pages[0]!.layers[0]!.locked).toBe(true);
  await expect(page.locator('.react-flow__node-annotation').first()).not.toHaveClass(/draggable/);
});
