// SPDX-License-Identifier: Apache-2.0
/**
 * Smart tips (FR-UX-12): a short hint when it helps, never modal, at most one per session, with
 * "Don't show again" remembered in preferences and a switch in Preferences to turn them all off.
 */
import { ICON_HALF, type XY } from '../canvas/geometry.ts';
import i18n from '../i18n/index.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });

export type TipId = 'import-cdp' | 'auto-layout';

let shownThisSession = false;
let manualLinks = 0;

/**
 * Tips and the tour stay out of automated runs (E2E, the native smoke test), which would otherwise
 * find a toast or a coach mark in their way; a test turns them on with `linewise.e2e.help`.
 */
export function helpQuiet(): boolean {
  if (typeof navigator === 'undefined' || !navigator.webdriver) return false;
  try {
    return localStorage.getItem('linewise.e2e.help') !== '1';
  } catch {
    return true;
  }
}

/** Show a tip unless tips are off, it was dismissed, or one was already shown this session. */
export function offerTip(id: TipId): boolean {
  const prefs = usePrefs.getState();
  if (shownThisSession || helpQuiet() || !prefs.showTips || prefs.dismissedTips.includes(id)) return false;
  shownThisSession = true;
  useUi.getState().toast(tipText(id), 'tip', {
    actions: [
      {
        label: t('tips.dontShow', 'Don’t show again'),
        run: () => {
          const p = usePrefs.getState();
          p.set({ dismissedTips: [...new Set([...p.dismissedTips, id])] });
        },
      },
    ],
  });
  return true;
}

function tipText(id: TipId): string {
  switch (id) {
    case 'import-cdp':
      return t(
        'tips.importCdp',
        'Tip: paste “show cdp neighbors detail” into File → Import to draw links automatically.',
      );
    case 'auto-layout':
      return t('tips.autoLayout', 'Tip: Arrange → Auto-layout tidies overlapping devices.');
  }
}

/** After the third link drawn by hand in a session. */
export function noteManualLink(): void {
  manualLinks++;
  if (manualLinks === 3) offerTip('import-cdp');
}

/** After a drop: a moved device whose icon covers another's. */
export function noteDrop(moved: XY[], others: XY[]): void {
  const hit = moved.some((m) =>
    others.some((o) => Math.abs(m.x - o.x) < ICON_HALF * 1.5 && Math.abs(m.y - o.y) < ICON_HALF * 1.5),
  );
  if (hit) offerTip('auto-layout');
}

/** For tests. */
export function resetTips(): void {
  shownThisSession = false;
  manualLinks = 0;
}
