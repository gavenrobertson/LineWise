// SPDX-License-Identifier: Apache-2.0
/**
 * Application actions. The native menu, toolbar, keyboard shortcuts and the
 * command palette all dispatch through `runCommand`, so behavior is identical
 * however a command is invoked.
 */
import {
  addAnnotation,
  addAsset,
  addPage,
  addZone,
  batch,
  copySelection,
  createDocument,
  nudgeNodes,
  parseDocument,
  paste,
  removeItems,
  serializeDocument,
  type ClipboardPayload,
  type NetworkDocument,
} from '@linewise/core';
import { detectKind } from '@linewise/parsers';
import i18n from '../i18n/index.ts';
import { platform, type MenuCommand } from '../platform/index.ts';
import { canvasApi } from '../canvas/Canvas.tsx';
import { selectDirty, selectPage, useEditor } from '../store/editor.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

const t = (k: string, d: string, o?: Record<string, unknown>) => i18n.t(k, { defaultValue: d, ...o });

/** Ask before replacing a diagram with unsaved changes: Save, Don't Save or Cancel. */
export async function confirmDiscard(): Promise<boolean> {
  const ed = useEditor.getState();
  if (!selectDirty(ed)) return true;
  const choice = await platform().askUnsaved(
    t('close.message', 'Save changes to this diagram before closing?'),
    {
      save: t('close.save', 'Save'),
      discard: t('close.discard', 'Don’t Save'),
      cancel: t('common.cancel', 'Cancel'),
    },
  );
  if (choice === 'save') return save(false);
  if (choice === 'discard') await platform().clearRecovery(ed.doc.id);
  return choice === 'discard';
}

export async function newDocument(doc?: NetworkDocument): Promise<void> {
  if (!(await confirmDiscard())) return;
  let next = doc;
  if (!next) {
    next = createDocument(t('doc.untitled', 'Untitled diagram'));
    next.settings.defaultLinkRouting = usePrefs.getState().defaultRouting;
  }
  useEditor.getState().loadDocument(next);
  useUi.getState().close();
  requestAnimationFrame(() => canvasApi.fit());
}

export async function openText(text: string, path: string | null, name: string): Promise<boolean> {
  const r = parseDocument(text);
  const ui = useUi.getState();
  const ed = useEditor.getState();
  switch (r.status) {
    case 'ok':
      ed.loadDocument(r.doc, { path, name });
      if (r.migratedFrom !== undefined)
        ui.toast(t('open.migrated', 'Upgraded from an older file format. Save to keep the new format.'));
      for (const w of r.warnings) ui.toast(w);
      break;
    case 'newer':
      ed.loadDocument(r.doc, { path, name, readOnly: true });
      ui.toast(r.warnings[0] ?? t('open.newer', 'Opened read-only.'), 'info');
      break;
    case 'invalid':
      ui.open({
        kind: 'loadIssues',
        issues: r.issues,
        onRecover: r.recovered
          ? () => {
              useEditor
                .getState()
                .loadDocument(r.recovered as NetworkDocument, {
                  path: null,
                  name: `${name.replace(/\.lwise$/i, '')} (recovered).lwise`,
                });
              useUi.getState().close();
            }
          : null,
      });
      return false;
    case 'unreadable':
      ui.toast(r.message, 'error');
      return false;
  }
  ui.close();
  if (path) await platform().addRecent({ path, name });
  requestAnimationFrame(() => canvasApi.fit());
  return true;
}

export async function openFile(path?: string): Promise<void> {
  if (!(await confirmDiscard())) return;
  try {
    const f = path ? await platform().readPath(path) : await platform().openDiagram();
    if (f) await openText(f.text, f.path, f.name);
  } catch (e) {
    useUi.getState().toast((e as Error).message, 'error');
  }
}

export async function save(asNew = false): Promise<boolean> {
  const ed = useEditor.getState();
  if (ed.readOnly) asNew = true;
  const text = serializeDocument(ed.doc);
  try {
    const target = asNew ? null : ed.filePath;
    const suggested = ed.fileName.endsWith('.lwise') ? ed.fileName : `${ed.doc.name || 'diagram'}.lwise`;
    const saved = await platform().saveDiagram(text, target, suggested);
    if (!saved) return false;
    useEditor.getState().markSaved(saved.path, saved.name);
    if (useEditor.getState().readOnly) useEditor.setState({ readOnly: false });
    await platform().addRecent(saved);
    await platform().clearRecovery(ed.doc.id);
    useUi.getState().toast(t('save.done', 'Saved {{name}}', { name: saved.name }), 'success');
    return true;
  } catch (e) {
    useUi
      .getState()
      .toast(t('save.failed', 'Could not save: {{msg}}', { msg: (e as Error).message }), 'error');
    return false;
  }
}

