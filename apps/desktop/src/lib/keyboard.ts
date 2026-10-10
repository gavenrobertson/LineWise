// SPDX-License-Identifier: Apache-2.0
/**
 * Keyboard handling (FR-KEY-01/02, NFR-A11Y-01).
 *
 * - Browser build and Windows/Linux desktop: every command shortcut is handled
 *   here (the native menu there shows hints but registers no accelerators, so
 *   Ctrl+C/V/Z keep working in text fields).
 * - macOS desktop: the menu owns the key equivalents, except the Edit items,
 *   which are native (predefined) so text fields work; for the canvas those
 *   keys are handled here and the event is consumed before the menu sees it.
 */
import { useEffect } from 'react';
import { platform, type MenuCommand } from '../platform/index.ts';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import { commandList, focusNearest, nudge, runCommand } from './actions.ts';

export { isTyping };

function isTyping(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e) return false;
  return (
    e.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName) ||
    !!e.closest('[role="dialog"]')
  );
}

function matches(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.at(-1) as string;
  const mod = parts.includes('mod');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const modDown = e.metaKey || e.ctrlKey;
  if (mod !== modDown || shift !== e.shiftKey || alt !== e.altKey) return false;
  const k = e.key.toLowerCase();
  if (key === '=') return k === '=' || k === '+';
  if (key === 'delete') return k === 'delete' || k === 'backspace';
  return k === key;
}

const MAC_EDIT_KEYS = new Set([
  'edit.undo',
  'edit.redo',
  'edit.cut',
  'edit.copy',
  'edit.paste',
  'edit.selectAll',
]);

/** Which command shortcuts the web view handles itself on this platform. */
export function handlesShortcut(id: string, kind: 'tauri' | 'browser', os: string): boolean {
  if (kind === 'browser' || os !== 'macos') return true;
  return MAC_EDIT_KEYS.has(id);
}

export function useKeyboard(): void {
  useEffect(() => {
    const { kind, os } = platform();
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === 'Escape') {
        if (ui.pathStart !== null) ui.set({ pathStart: null });
        else if (ui.presentation) ui.setPresentation(false);
        else if (!isTyping(e.target)) {
          useEditor.getState().clearSelection();
          useEditor.getState().setHighlight(null);
        }
        return;
      }
      if (isTyping(e.target)) return;
      // Presentation mode: step through pages.
      if (ui.presentation && (e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ')) {
        const ed = useEditor.getState();
        const pages = [...ed.doc.pages].sort((a, b) => a.order - b.order);
        const i = pages.findIndex((p) => p.id === ed.pageId);
        const next = pages[e.key === 'PageUp' ? i - 1 : i + 1];
        if (next) ed.setPage(next.id);
        e.preventDefault();
        return;
      }
      if (e.key.startsWith('Arrow')) {
        const dir = e.key.slice(5).toLowerCase() as 'up' | 'down' | 'left' | 'right';
        if (e.altKey) focusNearest(dir);
        else {
          const step = e.shiftKey ? 10 : 1;
          nudge(
            dir === 'left' ? -step : dir === 'right' ? step : 0,
            dir === 'up' ? -step : dir === 'down' ? step : 0,
          );
        }
        e.preventDefault();
        return;
      }
      const ed = useEditor.getState();
      if (e.key === 'Enter' && ed.selection.devices.length === 1) {
        document.getElementById('inspector-hostname')?.focus();
        e.preventDefault();
        return;
      }
      if (
        e.key.toLowerCase() === 'l' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        ed.selection.devices.length === 1
      ) {
        ui.open({ kind: 'linkFromFocused', sourceId: ed.selection.devices[0] as string });
        e.preventDefault();
        return;
      }
      for (const c of commandList()) {
        if (
          c.shortcut &&
          c.id !== 'edit.delete' &&
          handlesShortcut(c.id, kind, os) &&
          matches(e, c.shortcut)
        ) {
          e.preventDefault();
          runCommand(c.id as MenuCommand);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        runCommand('edit.redo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
