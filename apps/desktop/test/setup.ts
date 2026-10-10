// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom gaps used by React Flow and Radix.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1;
  constructor() {}
} as unknown as typeof DOMMatrixReadOnly;
if (!('scrollIntoView' in Element.prototype)) Object.assign(Element.prototype, { scrollIntoView() {} });
if (!window.matchMedia)
  window.matchMedia = (q: string) =>
    ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
