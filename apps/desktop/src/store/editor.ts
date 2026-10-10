// SPDX-License-Identifier: Apache-2.0
/**
 * The document store. It wraps core's Editor: every change is a Command
 * (ADR 0003), so undo/redo, dirty tracking and autosave all hang off one place.
 * Components read state with selectors and call actions; they never mutate
 * the model directly (spec section 9).
 */
import { create } from 'zustand';
import {
  createDocument,
  Editor,
  shortestPath,
  vlanDomain,
  type Command,
  type Highlight,
  type Issue,
  type NetworkDocument,
  type ViewLayer,
} from '@linewise/core';

export interface Selection {
  devices: string[];
  links: string[];
  zones: string[];
  annotations: string[];
}

export const EMPTY_SELECTION: Selection = { devices: [], links: [], zones: [], annotations: [] };

export type HighlightSpec =
  { kind: 'vlan'; vlan: number } | { kind: 'path'; from: string; to: string } | null;

type XY = { x: number; y: number };

/** An open diagram tab (FR-APP-02). The active tab's live state is the store itself. */
export interface TabInfo {
  id: string;
  fileName: string;
  path: string | null;
  dirty: boolean;
}

export interface EditorState {
  /** Open diagrams in tab order, and which one is active. */
  tabs: TabInfo[];
  activeTabId: string;
  doc: NetworkDocument;
  /** Bumped on every model change; workers key results on it. */
  rev: number;
  savedRev: number;
  filePath: string | null;
  fileName: string;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
  pageId: string;
  selection: Selection;
  layer: ViewLayer;
  highlightSpec: HighlightSpec;
  highlight: Highlight | null;
  issues: Issue[];
  suppressed: Issue[];
  issuesRev: number;
  /** Revision at which this document was loaded or its tab activated; older worker results are ignored. */
  baseRev: number;
  lastError: string | null;

  execute: (cmd: Command) => boolean;
  undo: () => void;
  redo: () => void;
  endGesture: () => void;
  loadDocument: (
    doc: NetworkDocument,
    file?: { path: string | null; name: string; readOnly?: boolean },
  ) => void;
  markSaved: (path: string, name: string) => void;
  setPage: (pageId: string) => void;
  setSelection: (sel: Partial<Selection>) => void;
  clearSelection: () => void;
  setLayer: (layer: ViewLayer) => void;
  setHighlight: (spec: HighlightSpec) => void;
  setIssues: (rev: number, issues: Issue[], suppressed: Issue[]) => void;
  setDragPositions: (p: Record<string, XY> | null) => void;
  clearError: () => void;
  /**
   * Open a diagram in a tab. An untouched blank tab is reused; otherwise a new tab opens and
   * becomes active. Returns the tab id.
   */
  openTab: (doc: NetworkDocument, file?: { path: string | null; name: string; readOnly?: boolean }) => string;
  switchTab: (id: string) => void;
  /** Close a tab without asking (the caller confirms unsaved changes first). */
  closeTab: (id: string) => void;
}

let editor = new Editor(createDocument());

/** Revisions are unique across tabs, so worker results for one tab never apply to another. */
let revCounter = 0;
const nextRev = () => ++revCounter;

/** The per-document part of the state, stashed while a tab is in the background. */
const DOC_KEYS = [
  'doc',
  'rev',
  'savedRev',
  'filePath',
  'fileName',
  'readOnly',
  'pageId',
  'selection',
  'layer',
  'highlightSpec',
  'highlight',
  'issues',
  'suppressed',
  'issuesRev',
] as const;
type DocData = Pick<EditorState, (typeof DOC_KEYS)[number]>;

/** Background tabs: their Editor (history included, FR-CAN-07) and document state. */
const stash = new Map<string, { editor: Editor; data: DocData }>();
let tabSeq = 0;
const newTabId = () => `tab-${++tabSeq}`;

function snapshot(s: EditorState): DocData {
  const out = {} as Record<string, unknown>;
  for (const k of DOC_KEYS) out[k] = s[k];
  return out as DocData;
}

function infoOf(id: string, d: DocData): TabInfo {
  return { id, fileName: d.fileName, path: d.filePath, dirty: d.rev !== d.savedRev };
}

/** A tab that can be replaced by the next opened diagram: never saved, unchanged, empty. */
function isPristine(s: EditorState): boolean {
  return (
    s.filePath === null &&
    s.rev === s.savedRev &&
    !s.readOnly &&
    s.doc.devices.length === 0 &&
    s.doc.zones.length === 0 &&
    s.doc.pages.every((p) => p.annotations.length === 0)
  );
}