export async function autosaveNow(): Promise<void> {
  const ed = useEditor.getState();
  if (!selectDirty(ed)) return;
  try {
    await platform().writeRecovery({
      docId: ed.doc.id,
      name: ed.fileName,
      path: ed.filePath,
      text: serializeDocument(ed.doc),
    });
    useUi.getState().set({ autosavedAt: new Date().toISOString() });
  } catch {
    // Recovery is best-effort; the user's own saves are unaffected.
  }
}

// ---------------------------------------------------------------- clipboard

let internalClipboard: ClipboardPayload | null = null;

export async function copy(cut = false): Promise<void> {
  const ed = useEditor.getState();
  const ids = ed.selection.devices;
  if (!ids.length) return;
  internalClipboard = copySelection(ed.doc, ed.pageId, ids);
  try {
    await navigator.clipboard?.writeText(JSON.stringify(internalClipboard));
  } catch {
    // system clipboard unavailable; the in-app clipboard still works
  }
  if (cut) ed.execute({ ...removeItems([...ids, ...ed.selection.links]), label: 'Cut' });
}

export async function pasteClipboard(): Promise<void> {
  let payload = internalClipboard;
  try {
    const text = await navigator.clipboard?.readText();
    if (text) {
      const parsed = JSON.parse(text) as ClipboardPayload;
      if (parsed?.kind === 'linewise-clipboard') payload = parsed;
    }
  } catch {
    // not our JSON: fall back to the in-app clipboard
  }
  if (!payload) {
    // Plain CLI output on the clipboard goes to the import dialog (FR-IMP-20).
    try {
      const text = await navigator.clipboard?.readText();
      if (text && detectKind(text)) useUi.getState().open({ kind: 'import', initialText: text });
    } catch {
      // clipboard not readable
    }
    return;
  }
  const ed = useEditor.getState();
  const cmd = paste(ed.pageId, payload);
  if (ed.execute(cmd)) ed.setSelection({ devices: cmd.newDeviceIds });
}

export function duplicate(): void {
  const ed = useEditor.getState();
  if (!ed.selection.devices.length) return;
  const cmd = paste(ed.pageId, copySelection(ed.doc, ed.pageId, ed.selection.devices), { x: 32, y: 32 });
  if (ed.execute({ ...cmd, label: 'Duplicate' })) ed.setSelection({ devices: cmd.newDeviceIds });
}

export function deleteItems(ids?: string[]): void {
  const ed = useEditor.getState();
  const s = ed.selection;
  const all = ids ?? [...s.devices, ...s.links, ...s.zones, ...s.annotations];
  if (all.length) ed.execute(removeItems(all));
}

export function selectAll(): void {
  const ed = useEditor.getState();
  const page = selectPage(ed);
  if (!page) return;
  ed.setSelection({
    devices: Object.keys(page.nodePositions),
    zones: Object.keys(page.zoneBoxes),
    annotations: page.annotations.map((a) => a.id),
    links: ed.doc.links
      .filter((l) => page.nodePositions[l.endpointA.deviceId] && page.nodePositions[l.endpointB.deviceId])
      .map((l) => l.id),
  });
}

export function nudge(dx: number, dy: number): void {
  const ed = useEditor.getState();
  const s = ed.selection;
  const ids = [...s.devices, ...s.zones, ...s.annotations];
  if (ids.length) ed.execute(nudgeNodes(ed.pageId, ids, dx, dy));
}

/** Keyboard navigation: move focus to the nearest device in a direction (NFR-A11Y-01). */
export function focusNearest(dir: 'up' | 'down' | 'left' | 'right'): void {
  const ed = useEditor.getState();
  const page = selectPage(ed);
  if (!page) return;
  const entries = Object.entries(page.nodePositions);
  if (!entries.length) return;
  const curId = ed.selection.devices[0];
  const cur = curId ? page.nodePositions[curId] : undefined;
  if (!cur) {
    const first = entries.sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x)[0];
    if (first) ed.setSelection({ devices: [first[0]] });
    return;
  }
  let best: { id: string; score: number } | null = null;
  for (const [id, p] of entries) {
    if (id === curId) continue;
    const dx = p.x - cur.x;
    const dy = p.y - cur.y;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const score = along + across * 2;
    if (!best || score < best.score) best = { id, score };
  }
  if (best) {
    ed.setSelection({ devices: [best.id] });
    canvasApi.focusOn([best.id]);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${best?.id}"]`)?.focus(),
    );
  }
}

