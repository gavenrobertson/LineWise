// SPDX-License-Identifier: Apache-2.0
/**
 * The motion vocabulary in script (FR-UX-02), for animations CSS cannot run, such as viewport moves.
 * Durations and curves match the tokens in styles.css; everything is instant under reduced motion
 * (NFR-A11Y-04).
 */

export const DUR = { instant: 80, fast: 140, base: 220, slow: 320 } as const;

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A duration in ms, or 0 under reduced motion. */
export function motionMs(ms: number): number {
  return reducedMotion() ? 0 : ms;
}

/** CSS `cubic-bezier(x1, y1, x2, y2)` as a function of time 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Find t for x by bisection: 20 steps are well below a pixel.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (bez(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return bez(y1, y2, (lo + hi) / 2);
  };
}

/** `--ease-standard`: quick start, long gentle stop. */
export const easeStandard = cubicBezier(0.2, 0, 0, 1);
