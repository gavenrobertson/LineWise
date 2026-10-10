// SPDX-License-Identifier: Apache-2.0
/**
 * BrowserPlatform: an in-memory implementation used by Playwright tests and a
 * possible web demo (ADR 0003). Files live in memory (and recovery entries in
 * localStorage); `window.__linewise` exposes hooks so tests can inject and read files.
 */
import type {
  FileFilter,
  MenuCommand,
  OpenedFile,
  PlatformAdapter,
  RecentFile,
  RecoveryEntry,
  SavedFile,
} from './types.ts';

interface TestHooks {
  files: Map<string, string | Uint8Array>;
  /** Queue the next answers to file pickers / save dialogs. */
  nextOpen: OpenedFile[][];
  nextSavePath: (string | null)[];
  nextConfirm: boolean[];
  exports: { name: string; data: string | Uint8Array }[];
  emitMenu: (cmd: MenuCommand) => void;
  emitOpenFile: (path: string) => void;
}

declare global {
  interface Window {
    __linewise?: TestHooks;
  }
}

const RECENT_KEY = 'linewise.recent';
const RECOVERY_KEY = 'linewise.recovery';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = storage()?.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: recovery is best-effort in the browser build
  }
}

function pickWithInput(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

function download(data: string | Uint8Array, name: string): void {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createBrowserPlatform(): PlatformAdapter {
  const menuHandlers = new Set<(cmd: MenuCommand) => void>();
  const openHandlers = new Set<(path: string) => void>();
  const hooks: TestHooks = {
    files: new Map(),
    nextOpen: [],
    nextSavePath: [],
    nextConfirm: [],
    exports: [],
    emitMenu: (cmd) => menuHandlers.forEach((h) => h(cmd)),
    emitOpenFile: (path) => openHandlers.forEach((h) => h(path)),
  };
  window.__linewise = hooks;
  const automated = typeof navigator !== 'undefined' && navigator.webdriver;
  const accept = (filters: FileFilter[]) =>
    filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');

  return {
    kind: 'browser',
    os: 'web',
    appVersion: async () => import.meta.env.VITE_APP_VERSION ?? '0.0.0-dev',

    async openDiagram() {
      const queued = hooks.nextOpen.shift();
      if (queued) return queued[0] ?? null;
      if (automated) return null;
      const [file] = await pickWithInput('.lwise,.json', false);
      if (!file) return null;
      const text = await file.text();
      hooks.files.set(file.name, text);
      return { path: file.name, name: file.name, text };
    },

    async readPath(path) {
      const v = hooks.files.get(path);
      if (typeof v !== 'string') throw new Error(`File not found: ${path}`);
      return { path, name: path.split('/').pop() ?? path, text: v };
    },

    async saveDiagram(text, path, suggestedName) {
      let target = path;
      if (!target) {
        target = hooks.nextSavePath.length
          ? (hooks.nextSavePath.shift() ?? null)
          : automated
            ? suggestedName
            : suggestedName;
        if (!target) return null;
        if (!automated) download(text, target);
      }
      hooks.files.set(target, text);
      return { path: target, name: target.split('/').pop() ?? target };
    },

    async pickTextFiles(filters, multiple) {
      const queued = hooks.nextOpen.shift();
      if (queued) return queued;
      if (automated) return [];
      const files = await pickWithInput(accept(filters), multiple);
      return Promise.all(files.map(async (f) => ({ path: f.name, name: f.name, text: await f.text() })));
    },

    async pickBinaryFile(filters) {
      if (automated) return null;
      const [f] = await pickWithInput(accept(filters), false);
      return f ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
    },

    async pickBinaryFiles(filters) {
      if (automated) return [];
      const files = await pickWithInput(accept(filters), true);
      return Promise.all(
        files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
      );
    },

    async exportFile(data, suggestedName) {
      hooks.exports.push({ name: suggestedName, data });
      if (!automated) download(data, suggestedName);
      return true;
    },

    async recentFiles() {
      return readJson<RecentFile[]>(RECENT_KEY, []);
    },

    async addRecent(file: SavedFile) {
      const list = readJson<RecentFile[]>(RECENT_KEY, []).filter((r) => r.path !== file.path);
      list.unshift({ ...file, openedAt: new Date().toISOString() });
      writeJson(RECENT_KEY, list.slice(0, 10));
    },

    async writeRecovery(entry) {
      const all = readJson<RecoveryEntry[]>(RECOVERY_KEY, []).filter((r) => r.docId !== entry.docId);
      all.push({ ...entry, savedAt: new Date().toISOString() });
      writeJson(RECOVERY_KEY, all);
    },

    async listRecovery() {
      return readJson<RecoveryEntry[]>(RECOVERY_KEY, []);
    },

    async clearRecovery(docId) {
      writeJson(
        RECOVERY_KEY,
        readJson<RecoveryEntry[]>(RECOVERY_KEY, []).filter((r) => r.docId !== docId),
      );
    },

    async confirm(message) {
      if (hooks.nextConfirm.length) return hooks.nextConfirm.shift() ?? false;
      if (automated) return true;
      return window.confirm(message);
    },

    async askUnsaved(text) {
      if (hooks.nextConfirm.length) return hooks.nextConfirm.shift() ? 'discard' : 'cancel';
      if (automated) return 'discard';
      return window.confirm(text) ? 'discard' : 'cancel';
    },

    async setTitle(title) {
      document.title = title;
    },

    onMenu(handler) {
      menuHandlers.add(handler);
      return () => menuHandlers.delete(handler);
    },

    onOpenFile(handler) {
      openHandlers.add(handler);
      return () => openHandlers.delete(handler);
    },

    onCloseRequested(_confirm, isDirty) {
      const h = (e: BeforeUnloadEvent) => {
        if (!isDirty()) return;
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', h);
      return () => window.removeEventListener('beforeunload', h);
    },

    async checkForUpdates() {
      return null;
    },

    async openExternal(url) {
      window.open(url, '_blank', 'noopener');
    },

    async openLogsFolder() {
      // no logs folder in the browser build
    },

    async print() {
      window.print();
    },
  };
}