// ---------------------------------------------------------------- insert

export function insert(kind: 'zone' | 'text' | 'note'): void {
  const ed = useEditor.getState();
  const c = canvasApi.viewportCenter();
  if (kind === 'zone') {
    const cmd = addZone(ed.pageId, t('insert.zoneName', 'New zone'), 'custom', {
      x: c.x - 160,
      y: c.y - 100,
      w: 320,
      h: 200,
    });
    if (ed.execute(cmd)) ed.setSelection({ zones: [cmd.zoneId] });
    return;
  }
  const cmd = addAnnotation(ed.pageId, {
    kind,
    geometry: { x: c.x - 80, y: c.y - 30, w: 160, h: kind === 'note' ? 100 : 40, rotation: 0 },
    style: {},
    text: kind === 'note' ? t('insert.noteText', 'Note') : t('insert.text', 'Text'),
    locked: false,
  });
  if (ed.execute(cmd)) ed.setSelection({ annotations: [cmd.annotationId] });
}

export async function insertImage(): Promise<void> {
  const f = await platform().pickBinaryFile([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }]);
  if (!f) return;
  const ext = f.name.split('.').pop()?.toLowerCase() ?? 'png';
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
  let bytes = f.bytes;
  if (mime === 'image/svg+xml') {
    const { sanitizeSvg } = await import('./sanitize.ts');
    bytes = new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(f.bytes)));
  }
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const base64 = btoa(bin);
  const ed = useEditor.getState();
  const asset = addAsset(mime, base64);
  const c = canvasApi.viewportCenter();
  const ann = addAnnotation(ed.pageId, {
    kind: 'image',
    geometry: { x: c.x - 100, y: c.y - 75, w: 200, h: 150, rotation: 0 },
    style: {},
    text: f.name,
    assetId: asset.assetId,
    locked: false,
  });
  ed.execute(batch('Insert image', [asset, ann]));
}

export function newPage(): void {
  const ed = useEditor.getState();
  const cmd = addPage(t('page.default', 'Page {{n}}', { n: ed.doc.pages.length + 1 }));
  if (ed.execute(cmd)) ed.setPage(cmd.pageId);
}

export async function checkUpdates(manual: boolean): Promise<void> {
  const prefs = usePrefs.getState();
  if (!manual && !prefs.updateChecks) return;
  if (!manual && prefs.lastUpdateCheck && Date.now() - Date.parse(prefs.lastUpdateCheck) < 24 * 3600 * 1000)
    return;
  try {
    const info = await platform().checkForUpdates(prefs.updateChannel);
    prefs.set({ lastUpdateCheck: new Date().toISOString() });
    if (info) useUi.getState().open({ kind: 'update', info });
    else if (manual) useUi.getState().toast(t('update.none', 'LineWise is up to date.'), 'success');
  } catch (e) {
    if (manual)
      useUi
        .getState()
        .toast(
          t('update.failed', 'Could not check for updates: {{msg}}', { msg: (e as Error).message }),
          'error',
        );
  }
}

// ---------------------------------------------------------------- registry

