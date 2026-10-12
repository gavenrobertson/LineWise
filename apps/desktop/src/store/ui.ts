// SPDX-License-Identifier: Apache-2.0
/** Transient UI state: open dialogs, panels, toasts and in-progress interactions. */
import { create } from 'zustand';
import type { UpdateInfo } from '../platform/index.ts';

export type DialogState =
  | { kind: 'welcome' }
  | { kind: 'import'; initialText?: string }
  | { kind: 'export' }
  | { kind: 'vlans' }
  | { kind: 'ipam' }
  | { kind: 'calculator' }
  | { kind: 'preferences' }
  | { kind: 'shortcuts' }
  | { kind: 'about' }
  | { kind: 'layout' }
  | { kind: 'templateEditor'; templateId?: string }
  | { kind: 'connect'; sourceId: string; targetId: string; position?: { x: number; y: number } }
  | { kind: 'linkFromFocused'; sourceId: string }
  | { kind: 'update'; info: UpdateInfo }
  | { kind: 'recovery' }
  | { kind: 'loadIssues'; issues: { path: string; message: string }[]; onRecover: (() => void) | null }
  | null;

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'tip';
  message: string;
  /** How long it stays, in ms; the countdown pauses while the pointer or focus is on it. */
  ms: number;
  /** Buttons after the message, such as a tip's "Don't show again". */
  actions?: { label: string; run: () => void }[];
}

interface UiState {
  dialog: DialogState;
  palette: boolean;
  find: boolean;
  presentation: boolean;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  problemsOpen: boolean;
  outlineOpen: boolean;
  zoom: number;
  toasts: Toast[];
  /** Device chosen as the start of a path highlight, waiting for the second click. */
  pathStart: string | null;
  autosavedAt: string | null;
  /** The first-run tour's step, or null when it is not showing (FR-UX-12). */
  tour: number | null;

  open: (d: DialogState) => void;
  close: () => void;
  setPalette: (v: boolean) => void;
  setFind: (v: boolean) => void;
  setPresentation: (v: boolean) => void;
  toggle: (k: 'libraryOpen' | 'inspectorOpen' | 'problemsOpen' | 'outlineOpen') => void;
  set: (
    patch: Partial<Pick<UiState, 'zoom' | 'pathStart' | 'autosavedAt' | 'problemsOpen' | 'outlineOpen'>>,
  ) => void;
  toast: (message: string, kind?: Toast['kind'], extra?: Pick<Toast, 'actions'> & { ms?: number }) => number;
  dismiss: (id: number) => void;
  setTour: (step: number | null) => void;
  /** Pause (true) or resume (false) a toast's countdown. */
  hold: (id: number, paused: boolean) => void;
}

let toastId = 0;
const toastTimers = new Map<
  number,
  { timer: ReturnType<typeof setTimeout> | null; due: number; left: number }
>();

/**
 * Where keyboard focus goes back to when the last dialog closes. Dialogs can replace each other
 * (the link flow picks a peer, then ports), so the browser's own focus return would land on an
 * element that no longer exists. A canvas node is found again by its id if it re-rendered.
 */
let focusReturn: { el: Element; nodeId: string | null } | null = null;

function rememberFocus(): void {
  if (typeof document === 'undefined') return;
  const el = document.activeElement;
  focusReturn =
    el && el !== document.body
      ? { el, nodeId: el.closest?.('.react-flow__node')?.getAttribute('data-id') ?? null }
      : null;
}

function restoreFocus(): void {
  const target = focusReturn;
  focusReturn = null;
  if (!target || typeof window === 'undefined') return;
  // After the dialog's own focus handling has run.
  window.setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    const el = target.el.isConnected
      ? target.el
      : target.nodeId
        ? document.querySelector(`.react-flow__node[data-id="${CSS.escape(target.nodeId)}"]`)
        : null;
    // Canvas nodes are placed by transforms; scrolling them into view would shift the whole layout.
    (el as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, 0);
}

export const useUi = create<UiState>((set, get) => ({
  dialog: null,
  palette: false,
  find: false,
  presentation: false,
  libraryOpen: true,
  inspectorOpen: true,
  problemsOpen: false,
  outlineOpen: false,
  zoom: 1,
  toasts: [],
  pathStart: null,
  autosavedAt: null,
  tour: null,

  open: (dialog) => {
    if (!get().dialog) rememberFocus();
    set({ dialog, palette: false });
  },
  close: () => {
    set({ dialog: null });
    restoreFocus();
  },
  setPalette: (palette) => set({ palette }),
  setFind: (find) => set({ find }),
  setPresentation: (presentation) => set({ presentation }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<UiState>),
  set: (patch) => set(patch),
  toast: (message, kind = 'info', extra) => {
    const id = ++toastId;
    const ms = extra?.ms ?? (kind === 'error' ? 7000 : kind === 'tip' ? 12000 : 3500);
    set({ toasts: [...get().toasts, { id, kind, message, ms, actions: extra?.actions }] });
    toastTimers.set(id, { timer: setTimeout(() => get().dismiss(id), ms), due: Date.now() + ms, left: ms });
    return id;
  },
  dismiss: (id) => {
    const t = toastTimers.get(id);
    if (t?.timer) clearTimeout(t.timer);
    toastTimers.delete(id);
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
  setTour: (tour) => set({ tour }),
  hold: (id, paused) => {
    const t = toastTimers.get(id);
    if (!t) return;
    if (paused && t.timer) {
      clearTimeout(t.timer);
      t.timer = null;
      t.left = Math.max(0, t.due - Date.now());
    } else if (!paused && !t.timer) {
      t.due = Date.now() + t.left;
      t.timer = setTimeout(() => get().dismiss(id), t.left);
    }
  },
}));
