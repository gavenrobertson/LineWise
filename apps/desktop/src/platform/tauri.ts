// SPDX-License-Identifier: Apache-2.0
/** TauriPlatform: the production adapter, backed by Rust commands in src-tauri. */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask, message } from '@tauri-apps/plugin-dialog';
import type {
  FileFilter,
  MenuCommand,
  OpenedFile,
  PlatformAdapter,
  RecentFile,
  RecoveryEntry,
  SavedFile,
  UpdateInfo,
} from './types.ts';

const DIAGRAM_FILTER: FileFilter[] = [{ name: 'LineWise diagram', extensions: ['lwise'] }];

// Dialogs run in Rust so it can scope file access to paths the user picked (NFR-SEC-01).
const pickOpen = (filters: FileFilter[], multiple: boolean) =>
  invoke<string[]>('pick_open', { filters, multiple });
const pickSave = (defaultName: string, filters: FileFilter[]) =>
  invoke<string | null>('pick_save', { defaultName, filters });

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function detectOs(): PlatformAdapter['os'] {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'macos';
  if (/Windows/i.test(ua)) return 'windows';
  return 'linux';
}

function subscribe<T>(event: string, handler: (payload: T) => void): () => void {
  let unlisten: (() => void) | undefined;
  let disposed = false;
  void listen<T>(event, (e) => handler(e.payload)).then((u) => {
    if (disposed) u();
    else unlisten = u;
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export function createTauriPlatform(): PlatformAdapter {
  return {
    kind: 'tauri',
    os: detectOs(),
    appVersion: () => invoke<string>('app_version'),

    async openDiagram() {
      const [path] = await pickOpen(DIAGRAM_FILTER, false);
      return path ? this.readPath(path) : null;
    },

    async readPath(path) {
      const text = await invoke<string>('read_text_file', { path });
      return { path, name: baseName(path), text };
    },

    async saveDiagram(text, path, suggestedName) {
      let target = path;
      if (!target) {
        target = await pickSave(suggestedName, DIAGRAM_FILTER);
        if (!target) return null;
      }
      await invoke('save_atomic', { path: target, contents: text });
      return { path: target, name: baseName(target) };
    },

    async pickTextFiles(filters, multiple) {
      const paths = await pickOpen(filters, multiple);
      const out: OpenedFile[] = [];
      for (const p of paths) out.push(await this.readPath(p));
      return out;
    },

    async pickBinaryFile(filters) {
      const [p] = await pickOpen(filters, false);
      if (!p) return null;
      const bytes = await invoke<number[]>('read_binary_file', { path: p });
      return { name: baseName(p), bytes: new Uint8Array(bytes) };
    },

    async exportFile(data, suggestedName, filters) {
      const target = await pickSave(suggestedName, filters);
      if (!target) return false;
      const bytes = typeof data === 'string' ? Array.from(new TextEncoder().encode(data)) : Array.from(data);
      await invoke('write_binary_atomic', { path: target, contents: bytes });
      return true;
    },

    recentFiles: () => invoke<RecentFile[]>('recent_list'),

    async addRecent(file: SavedFile) {
      await invoke('recent_add', { path: file.path });
    },

    writeRecovery: (entry) => invoke('recovery_write', { entry }),
    listRecovery: () => invoke<RecoveryEntry[]>('recovery_list'),
    clearRecovery: (docId) => invoke('recovery_clear', { docId }),

    confirm: (text, title) => ask(text, { title: title ?? 'LineWise', kind: 'warning' }),

    async askUnsaved(text, labels) {
      const r = await message(text, {
        title: 'LineWise',
        kind: 'warning',
        buttons: { yes: labels.save, no: labels.discard, cancel: labels.cancel },
      });
      return r === labels.save || r === 'Yes'
        ? 'save'
        : r === labels.discard || r === 'No'
          ? 'discard'
          : 'cancel';
    },

    async setTitle(title) {
      await getCurrentWindow().setTitle(title);
    },

    onMenu(handler) {
      return subscribe<MenuCommand>('menu', handler);
    },

    onOpenFile(handler) {
      // Files passed at launch are queued in Rust until the UI is ready.
      void invoke<string[]>('take_pending_opens').then((paths) => paths.forEach(handler));
      return subscribe<string>('open-file', handler);
    },

    onCloseRequested(confirmClose) {
      return subscribe<null>('close-requested', () => {
        void confirmClose().then((ok) => ok && invoke('quit_app'));
      });
    },

    async checkForUpdates(channel) {
      const meta = await invoke<{ version: string; notes: string } | null>('check_update', { channel });
      if (!meta) return null;
      const info: UpdateInfo = {
        version: meta.version,
        notes: meta.notes,
        install: () => invoke('install_update', { channel }),
      };
      return info;
    },

    openExternal: (url) => invoke('open_external', { url }),
    openLogsFolder: () => invoke('open_logs_folder'),
    async print() {
      // WKWebView ignores window.print(); WebView2 supports it.
      if (detectOs() === 'macos') await invoke('print_page');
      else window.print();
    },
  };
}