export interface CommandDef {
  id: MenuCommand;
  label: string;
  group: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export function commandList(): CommandDef[] {
  const ui = useUi.getState();
  const ed = useEditor.getState;
  const L = (k: string, d: string) => t(`cmd.${k}`, d);
  return [
    {
      id: 'file.new',
      group: 'File',
      label: L('new', 'New diagram'),
      shortcut: 'mod+N',
      run: () => ui.open({ kind: 'welcome' }),
    },
    { id: 'file.open', group: 'File', label: L('open', 'Open…'), shortcut: 'mod+O', run: () => openFile() },
    {
      id: 'file.save',
      group: 'File',
      label: L('save', 'Save'),
      shortcut: 'mod+S',
      run: () => void save(false),
    },
    {
      id: 'file.saveAs',
      group: 'File',
      label: L('saveAs', 'Save as…'),
      shortcut: 'mod+shift+S',
      run: () => void save(true),
    },
    {
      id: 'file.import',
      group: 'File',
      label: L('import', 'Import…'),
      shortcut: 'mod+I',
      run: () => ui.open({ kind: 'import' }),
    },
    {
      id: 'file.export',
      group: 'File',
      label: L('export', 'Export…'),
      shortcut: 'mod+E',
      run: () => ui.open({ kind: 'export' }),
    },
    {
      id: 'file.print',
      group: 'File',
      label: L('print', 'Print…'),
      shortcut: 'mod+P',
      run: async () => (await import('../export/print.ts')).printDiagram(),
    },
    {
      id: 'file.close',
      group: 'File',
      label: L('close', 'Close diagram'),
      shortcut: 'mod+W',
      run: async () => {
        if (!(await confirmDiscard())) return;
        useEditor.getState().loadDocument(createDocument());
        ui.open({ kind: 'welcome' });
      },
    },
    { id: 'edit.undo', group: 'Edit', label: L('undo', 'Undo'), shortcut: 'mod+Z', run: () => ed().undo() },
    {
      id: 'edit.redo',
      group: 'Edit',
      label: L('redo', 'Redo'),
      shortcut: 'mod+shift+Z',
      run: () => ed().redo(),
    },
    { id: 'edit.cut', group: 'Edit', label: L('cut', 'Cut'), shortcut: 'mod+X', run: () => copy(true) },
    { id: 'edit.copy', group: 'Edit', label: L('copy', 'Copy'), shortcut: 'mod+C', run: () => copy(false) },
    {
      id: 'edit.paste',
      group: 'Edit',
      label: L('paste', 'Paste'),
      shortcut: 'mod+V',
      run: () => pasteClipboard(),
    },
    {
      id: 'edit.duplicate',
      group: 'Edit',
      label: L('duplicate', 'Duplicate'),
      shortcut: 'mod+D',
      run: duplicate,
    },
    {
      id: 'edit.delete',
      group: 'Edit',
      label: L('delete', 'Delete'),
      shortcut: 'Delete',
      run: () => deleteItems(),
    },
    {
      id: 'edit.selectAll',
      group: 'Edit',
      label: L('selectAll', 'Select all'),
      shortcut: 'mod+A',
      run: selectAll,
    },
    {
      id: 'edit.find',
      group: 'Edit',
      label: L('find', 'Find…'),
      shortcut: 'mod+F',
      run: () => ui.setFind(true),
    },
    {
      id: 'edit.preferences',
      group: 'Edit',
      label: L('preferences', 'Preferences…'),
      shortcut: 'mod+,',
      run: () => ui.open({ kind: 'preferences' }),
    },
    {
      id: 'view.commandPalette',
      group: 'View',
      label: L('palette', 'Command palette'),
      shortcut: 'mod+K',
      run: () => ui.setPalette(true),
    },
    {
      id: 'view.l1',
      group: 'View',
      label: L('l1', 'Physical view (L1)'),
      shortcut: 'mod+1',
      run: () => ed().setLayer('l1'),
    },
    {
      id: 'view.l2',
      group: 'View',
      label: L('l2', 'Data link view (L2)'),
      shortcut: 'mod+2',
      run: () => ed().setLayer('l2'),
    },
    {
      id: 'view.l3',
      group: 'View',
      label: L('l3', 'Network view (L3)'),
      shortcut: 'mod+3',
      run: () => ed().setLayer('l3'),
    },
    {
      id: 'view.zoomIn',
      group: 'View',
      label: L('zoomIn', 'Zoom in'),
      shortcut: 'mod+=',
      run: () => canvasApi.zoomIn(),
    },
    {
      id: 'view.zoomOut',
      group: 'View',
      label: L('zoomOut', 'Zoom out'),
      shortcut: 'mod+-',
      run: () => canvasApi.zoomOut(),
    },
    {
      id: 'view.zoomFit',
      group: 'View',
      label: L('zoomFit', 'Zoom to fit'),
      shortcut: 'mod+0',
      run: () => canvasApi.fit(),
    },
    {
      id: 'view.minimap',
      group: 'View',
      label: L('minimap', 'Toggle minimap'),
      run: () => usePrefs.getState().set({ showMinimap: !usePrefs.getState().showMinimap }),
    },
    {
      id: 'view.problems',
      group: 'View',
      label: L('problems', 'Toggle problems panel'),
      shortcut: 'mod+shift+M',
      run: () => ui.toggle('problemsOpen'),
    },
    {
      id: 'view.presentation',
      group: 'View',
      label: L('presentation', 'Presentation mode'),
      shortcut: 'F5',
      run: () => ui.setPresentation(!useUi.getState().presentation),
    },
    { id: 'insert.zone', group: 'Insert', label: L('zone', 'Insert zone'), run: () => insert('zone') },
    { id: 'insert.text', group: 'Insert', label: L('text', 'Insert text'), run: () => insert('text') },
    { id: 'insert.note', group: 'Insert', label: L('note', 'Insert sticky note'), run: () => insert('note') },
    { id: 'insert.image', group: 'Insert', label: L('image', 'Insert image…'), run: () => insertImage() },
    { id: 'insert.page', group: 'Insert', label: L('page', 'New page'), run: newPage },
    {
      id: 'arrange.layout',
      group: 'Arrange',
      label: L('layout', 'Auto-layout…'),
      shortcut: 'mod+shift+L',
      run: () => ui.open({ kind: 'layout' }),
    },
    {
      id: 'network.vlans',
      group: 'Network',
      label: L('vlans', 'VLAN manager…'),
      run: () => ui.open({ kind: 'vlans' }),
    },
    {
      id: 'network.ipam',
      group: 'Network',
      label: L('ipam', 'Subnets and IPAM…'),
      run: () => ui.open({ kind: 'ipam' }),
    },
    {
      id: 'network.calculator',
      group: 'Network',
      label: L('calculator', 'Subnet calculator…'),
      run: () => ui.open({ kind: 'calculator' }),
    },
    {
      id: 'network.validate',
      group: 'Network',
      label: L('validate', 'Validate now'),
      run: () => (window.dispatchEvent(new Event('linewise:validate')), ui.set({ problemsOpen: true })),
    },
    {
      id: 'help.shortcuts',
      group: 'Help',
      label: L('shortcuts', 'Keyboard shortcuts'),
      shortcut: 'mod+/',
      run: () => ui.open({ kind: 'shortcuts' }),
    },
    {
      id: 'help.docs',
      group: 'Help',
      label: L('docs', 'Documentation'),
      run: () => platform().openExternal('https://github.com/gavenrobertson/linewise#readme'),
    },
    {
      id: 'help.updates',
      group: 'Help',
      label: L('updates', 'Check for updates…'),
      run: () => checkUpdates(true),
    },
    {
      id: 'help.logs',
      group: 'Help',
      label: L('logs', 'Open logs folder'),
      run: () => platform().openLogsFolder(),
    },
    {
      id: 'help.about',
      group: 'Help',
      label: L('about', 'About LineWise'),
      run: () => ui.open({ kind: 'about' }),
    },
  ];
}

/**
 * A menu click on an Edit item while a text field has focus edits the text,
 * not the diagram (Windows/Linux menus are plain items; see lib/keyboard.ts).
 */
export function editTextField(id: MenuCommand): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !(el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return false;
  const exec = (c: string, v?: string) => document.execCommand(c, false, v);
  switch (id) {
    case 'edit.undo':
      return exec('undo');
    case 'edit.redo':
      return exec('redo');
    case 'edit.cut':
      return exec('cut');
    case 'edit.copy':
      return exec('copy');
    case 'edit.delete':
      return exec('delete');
    case 'edit.selectAll':
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
      else exec('selectAll');
      return true;
    case 'edit.paste':
      void navigator.clipboard
        ?.readText()
        .then((text) => exec('insertText', text))
        .catch(() => undefined);
      return true;
    default:
      return false;
  }
}

export function runCommand(id: MenuCommand): void {
  const cmd = commandList().find((c) => c.id === id);
  if (!cmd) return;
  Promise.resolve(cmd.run()).catch((e: unknown) => useUi.getState().toast((e as Error).message, 'error'));
}

/** Render a shortcut for the current OS: "mod+shift+S" → "⌘⇧S" or "Ctrl+Shift+S". */
export function formatShortcut(s: string | undefined): string {
  if (!s) return '';
  const mac = platform().os === 'macos' || (platform().os === 'web' && /Mac/.test(navigator.platform));
  return s
    .split('+')
    .map((k) => {
      const l = k.toLowerCase();
      if (l === 'mod') return mac ? '⌘' : 'Ctrl';
      if (l === 'shift') return mac ? '⇧' : 'Shift';
      if (l === 'alt') return mac ? '⌥' : 'Alt';
      return k.length === 1 ? k.toUpperCase() : k;
    })
    .join(mac ? '' : '+');
}
