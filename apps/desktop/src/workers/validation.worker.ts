// SPDX-License-Identifier: Apache-2.0
/** Validation runs off the UI thread (FR-VAL-05) and is keyed on the document revision. */
import { validate, type NetworkDocument } from '@linewise/core';

self.onmessage = (e: MessageEvent<{ rev: number; doc: NetworkDocument }>) => {
  const { rev, doc } = e.data;
  try {
    const { issues, suppressed } = validate(doc);
    self.postMessage({ rev, issues, suppressed });
  } catch (err) {
    self.postMessage({ rev, error: (err as Error).message });
  }
};