function computeHighlight(doc: NetworkDocument, spec: HighlightSpec): Highlight | null {
  if (!spec) return null;
  if (spec.kind === 'vlan') return vlanDomain(doc, spec.vlan);
  const p = shortestPath(doc, spec.from, spec.to);
  if (!p) return { deviceIds: new Set([spec.from, spec.to]), interfaceIds: new Set(), linkIds: new Set() };
  return { deviceIds: new Set(p.deviceIds), interfaceIds: new Set(), linkIds: new Set(p.linkIds) };
}

function historyFlags() {
  const h = editor.history;
  return { canUndo: h.canUndo, canRedo: h.canRedo, undoLabel: h.undoLabel, redoLabel: h.redoLabel };
}

/** Drop selection entries that no longer exist after a change. */
function pruneSelection(doc: NetworkDocument, pageId: string, sel: Selection): Selection {
  const devices = new Set(doc.devices.map((d) => d.id));
  const links = new Set(doc.links.map((l) => l.id));
  const zones = new Set(doc.zones.map((z) => z.id));
  const anns = new Set(doc.pages.find((p) => p.id === pageId)?.annotations.map((a) => a.id) ?? []);
  return {
    devices: sel.devices.filter((x) => devices.has(x)),
    links: sel.links.filter((x) => links.has(x)),
    zones: sel.zones.filter((x) => zones.has(x)),
    annotations: sel.annotations.filter((x) => anns.has(x)),
  };
}

const firstTab = newTabId();

/**
 * Positions while a drag is in progress (not yet in history). They live apart from the editor
 * state so a pointer move wakes only the canvas, not every editor subscriber (NFR-PERF-04).
 */
export const useDragPreview = create<{ positions: Record<string, XY> | null }>(() => ({ positions: null }));

