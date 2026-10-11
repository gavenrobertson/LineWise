// SPDX-License-Identifier: Apache-2.0
/** User preferences (FR-APP-07), persisted locally. Telemetry is off by default (NFR-PRIV-02). */
import { create } from 'zustand';
import type { DeviceTemplate } from '@linewise/core';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  defaultRouting: 'straight' | 'orthogonal' | 'curved';
  autosaveSeconds: number;
  updateChecks: boolean;
  updateChannel: 'stable' | 'beta';
  telemetry: boolean;
  language: string;
  exportScale: number;
  /** Interface size: follow the OS text size, or a fixed factor (NFR-A11Y-04). */
  uiScale: 'system' | number;
  showMinimap: boolean;
  /** Problem badges on devices and links (FR-VAL-03). */
  showProblemBadges: boolean;
  favorites: string[];
  recentTemplates: string[];
  customTemplates: DeviceTemplate[];
  lastUpdateCheck: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  gridSize: 16,
  snapToGrid: true,
  showGrid: true,
  defaultRouting: 'straight',
  autosaveSeconds: 60,
  updateChecks: true,
  updateChannel: 'stable',
  telemetry: false,
  language: 'en',
  exportScale: 2,
  uiScale: 'system',
  showMinimap: true,
  showProblemBadges: true,
  favorites: [],
  recentTemplates: [],
  customTemplates: [],
  lastUpdateCheck: null,
};

const KEY = 'linewise.prefs';

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

interface PrefsStore extends Prefs {
  set: (patch: Partial<Prefs>) => void;
  noteTemplateUse: (id: string) => void;
  toggleFavorite: (id: string) => void;
  reset: () => void;
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { set: _s, noteTemplateUse: _u, toggleFavorite: _t, reset: _r, ...data } = { ...get(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // storage unavailable: preferences last for this session only
    }
  },
  noteTemplateUse: (id) =>
    get().set({ recentTemplates: [id, ...get().recentTemplates.filter((x) => x !== id)].slice(0, 8) }),
  toggleFavorite: (id) => {
    const f = get().favorites;
    get().set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
  },
  reset: () => get().set(DEFAULT_PREFS),
}));

/** Apply the theme preference to the document root. */
export function applyTheme(theme: Prefs['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
