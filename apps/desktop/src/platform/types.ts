// SPDX-License-Identifier: Apache-2.0
/**
 * Everything OS-specific goes through this interface (spec section 9). Only
 * files in src/platform may import @tauri-apps/* (enforced by ESLint).
 */

export interface OpenedFile {
  /** Absolute path (Tauri) or a virtual key (browser). */
  path: string;
  name: string;
  text: string;
}

export interface SavedFile {
  path: string;
  name: string;
}

export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

export interface RecoveryEntry {
  docId: string;
  name: string;
  path: string | null;
  savedAt: string;
  text: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface UpdateInfo {
  version: string;
  notes: string;
  install: () => Promise<void>;
}

/** Native menu command identifiers, shared by the Rust menu and the web toolbar. */
export type MenuCommand =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.saveAs'
  | 'file.import'
  | 'file.export'
  | 'file.print'
  | 'file.close'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.duplicate'
  | 'edit.delete'
  | 'edit.selectAll'
  | 'edit.selectSameType'
  | 'edit.selectConnected'
  | 'edit.copyStyle'
  | 'edit.pasteStyle'
  | 'edit.find'
  | 'edit.preferences'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoomFit'
  | 'view.zoomSelection'
  | 'view.l1'
  | 'view.l2'
  | 'view.l3'
  | 'view.minimap'
  | 'view.problems'
  | 'view.commandPalette'
  | 'view.library'
  | 'view.presentation'
  | 'insert.zone'
  | 'insert.text'
  | 'insert.note'
  | 'insert.image'
  | 'insert.rect'
  | 'insert.ellipse'
  | 'insert.arrow'
  | 'insert.page'
  | 'arrange.layout'
  | 'arrange.front'
  | 'arrange.back'
  | 'arrange.group'
  | 'arrange.ungroup'
  | 'arrange.lock'
  | 'arrange.unlock'
  | 'arrange.alignLeft'
  | 'arrange.alignCenter'
  | 'arrange.alignRight'
  | 'arrange.alignTop'
  | 'arrange.alignMiddle'
  | 'arrange.alignBottom'
  | 'arrange.distributeH'
  | 'arrange.distributeV'
  | 'network.vlans'
  | 'network.ipam'
  | 'network.calculator'
  | 'network.validate'
  | 'window.nextTab'
  | 'window.prevTab'
  | 'help.shortcuts'
  | 'help.docs'
  | 'help.updates'
  | 'help.about'
  | 'help.logs';

export interface PlatformAdapter {
  readonly kind: 'tauri' | 'browser';
  readonly os: 'macos' | 'windows' | 'linux' | 'web';
  appVersion(): Promise<string>;

  openDiagram(): Promise<OpenedFile | null>;
  readPath(path: string): Promise<OpenedFile>;
  /** Save to `path` atomically, or ask for a location when `path` is null. */
  saveDiagram(text: string, path: string | null, suggestedName: string): Promise<SavedFile | null>;
  /** Pick text files for import (multiple allowed). */
  pickTextFiles(filters: FileFilter[], multiple: boolean): Promise<OpenedFile[]>;
  pickBinaryFile(filters: FileFilter[]): Promise<{ name: string; bytes: Uint8Array } | null>;
  pickBinaryFiles(filters: FileFilter[]): Promise<{ name: string; bytes: Uint8Array }[]>;
  /** Ask where to save an export and write it. Returns false when cancelled. */
  exportFile(data: Uint8Array | string, suggestedName: string, filters: FileFilter[]): Promise<boolean>;

  recentFiles(): Promise<RecentFile[]>;
  addRecent(file: SavedFile): Promise<void>;

  writeRecovery(entry: Omit<RecoveryEntry, 'savedAt'>): Promise<void>;
  listRecovery(): Promise<RecoveryEntry[]>;
  clearRecovery(docId: string): Promise<void>;

  confirm(message: string, title?: string): Promise<boolean>;
  /** Three-way unsaved-changes prompt: Save, Don't Save, Cancel. */
  askUnsaved(
    message: string,
    labels: { save: string; discard: string; cancel: string },
  ): Promise<'save' | 'discard' | 'cancel'>;
  setTitle(title: string): Promise<void>;
  onMenu(handler: (cmd: MenuCommand) => void): () => void;
  /** File association / "Open with" (FR-APP-09). */
  onOpenFile(handler: (path: string) => void): () => void;
  /**
   * Window close / app quit (FR-APP-02). `confirmClose` resolves true when it is
   * safe to close; `isDirty` is used where only a synchronous check is possible.
   */
  onCloseRequested(confirmClose: () => Promise<boolean>, isDirty: () => boolean): () => void;
  checkForUpdates(channel: 'stable' | 'beta'): Promise<UpdateInfo | null>;
  openExternal(url: string): Promise<void>;
  openLogsFolder(): Promise<void>;
  print(): Promise<void>;
}
