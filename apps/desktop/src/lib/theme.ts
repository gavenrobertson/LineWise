// SPDX-License-Identifier: Apache-2.0
/**
 * Theme switching (FR-APP-04, FR-UX-02). Dark is the default; the toolbar button and View → Toggle
 * dark mode swap between light and dark. The swap cross-fades the whole window (a View Transition,
 * which animates a snapshot, so no element repaints per frame) and is instant under reduced motion
 * or where the webview has no View Transitions.
 */
import { useSyncExternalStore } from 'react';
import { applyTheme, usePrefs, type Prefs } from '../store/prefs.ts';
import { reducedMotion } from './motion.ts';

/** The theme on screen: a set theme, or the OS setting when following the system. */
export function resolvedTheme(theme: Prefs['theme'] = usePrefs.getState().theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Set the theme preference, cross-fading from the old colors to the new ones. */
export function setTheme(theme: Prefs['theme']): void {
  const apply = () => {
    applyTheme(theme);
    usePrefs.getState().set({ theme });
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (resolvedTheme(theme) === resolvedTheme() || reducedMotion() || !doc.startViewTransition) apply();
  else doc.startViewTransition(apply);
}

/** Swap between light and dark. */
export function toggleTheme(): void {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

const DARK_QUERY = '(prefers-color-scheme: dark)';
function subscribeOs(cb: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** The theme on screen, kept current when the preference or (when following it) the OS changes. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePrefs((s) => s.theme);
  const osDark = useSyncExternalStore(
    subscribeOs,
    () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches,
    () => false,
  );
  return theme === 'system' ? (osDark ? 'dark' : 'light') : theme;
}
