// SPDX-License-Identifier: Apache-2.0
/**
 * Worker clients. Validation is debounced and keyed by revision; layouts are
 * cancellable by terminating the worker. Where workers are unavailable (unit
 * tests under jsdom) both fall back to running inline.
 */
import { validate, type Issue, type NetworkDocument } from '@linewise/core';
import { runLayout, type ElkLike, type LayoutRequest, type Positions } from '../layout/layouts.ts';

const hasWorker =
  typeof Worker !== 'undefined' && typeof window !== 'undefined' && !('__vitest_worker__' in globalThis);

// ---------------------------------------------------------------- validation

let vWorker: Worker | null = null;
let vListener: ((rev: number, issues: Issue[], suppressed: Issue[]) => void) | null = null;

export function onValidation(cb: (rev: number, issues: Issue[], suppressed: Issue[]) => void): void {
  vListener = cb;
}

export function requestValidation(rev: number, doc: NetworkDocument): void {
  if (!hasWorker) {
    const r = validate(doc);
    vListener?.(rev, r.issues, r.suppressed);
    return;
  }
  if (!vWorker) {
    vWorker = new Worker(new URL('./validation.worker.ts', import.meta.url), { type: 'module' });
    vWorker.onmessage = (
      e: MessageEvent<{ rev: number; issues?: Issue[]; suppressed?: Issue[]; error?: string }>,
    ) => {
      if (e.data.error || !e.data.issues) return;
      vListener?.(e.data.rev, e.data.issues, e.data.suppressed ?? []);
    };
  }
  vWorker.postMessage({ rev, doc });
}

// ---------------------------------------------------------------- layout

export interface LayoutJob {
  promise: Promise<Positions>;
  cancel: () => void;
}

let seq = 0;

export function startLayout(request: LayoutRequest): LayoutJob {
  if (!hasWorker) {
    let stopped = false;
    const elk = async () => {
      const mod = await import('elkjs/lib/elk.bundled.js');
      return new mod.default() as unknown as ElkLike;
    };
    return { promise: runLayout(request, elk, () => stopped), cancel: () => (stopped = true) };
  }
  const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  const id = ++seq;
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<Positions>((res, rej) => {
    reject = rej;
    worker.onmessage = (e: MessageEvent<{ id: number; positions?: Positions; error?: string }>) => {
      if (e.data.id !== id) return;
      worker.terminate();
      if (e.data.positions) res(e.data.positions);
      else rej(new Error(e.data.error ?? 'Layout failed'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      rej(new Error(e.message || 'Layout failed'));
    };
  });
  worker.postMessage({ id, request });
  return {
    promise,
    cancel: () => {
      worker.terminate();
      reject(new DOMException('Layout cancelled', 'AbortError') as unknown as Error);
    },
  };
}
