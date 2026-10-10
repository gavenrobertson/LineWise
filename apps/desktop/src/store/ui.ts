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
  kind: 'info' | 'success' | 'error';
  message: string;
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

  open: (d: DialogState) => void;
  close: () => void;
  setPalette: (v: boolean) => void;
  setFind: (v: boolean) => void;
  setPresentation: (v: boolean) => void;
  toggle: (k: 'libraryOpen' | 'inspectorOpen' | 'problemsOpen' | 'outlineOpen') => void;
  set: (
    patch: Partial<Pick<UiState, 'zoom' | 'pathStart' | 'autosavedAt' | 'problemsOpen' | 'outlineOpen'>>,
  ) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

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

  open: (dialog) => set({ dialog, palette: false }),
  close: () => set({ dialog: null }),
  setPalette: (palette) => set({ palette }),
  setFind: (find) => set({ find }),
  setPresentation: (presentation) => set({ presentation }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<UiState>),
  set: (patch) => set(patch),
  toast: (message, kind = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
