// SPDX-License-Identifier: Apache-2.0
/**
 * Commands and undo/redo history (ADR 0003, FR-CAN-07). Every model change is
 * a Command run through Immer's produceWithPatches; History stores forward and
 * inverse patches and coalesces consecutive commands with the same key.
 */
import { applyPatches, enablePatches, freeze, produceWithPatches, type Draft, type Patch } from 'immer';
import { nowIso } from './ids.ts';
import type { NetworkDocument } from './schema.ts';

enablePatches();

export interface Command {
  /** Human-readable label for the Edit menu ("Undo Move devices"). */
  label: string;
  /** Consecutive commands with the same key merge into one undo step (e.g. one drag gesture). */
  coalesceKey?: string;
  run: (draft: Draft<NetworkDocument>) => void;
}

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  key?: string;
}

export interface ExecuteResult {
  doc: NetworkDocument;
  changed: boolean;
}

/** Apply a command without touching history (used by History and by tests). */
export function applyCommand(
  doc: NetworkDocument,
  cmd: Command,
): { doc: NetworkDocument; patches: Patch[]; inverse: Patch[] } {
  const [next, patches, inverse] = produceWithPatches(doc, (draft) => {
    cmd.run(draft);
  });
  if (patches.length === 0) return { doc, patches, inverse };
  const stamped = produceWithPatches(next, (d) => {
    d.updatedAt = nowIso();
  });
  return { doc: stamped[0], patches: [...patches, ...stamped[1]], inverse: [...stamped[2], ...inverse] };
}

export class History {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  /** A new coalescing key must be armed explicitly for each gesture, see `breakCoalescing`. */
  private lastKey: string | undefined;

  constructor(private readonly limit = 1000) {}

  execute(doc: NetworkDocument, cmd: Command): ExecuteResult {
    const { doc: next, patches, inverse } = applyCommand(doc, cmd);
    if (patches.length === 0) return { doc, changed: false };
    const last = this.past.at(-1);
    if (cmd.coalesceKey && last && last.key === cmd.coalesceKey && this.lastKey === cmd.coalesceKey) {
      last.patches = [...last.patches, ...patches];
      last.inverse = [...inverse, ...last.inverse];
    } else {
      const entry: HistoryEntry = { label: cmd.label, patches, inverse };
      if (cmd.coalesceKey) entry.key = cmd.coalesceKey;
      this.past.push(entry);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.lastKey = cmd.coalesceKey;
    this.future = [];
    return { doc: next, changed: true };
  }

  /** End the current coalescing run (call on pointer-up after a drag). */
  breakCoalescing(): void {
    this.lastKey = undefined;
  }

  undo(doc: NetworkDocument): NetworkDocument {
    const entry = this.past.pop();
    if (!entry) return doc;
    this.future.push(entry);
    this.lastKey = undefined;
    return applyPatches(doc, entry.inverse);
  }

  redo(doc: NetworkDocument): NetworkDocument {
    const entry = this.future.pop();
    if (!entry) return doc;
    this.past.push(entry);
    this.lastKey = undefined;
    return applyPatches(doc, entry.patches);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.past.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.future.at(-1)?.label;
  }

  get size(): number {
    return this.past.length;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKey = undefined;
  }
}

/** A document plus its history: the unit the UI store and tests work with. */
export class Editor {
  readonly history: History;

  doc: NetworkDocument;

  constructor(doc: NetworkDocument, limit?: number) {
    // Freeze once up front. Immer would otherwise deep-freeze the whole document on the first
    // edit after opening a file, which costs ~45 ms with 500 devices (NFR-PERF-04).
    this.doc = freeze(doc, true);
    this.history = new History(limit);
  }

  execute(cmd: Command): boolean {
    const r = this.history.execute(this.doc, cmd);
    this.doc = r.doc;
    return r.changed;
  }

  undo(): void {
    this.doc = this.history.undo(this.doc);
  }

  redo(): void {
    this.doc = this.history.redo(this.doc);
  }
}
