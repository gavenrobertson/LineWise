// SPDX-License-Identifier: Apache-2.0
/** Auto-layout runs off the UI thread (FR-CAN-14, NFR-PERF-05). Cancel = terminate the worker. */
import { runLayout, type LayoutRequest } from '../layout/layouts.ts';

// ELK layouts run through ELK's own worker (workers/elk.ts); this worker handles force layout.
const noElk = () => Promise.reject(new Error('ELK layouts do not run in this worker'));

self.onmessage = async (e: MessageEvent<{ id: number; request: LayoutRequest }>) => {
  const { id, request } = e.data;
  try {
    const positions = await runLayout(request, noElk);
    self.postMessage({ id, positions });
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