export const useEditor = create<EditorState>((set, get) => ({
  tabs: [{ id: firstTab, fileName: 'Untitled.lwise', path: null, dirty: false }],
  activeTabId: firstTab,
  doc: editor.doc,
  rev: 0,
  savedRev: 0,
  filePath: null,
  fileName: 'Untitled.lwise',
  readOnly: false,
  canUndo: false,
  canRedo: false,
  pageId: editor.doc.pages[0]?.id ?? '',
  selection: EMPTY_SELECTION,
  layer: 'l1',
  highlightSpec: null,
  highlight: null,
  issues: [],
  suppressed: [],
  issuesRev: -1,
  baseRev: 0,
  lastError: null,

  execute: (cmd) => {
    if (get().readOnly) {
      set({ lastError: 'This diagram was made with a newer version of LineWise and is open read-only.' });
      return false;
    }
    try {
      const changed = editor.execute(cmd);
      if (!changed) return false;
      const doc = editor.doc;
      const s = get();
      const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : (doc.pages[0]?.id ?? '');
      set({
        doc,
        rev: nextRev(),
        pageId,
        selection: pruneSelection(doc, pageId, s.selection),
        highlight: computeHighlight(doc, s.highlightSpec),
        ...historyFlags(),
      });
      return true;
    } catch (e) {
      set({ lastError: (e as Error).message });
      return false;
    }
  },

  undo: () => {
    if (!editor.history.canUndo) return;
    editor.undo();
    const s = get();
    const doc = editor.doc;
    const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : (doc.pages[0]?.id ?? '');
    set({
      doc,
      rev: nextRev(),
      pageId,
      selection: pruneSelection(doc, pageId, s.selection),
      highlight: computeHighlight(doc, s.highlightSpec),
      ...historyFlags(),
    });
  },

  redo: () => {
    if (!editor.history.canRedo) return;
    editor.redo();
    const s = get();
    const doc = editor.doc;
    const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : (doc.pages[0]?.id ?? '');
    set({
      doc,
      rev: nextRev(),
      pageId,
      selection: pruneSelection(doc, pageId, s.selection),
      highlight: computeHighlight(doc, s.highlightSpec),
      ...historyFlags(),
    });
  },

  endGesture: () => editor.history.breakCoalescing(),

  loadDocument: (doc, file) => {
    editor = new Editor(doc);
    const rev = nextRev();
    set({
      doc,
      rev,
      savedRev: rev,
      filePath: file?.path ?? null,
      fileName: file?.name ?? `${doc.name || 'Untitled'}.lwise`,
      readOnly: file?.readOnly ?? false,
      pageId: doc.pages[0]?.id ?? '',
      selection: EMPTY_SELECTION,
      highlightSpec: null,
      highlight: null,
      issues: [],
      suppressed: [],
      issuesRev: -1,
      baseRev: rev,
      ...historyFlags(),
    });
    useDragPreview.setState({ positions: null });
  },

  markSaved: (path, name) => set({ filePath: path, fileName: name, savedRev: get().rev }),

  setPage: (pageId) => set({ pageId, selection: EMPTY_SELECTION }),

  setSelection: (sel) => set({ selection: { ...EMPTY_SELECTION, ...sel } }),

  clearSelection: () => set({ selection: EMPTY_SELECTION }),

  setLayer: (layer) => set({ layer }),

  setHighlight: (spec) => set({ highlightSpec: spec, highlight: computeHighlight(get().doc, spec) }),

  setIssues: (rev, issues, suppressed) => {
    if (rev < get().issuesRev || rev < get().baseRev) return;
    set({ issues, suppressed, issuesRev: rev });
  },

  setDragPositions: (p) => useDragPreview.setState({ positions: p }),

  clearError: () => set({ lastError: null }),

  openTab: (doc, file) => {
    const s = get();
    if (isPristine(s)) {
      get().loadDocument(doc, file);
      return s.activeTabId;
    }
    stash.set(s.activeTabId, { editor, data: snapshot(s) });
    const id = newTabId();
    set({
      tabs: [
        ...s.tabs.map((t) => (t.id === s.activeTabId ? infoOf(t.id, snapshot(s)) : t)),
        { id, fileName: '', path: null, dirty: false },
      ],
      activeTabId: id,
    });
    get().loadDocument(doc, file);
    return id;
  },

  switchTab: (id) => {
    const s = get();
    const target = stash.get(id);
    if (id === s.activeTabId || !target) return;
    stash.set(s.activeTabId, { editor, data: snapshot(s) });
    stash.delete(id);
    editor = target.editor;
    const rev = nextRev();
    const dirty = target.data.rev !== target.data.savedRev;
    set({
      ...target.data,
      rev,
      savedRev: dirty ? -1 : rev,
      issuesRev: -1,
      baseRev: rev,
      activeTabId: id,
      tabs: s.tabs.map((t) => (t.id === s.activeTabId ? infoOf(t.id, snapshot(s)) : t)),
      ...historyFlags(),
    });
    useDragPreview.setState({ positions: null });
  },

  closeTab: (id) => {
    const s = get();
    const idx = s.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    if (id !== s.activeTabId) {
      stash.delete(id);
      set({ tabs: s.tabs.filter((t) => t.id !== id) });
      return;
    }
    const rest = s.tabs.filter((t) => t.id !== id);
    const next = rest[Math.min(idx, rest.length - 1)];
    if (!next) {
      // Closing the last tab leaves one blank diagram.
      set({ tabs: [{ id, fileName: 'Untitled.lwise', path: null, dirty: false }] });
      get().loadDocument(createDocument());
      return;
    }
    get().switchTab(next.id);
    stash.delete(id);
    set({ tabs: get().tabs.filter((t) => t.id !== id) });
  },
}));

// Keep the active tab's title and dirty flag in the tab list.
useEditor.subscribe((s, prev) => {
  if (
    s.fileName === prev.fileName &&
    s.filePath === prev.filePath &&
    s.rev === prev.rev &&
    s.savedRev === prev.savedRev &&
    s.tabs === prev.tabs
  )
    return;
  const info = infoOf(s.activeTabId, s);
  const cur = s.tabs.find((t) => t.id === s.activeTabId);
  if (cur && cur.fileName === info.fileName && cur.path === info.path && cur.dirty === info.dirty) return;
  useEditor.setState({ tabs: s.tabs.map((t) => (t.id === s.activeTabId ? info : t)) });
});

/** Tabs with unsaved changes, active first (used before quitting). */
export function dirtyTabIds(): string[] {
  const s = useEditor.getState();
  return s.tabs.filter((t) => (t.id === s.activeTabId ? selectDirty(s) : t.dirty)).map((t) => t.id);
}

/** True when the document has unsaved changes. */
export const selectDirty = (s: EditorState) => s.rev !== s.savedRev;

export const selectPage = (s: EditorState) => s.doc.pages.find((p) => p.id === s.pageId) ?? s.doc.pages[0];

/** Test hook: the live Editor (history included). */
export function currentEditor(): Editor {
  return editor;
}
