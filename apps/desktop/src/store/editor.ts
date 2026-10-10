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

export interface EditorState {
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
  /** Positions while a drag is in progress (not yet in history). */
  dragPositions: Record<string, XY> | null;
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
}

let editor = new Editor(createDocument());

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

export const useEditor = create<EditorState>((set, get) => ({
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
  dragPositions: null,
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
        rev: s.rev + 1,
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
      rev: s.rev + 1,
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
      rev: s.rev + 1,
      pageId,
      selection: pruneSelection(doc, pageId, s.selection),
      highlight: computeHighlight(doc, s.highlightSpec),
      ...historyFlags(),
    });
  },

  endGesture: () => editor.history.breakCoalescing(),

  loadDocument: (doc, file) => {
    editor = new Editor(doc);
    const rev = get().rev + 1;
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
      dragPositions: null,
      ...historyFlags(),
    });
  },

  markSaved: (path, name) => set({ filePath: path, fileName: name, savedRev: get().rev }),

  setPage: (pageId) => set({ pageId, selection: EMPTY_SELECTION }),

  setSelection: (sel) => set({ selection: { ...EMPTY_SELECTION, ...sel } }),

  clearSelection: () => set({ selection: EMPTY_SELECTION }),

  setLayer: (layer) => set({ layer }),

  setHighlight: (spec) => set({ highlightSpec: spec, highlight: computeHighlight(get().doc, spec) }),

  setIssues: (rev, issues, suppressed) => {
    if (rev < get().issuesRev) return;
    set({ issues, suppressed, issuesRev: rev });
  },

  setDragPositions: (p) => set({ dragPositions: p }),

  clearError: () => set({ lastError: null }),
}));

/** True when the document has unsaved changes. */
export const selectDirty = (s: EditorState) => s.rev !== s.savedRev;

export const selectPage = (s: EditorState) => s.doc.pages.find((p) => p.id === s.pageId) ?? s.doc.pages[0];

/** Test hook: the live Editor (history included). */
export function currentEditor(): Editor {
  return editor;
}
