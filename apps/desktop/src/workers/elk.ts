// SPDX-License-Identifier: Apache-2.0
/**
 * ELK in the browser and the desktop web views (FR-CAN-14, NFR-PERF-05). The ELK API runs on
 * the main thread and only posts the graph to ELK's own worker script, which does the layout off
 * the UI thread. The worker script is served as an untransformed asset: bundling it (or
 * `elk.bundled.js`) breaks its internal module wiring.
 */
import ElkApi from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { ElkLike } from '../layout/layouts.ts';

export interface ElkHandle {
  elk: ElkLike;
  /** Stops the layout in progress (terminates ELK's worker). */
  dispose: () => void;
}

export function createElk(): ElkHandle {
  const Api = ((ElkApi as unknown as { default?: unknown }).default ?? ElkApi) as new (o: {
    workerFactory: () => Worker;
  }) => ElkLike & { terminateWorker?: () => void };
  const elk = new Api({ workerFactory: () => new Worker(elkWorkerUrl) });
  return { elk, dispose: () => elk.terminateWorker?.() };
}
