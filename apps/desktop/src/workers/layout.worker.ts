// SPDX-License-Identifier: Apache-2.0
/** Auto-layout runs off the UI thread (FR-CAN-14, NFR-PERF-05). Cancel = terminate the worker. */
import { runLayout, type ElkLike, type LayoutRequest } from '../layout/layouts.ts';

let elk: ElkLike | null = null;
async function getElk(): Promise<ElkLike> {
  if (!elk) {
    const mod = await import('elkjs/lib/elk.bundled.js');
    const ELK = mod.default;
    elk = new ELK() as unknown as ElkLike;
  }
  return elk;
}

self.onmessage = async (e: MessageEvent<{ id: number; request: LayoutRequest }>) => {
  const { id, request } = e.data;
  try {
    const positions = await runLayout(request, getElk);
    self.postMessage({ id, positions });
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
