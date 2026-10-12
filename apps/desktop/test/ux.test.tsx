// SPDX-License-Identifier: Apache-2.0
/** The UX polish pass (FR-UX-01..13): tokens, motion, tooltips, labels and help. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyParts } from '../src/components/ui.tsx';
import { cubicBezier, easeStandard, motionMs } from '../src/lib/motion.ts';
import { useUi } from '../src/store/ui.ts';

const css = readFileSync(resolve(import.meta.dirname, '../src/styles.css'), 'utf8');

/** The body of the first rule that starts with `selector {`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i);
  }
  return '';
}

describe('FR-UX-01 design tokens', () => {
  it('defines motion, elevation, material and label tokens', () => {
    const root = block(':root');
    for (const v of ['--dur-instant: 80ms', '--dur-fast: 140ms', '--dur-base: 220ms', '--dur-slow: 320ms'])
      expect(root).toContain(v);
    for (const v of [
      '--ease-standard',
      '--ease-emphasized',
      '--ease-exit',
      '--elev-1',
      '--elev-2',
      '--elev-3',
    ])
      expect(root).toContain(v);
    expect(root).toContain('--material');
    expect(root).toContain('--label-border');
  });
  it('tunes elevation for the dark theme with a hairline highlight', () => {
    const dark = block(":root[data-theme='dark']");
    expect(dark).toMatch(/--elev-2:\s*inset 0 1px 0 rgba\(255, 255, 255/);
    expect(block('@media (prefers-color-scheme: dark)')).toContain('--elev-3');
  });
  it('turns the translucent material opaque under increased contrast and forced colors', () => {
    expect(block('@media (prefers-contrast: more), (prefers-reduced-transparency: reduce)')).toContain(
      'backdrop-filter: none',
    );
    expect(block('@media (forced-colors: active)')).toMatch(/\.lw-material \{\s*background: Canvas/);
  });
  it('has one radius scale and a keyboard-only focus ring', () => {
    expect(block('@theme')).toMatch(/--radius-lg: 10px;\s*--radius-xl: 14px;\s*--radius-2xl: 20px;/);
    const base = block('@layer base');
    expect(base).toContain('outline: 2px solid var(--focus)');
    expect(base).toContain(':focus:not(:focus-visible)');
  });
});

describe('FR-UX-02 motion vocabulary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('animates only transform and opacity in its keyframes', () => {
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      const props = [...(body ?? '').matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]);
      for (const p of props) expect(['opacity', 'transform', 'scale']).toContain(p);
    }
  });
  it('collapses every animation and transition under reduced motion', () => {
    const rm = block('@media (prefers-reduced-motion: reduce)');
    expect(rm).toContain('animation-duration: 0.01ms !important');
    expect(rm).toContain('transition-duration: 0.01ms !important');
    expect(rm).toContain('animation-delay: 0ms !important');
  });
  it('makes viewport moves instant under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(motionMs(320)).toBe(0);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(motionMs(320)).toBe(320);
  });
  it('eases with the standard curve', () => {
    expect(easeStandard(0)).toBe(0);
    expect(easeStandard(1)).toBe(1);
    // Quick start, gentle stop: well past halfway at half time.
    expect(easeStandard(0.5)).toBeGreaterThan(0.75);
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 2);
  });
  it('pauses a toast while the pointer is on it', () => {
    vi.useFakeTimers();
    useUi.setState({ toasts: [] });
    const id = useUi.getState().toast('Saved', 'success');
    vi.advanceTimersByTime(2000);
    useUi.getState().hold(id, true);
    vi.advanceTimersByTime(10_000);
    expect(useUi.getState().toasts).toHaveLength(1);
    useUi.getState().hold(id, false);
    vi.advanceTimersByTime(1600);
    expect(useUi.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('FR-UX-08 tooltips', () => {
  it('splits a shortcut into key caps on every platform', () => {
    expect(keyParts('Ctrl+Shift+Z')).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(keyParts('Ctrl++')).toEqual(['Ctrl', '+']);
    expect(keyParts('⌘⇧Z')).toEqual(['⌘', '⇧', 'Z']);
    expect(keyParts('⌘,')).toEqual(['⌘', ',']);
    expect(keyParts('F5')).toEqual(['F5']);
    expect(keyParts('')).toEqual([]);
  });
});
